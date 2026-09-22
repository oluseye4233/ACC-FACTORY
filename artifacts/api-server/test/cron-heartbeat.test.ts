// Dead-man's-switch for the external Scheduled-Deployment cron ticks (Task:
// warn admins if the spend-alert safety net silently stops ticking).
//
// Exercises recordCronTick / getCronTargetStatuses / dispatchCronStaleAlerts.
// Isolation rules (shared dev DB):
//  - recordCronTick / getCronTargetStatuses only report configured targets,
//    so those tests snapshot the live row for the target they touch and
//    restore it afterwards (real rows are live app state on the shared DB).
//  - dispatchCronStaleAlerts is exercised ONLY through the statusesOverride
//    seam with synthetic target names + randomised episode keys, so stamps
//    for real targets in the shared dev DB are never written by tests
//    (writing one could suppress a genuine production/dev alert).
//  - Never seed a fixed constant into a UNIQUE column: targets and episode
//    keys are randomised per test and cleaned up.

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  cronTickStatusTable,
  cronTickEventsTable,
  cronStaleNotificationsTable,
  cronFlakyNotificationsTable,
  cronFlakyEpisodeStateTable,
  CRON_TICK_HISTORY_LIMIT,
} from "@workspace/db";

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendCronTargetStaleAlert: vi.fn(async () => ({ ok: true as const, id: "test" })),
    sendCronTargetFlakyAlert: vi.fn(async () => ({ ok: true as const, id: "test" })),
    sendCronTargetRecoveredAlert: vi.fn(async () => ({ ok: true as const, id: "test" })),
  };
});

import {
  sendCronTargetFlakyAlert,
  sendCronTargetRecoveredAlert,
  sendCronTargetStaleAlert,
} from "@workspace/email";
import {
  CRON_TARGET_CONFIGS,
  type CronTargetStatus,
  dispatchCronFlakyAlerts,
  dispatchCronRecoveryAlerts,
  dispatchCronStaleAlerts,
  ensureCronTargetsSeeded,
  getCronTargetStatuses,
  recordCronTick,
  startCronHeartbeatMonitor,
} from "../src/lib/cron-heartbeat";

const sendMock = vi.mocked(sendCronTargetStaleAlert);
const sendFlakyMock = vi.mocked(sendCronTargetFlakyAlert);
const recoveredMock = vi.mocked(sendCronTargetRecoveredAlert);

const createdStampTargets: string[] = [];
let prevAdminEmails: string | undefined;

beforeEach(() => {
  sendMock.mockClear();
  sendFlakyMock.mockClear();
  recoveredMock.mockClear();
  prevAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "ops@example.test, boss@example.test";
});

afterEach(async () => {
  if (prevAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = prevAdminEmails;
  while (createdStampTargets.length > 0) {
    const target = createdStampTargets.pop()!;
    await db
      .delete(cronStaleNotificationsTable)
      .where(eq(cronStaleNotificationsTable.target, target));
    await db
      .delete(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, target));
    await db
      .delete(cronFlakyEpisodeStateTable)
      .where(eq(cronFlakyEpisodeStateTable.target, target));
  }
});

/** Synthetic stale status for the tests-only override seam. */
function syntheticStatus(overrides: Partial<CronTargetStatus> = {}): CronTargetStatus {
  const target = `test-target-${randomUUID()}`;
  // Randomised far-future reference so episode keys can never collide with
  // anything real, and re-runs never collide with leftover rows.
  const ref = new Date(Date.UTC(3000 + Math.floor(Math.random() * 6000), 0, 15));
  return {
    target,
    label: "Test target",
    schedule: "every 15 minutes",
    expectedIntervalMinutes: 15,
    staleAfterMinutes: 60,
    firstSeenAt: ref.toISOString(),
    lastTickAt: ref.toISOString(),
    tickCount: 3,
    neverTicked: false,
    minutesSinceLastTick: 120,
    stale: true,
    recentTicks: [ref.toISOString()],
    ticksLast24h: 1,
    expectedTicksLast24h: 96,
    ...overrides,
  };
}

/**
 * Delete tick-history event rows this test wrote for a REAL target on the
 * shared dev DB. Events are matched by the exact tickedAt values the test
 * controlled, so genuine app-recorded history is never touched.
 */
async function cleanupTickEvents(target: string, tickedAts: Date[]) {
  if (tickedAts.length === 0) return;
  await db
    .delete(cronTickEventsTable)
    .where(
      and(
        eq(cronTickEventsTable.target, target),
        inArray(cronTickEventsTable.tickedAt, tickedAts),
      ),
    );
}

async function stampsFor(target: string) {
  return db
    .select()
    .from(cronStaleNotificationsTable)
    .where(eq(cronStaleNotificationsTable.target, target));
}

describe("recordCronTick + getCronTargetStatuses", () => {
  it("upserts the heartbeat row and staleness clears on a fresh tick", async () => {
    const target = "sweep-cost-cap-alerts";
    // Snapshot the live row (shared dev DB) and restore it afterwards.
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 5_000);
    try {
      await recordCronTick(target, t0);
      const statuses = await getCronTargetStatuses(new Date(t0.getTime() + 60_000));
      const s = statuses.find((x) => x.target === target)!;
      expect(s.lastTickAt).toBe(t0.toISOString());
      expect(s.neverTicked).toBe(false);
      expect(s.minutesSinceLastTick).toBe(1);
      expect(s.stale).toBe(false);
      expect(s.tickCount).toBeGreaterThanOrEqual(1);
      // History: the tick landed in recentTicks + the 24h counter.
      expect(s.recentTicks).toContain(t0.toISOString());
      expect(s.ticksLast24h).toBeGreaterThanOrEqual(1);
      expect(s.expectedTicksLast24h).toBe(96); // 15-min sweep → 96/day

      // Second tick increments the counter and moves the timestamp.
      await recordCronTick(target, t1);
      const after = await getCronTargetStatuses(new Date(t1.getTime() + 60_000));
      const s2 = after.find((x) => x.target === target)!;
      expect(s2.lastTickAt).toBe(t1.toISOString());
      expect(s2.tickCount).toBe(s.tickCount + 1);
      // Newest first, both ticks present.
      expect(s2.recentTicks.indexOf(t1.toISOString())).toBeLessThan(
        s2.recentTicks.indexOf(t0.toISOString()),
      );
      expect(s2.ticksLast24h).toBe(s.ticksLast24h + 1);
    } finally {
      await cleanupTickEvents(target, [t0, t1]);
      if (before) {
        await db
          .update(cronTickStatusTable)
          .set({ lastTickAt: before.lastTickAt, tickCount: before.tickCount })
          .where(eq(cronTickStatusTable.target, target));
      } else {
        await db.delete(cronTickStatusTable).where(eq(cronTickStatusTable.target, target));
      }
    }
  });

  it("caps recentTicks at 20 and only counts ticks inside the trailing 24h window", { timeout: 60_000 }, async () => {
    const target = "weekly-digest";
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    const now = new Date();
    // 22 ticks inside the window (odd second offsets so cleanup can match
    // exactly), plus one outside the 24h window.
    const inWindow = Array.from(
      { length: 22 },
      (_, i) => new Date(now.getTime() - (i + 1) * 61_000),
    );
    const outside = new Date(now.getTime() - 25 * 60 * 60_000);
    const all = [...inWindow, outside];
    try {
      for (const t of all) {
        await recordCronTick(target, t);
      }
      const s = (await getCronTargetStatuses(now)).find((x) => x.target === target)!;
      expect(s.recentTicks).toHaveLength(20);
      // Newest first: the most recent in-window tick leads the list.
      expect(s.recentTicks[0]).toBe(inWindow[0]!.toISOString());
      // The 25h-old tick is excluded from the 24h counter.
      expect(s.ticksLast24h).toBeGreaterThanOrEqual(22);
      expect(s.recentTicks).not.toContain(outside.toISOString());
    } finally {
      await cleanupTickEvents(target, all);
      if (before) {
        await db
          .update(cronTickStatusTable)
          .set({ lastTickAt: before.lastTickAt, tickCount: before.tickCount })
          .where(eq(cronTickStatusTable.target, target));
      } else {
        await db.delete(cronTickStatusTable).where(eq(cronTickStatusTable.target, target));
      }
    }
  });

  // 200+ sequential DB round-trips: needs far more than the 5s default.
  it("prunes the per-target history to CRON_TICK_HISTORY_LIMIT rows", { timeout: 120_000 }, async () => {
    // Prune keeps the NEWEST rows per target. Use far-future tickedAt values
    // so this test's rows always sort newest and the prune deletes ONLY among
    // them (any genuine app history for the target sorts older but survives
    // because we only add LIMIT+5 rows then clean them all up).
    const target = "run-f0-monitoring";
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    const preCount = await db
      .select({ id: cronTickEventsTable.id })
      .from(cronTickEventsTable)
      .where(eq(cronTickEventsTable.target, target));
    const base = Date.UTC(2500, 0, 1);
    const ticks = Array.from(
      { length: CRON_TICK_HISTORY_LIMIT + 5 },
      (_, i) => new Date(base + i * 60_000),
    );
    try {
      for (const t of ticks) {
        await recordCronTick(target, t);
      }
      const rows = await db
        .select({ tickedAt: cronTickEventsTable.tickedAt })
        .from(cronTickEventsTable)
        .where(eq(cronTickEventsTable.target, target));
      expect(rows.length).toBe(CRON_TICK_HISTORY_LIMIT);
      // The oldest of this test's ticks were pruned away.
      const kept = new Set(rows.map((r) => r.tickedAt.toISOString()));
      expect(kept.has(ticks[ticks.length - 1]!.toISOString())).toBe(true);
      expect(kept.has(ticks[0]!.toISOString())).toBe(false);
      // Any pre-existing genuine history was pruned first (it sorted oldest) —
      // acceptable: it is at most a handful of dev rows and the table is a
      // rolling window by design.
      void preCount;
    } finally {
      await cleanupTickEvents(target, ticks);
      if (before) {
        await db
          .update(cronTickStatusTable)
          .set({ lastTickAt: before.lastTickAt, tickCount: before.tickCount })
          .where(eq(cronTickStatusTable.target, target));
      } else {
        await db.delete(cronTickStatusTable).where(eq(cronTickStatusTable.target, target));
      }
    }
  });

  it("flags a target stale once past its window, and never-ticked targets use first_seen_at", async () => {
    const target = "reset-harness-limits";
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    const t0 = new Date();
    try {
      await recordCronTick(target, t0);
      const cfg = CRON_TARGET_CONFIGS.find((c) => c.target === target)!;
      const justUnder = new Date(t0.getTime() + cfg.staleAfterMinutes * 60_000);
      const justOver = new Date(t0.getTime() + (cfg.staleAfterMinutes + 1) * 60_000);

      const fresh = (await getCronTargetStatuses(justUnder)).find((x) => x.target === target)!;
      expect(fresh.stale).toBe(false);
      const overdue = (await getCronTargetStatuses(justOver)).find((x) => x.target === target)!;
      expect(overdue.stale).toBe(true);
    } finally {
      await cleanupTickEvents(target, [t0]);
      if (before) {
        await db
          .update(cronTickStatusTable)
          .set({ lastTickAt: before.lastTickAt, tickCount: before.tickCount })
          .where(eq(cronTickStatusTable.target, target));
      } else {
        await db.delete(cronTickStatusTable).where(eq(cronTickStatusTable.target, target));
      }
    }
  });

  it("seeds baseline rows for all known targets (idempotently) and reports them", async () => {
    const targets = CRON_TARGET_CONFIGS.map((c) => c.target);
    const preExisting = await db
      .select({ target: cronTickStatusTable.target })
      .from(cronTickStatusTable)
      .where(inArray(cronTickStatusTable.target, targets));
    const preSet = new Set(preExisting.map((r) => r.target));
    try {
      await ensureCronTargetsSeeded();
      await ensureCronTargetsSeeded(); // idempotent
      const statuses = await getCronTargetStatuses();
      expect(statuses.map((s) => s.target).sort()).toEqual([...targets].sort());
      for (const s of statuses) {
        expect(s.firstSeenAt).not.toBeNull();
      }
    } finally {
      // Remove only rows this test created (targets that had no row before).
      const created = targets.filter((t) => !preSet.has(t));
      if (created.length > 0) {
        await db
          .delete(cronTickStatusTable)
          .where(inArray(cronTickStatusTable.target, created));
      }
    }
  });
});

describe("dispatchCronStaleAlerts (via tests-only statusesOverride seam)", () => {
  it("emails every admin exactly once per stale episode", async () => {
    const status = syntheticStatus();
    createdStampTargets.push(status.target);
    const now = new Date(new Date(status.lastTickAt!).getTime() + 2 * 60 * 60_000);

    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).toHaveBeenCalledTimes(2); // one per admin
    const tos = sendMock.mock.calls.map((c) => c[0].to).sort();
    expect(tos).toEqual(["boss@example.test", "ops@example.test"]);
    const args = sendMock.mock.calls[0]![0];
    expect(args.target).toBe(status.target);
    expect(args.staleAfterMinutes).toBe(60);
    expect(args.overdueMinutes).toBe(60); // 120 min since tick − 60 min window

    // Same episode again → no repeat (stamp already landed).
    sendMock.mockClear();
    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await stampsFor(status.target)).toHaveLength(1);
  });

  it("a recovery then a new outage is a NEW episode and alerts again", async () => {
    const status = syntheticStatus();
    createdStampTargets.push(status.target);
    const now = new Date(new Date(status.lastTickAt!).getTime() + 2 * 60 * 60_000);
    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).toHaveBeenCalledTimes(2);

    // Recovery: a later tick, then it dies again → different episode key.
    sendMock.mockClear();
    const recoveredTick = new Date(now.getTime() + 30 * 60_000).toISOString();
    const secondOutage = { ...status, lastTickAt: recoveredTick };
    const later = new Date(new Date(recoveredTick).getTime() + 3 * 60 * 60_000);
    await dispatchCronStaleAlerts(later, [secondOutage]);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(await stampsFor(status.target)).toHaveLength(2);
  });

  it("never-ticked targets anchor the episode to first_seen_at", async () => {
    const status = syntheticStatus({
      lastTickAt: null,
      neverTicked: true,
      minutesSinceLastTick: null,
      tickCount: 0,
    });
    createdStampTargets.push(status.target);
    const now = new Date(new Date(status.firstSeenAt!).getTime() + 3 * 60 * 60_000);

    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0]![0].lastTickAt).toBeNull();
    const stamps = await stampsFor(status.target);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!.staleSinceKey).toBe(status.firstSeenAt);
  });

  it("does NOT stamp when ADMIN_EMAILS is empty, so a later config still alerts", async () => {
    const status = syntheticStatus();
    createdStampTargets.push(status.target);
    const now = new Date(new Date(status.lastTickAt!).getTime() + 2 * 60 * 60_000);

    process.env.ADMIN_EMAILS = "";
    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await stampsFor(status.target)).toHaveLength(0);

    process.env.ADMIN_EMAILS = "ops@example.test";
    await dispatchCronStaleAlerts(now, [status]);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(await stampsFor(status.target)).toHaveLength(1);
  });

  it("does nothing when no targets are stale", async () => {
    const status = syntheticStatus({ stale: false });
    createdStampTargets.push(status.target);
    await dispatchCronStaleAlerts(new Date(), [status]);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await stampsFor(status.target)).toHaveLength(0);
  });
});

describe("dispatchCronFlakyAlerts (via tests-only statusesOverride seam)", () => {
  /** Synthetic FLAKY (not stale) status: ticking, but well under expected. */
  function flakyStatus(overrides: Partial<CronTargetStatus> = {}): CronTargetStatus {
    const base = syntheticStatus({
      stale: false,
      ticksLast24h: 40, // < 75% of 96
      expectedTicksLast24h: 96,
    });
    // firstSeenAt must be ≥24h before "now" for the baseline to be mature;
    // callers pass a now well after the synthetic reference.
    return { ...base, ...overrides };
  }

  function nowAfter(status: CronTargetStatus, hours: number): Date {
    return new Date(new Date(status.firstSeenAt!).getTime() + hours * 60 * 60_000);
  }

  it("alerts only after two consecutive shortfall checks, exactly once per episode", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    // First shortfall check: armed, no email yet.
    await dispatchCronFlakyAlerts(now, [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();

    // Second consecutive check: alert every admin once.
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2);
    const tos = sendFlakyMock.mock.calls.map((c) => c[0].to).sort();
    expect(tos).toEqual(["boss@example.test", "ops@example.test"]);
    const args = sendFlakyMock.mock.calls[0]![0];
    expect(args.target).toBe(status.target);
    expect(args.expectedTicks).toBe(96);
    expect(args.observedTicks).toBe(40);

    // Third check, still flaky → same episode, no repeat.
    sendFlakyMock.mockClear();
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 30 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
    const stamps = await db
      .select()
      .from(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, status.target));
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!.flakySinceKey).toBe(now.toISOString()); // anchored to first shortfall check
  });

  it("a continuing shortfall after a restart does NOT email again (durable episode state)", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2);
    sendFlakyMock.mockClear();

    // "Restart": the episode state lives in the DB, not in-process, so a
    // fresh process observing the SAME ongoing shortfall converges on the
    // same episode key and the stamp blocks a duplicate email — even after
    // many more checks.
    for (let i = 3; i <= 6; i++) {
      await dispatchCronFlakyAlerts(new Date(now.getTime() + i * 15 * 60_000), [status]);
    }
    expect(sendFlakyMock).not.toHaveBeenCalled();
    const stamps = await db
      .select()
      .from(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, status.target));
    expect(stamps).toHaveLength(1);
    const [state] = await db
      .select()
      .from(cronFlakyEpisodeStateTable)
      .where(eq(cronFlakyEpisodeStateTable.target, status.target));
    expect(state!.episodeKey).toBe(now.toISOString()); // key fixed by the FIRST observer
    expect(state!.shortfallChecks).toBe(6);
  });

  it("two instances concurrently observing the FIRST-ever shortfall count as ONE check — no email until a later interval is also flaky", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    // Two replicas boot together and both evaluate the same first shortfall
    // window: their observations collapse into a single counted check.
    await Promise.all([
      dispatchCronFlakyAlerts(now, [status]),
      dispatchCronFlakyAlerts(now, [status]),
    ]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
    let [state] = await db
      .select()
      .from(cronFlakyEpisodeStateTable)
      .where(eq(cronFlakyEpisodeStateTable.target, status.target));
    expect(state!.shortfallChecks).toBe(1);

    // Phase-shifted replicas inside the SAME absolute 15-minute bucket
    // (+1min, +8min — flakyStatus anchors `now` on a bucket boundary) still
    // don't count as a second consecutive check.
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 60_000), [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 8 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
    [state] = await db
      .select()
      .from(cronFlakyEpisodeStateTable)
      .where(eq(cronFlakyEpisodeStateTable.target, status.target));
    expect(state!.shortfallChecks).toBe(1);

    // The NEXT absolute monitor bucket is also flaky → second consecutive check → alert.
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2); // one per admin
  });

  it("concurrent instances at the threshold email only once (UNIQUE stamp race)", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);
    await dispatchCronFlakyAlerts(now, [status]); // arm (check 1)

    // Two instances run the second check simultaneously: both cross the
    // threshold with the same durable episode key; the UNIQUE stamp lets
    // only one of them send.
    const check2 = new Date(now.getTime() + 15 * 60_000);
    await Promise.all([
      dispatchCronFlakyAlerts(check2, [status]),
      dispatchCronFlakyAlerts(check2, [status]),
    ]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2); // one email per admin, once
    const stamps = await db
      .select()
      .from(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, status.target));
    expect(stamps).toHaveLength(1);
  });

  it("recovery resets the episode; a later degradation alerts again", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2);

    // Recovery: healthy count resets the episode.
    sendFlakyMock.mockClear();
    const healthy = { ...status, ticksLast24h: 90 };
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 30 * 60_000), [healthy]);
    expect(sendFlakyMock).not.toHaveBeenCalled();

    // Degrades again → new episode key, alerts again after two checks.
    const later = new Date(now.getTime() + 60 * 60_000);
    await dispatchCronFlakyAlerts(later, [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
    await dispatchCronFlakyAlerts(new Date(later.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(2);
    const stamps = await db
      .select()
      .from(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, status.target));
    expect(stamps).toHaveLength(2);
  });

  it("a single transient dip never alerts", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    await dispatchCronFlakyAlerts(now, [status]); // dip
    const healthy = { ...status, ticksLast24h: 96 };
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [healthy]); // recovered
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 30 * 60_000), [status]); // dips again (check 1 of new episode)
    expect(sendFlakyMock).not.toHaveBeenCalled();
  });

  it("does NOT stamp when ADMIN_EMAILS is empty, so a later config still alerts", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);

    process.env.ADMIN_EMAILS = "";
    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
    const noStamps = await db
      .select()
      .from(cronFlakyNotificationsTable)
      .where(eq(cronFlakyNotificationsTable.target, status.target));
    expect(noStamps).toHaveLength(0);

    process.env.ADMIN_EMAILS = "ops@example.test";
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 30 * 60_000), [status]);
    expect(sendFlakyMock).toHaveBeenCalledTimes(1);
  });

  it("skips stale targets (the dead-man's-switch alert owns those)", async () => {
    const status = flakyStatus({ stale: true });
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);
    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
  });

  it("skips targets coarser than daily (expectedTicksLast24h < 1)", async () => {
    const status = flakyStatus({ expectedTicksLast24h: 0, ticksLast24h: 0 });
    createdStampTargets.push(status.target);
    const now = nowAfter(status, 30);
    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
  });

  it("skips targets whose baseline is younger than 24h (short history window)", async () => {
    const status = flakyStatus();
    createdStampTargets.push(status.target);
    // now only 2h after firstSeenAt → the 24h count is structurally short.
    const now = nowAfter(status, 2);
    await dispatchCronFlakyAlerts(now, [status]);
    await dispatchCronFlakyAlerts(new Date(now.getTime() + 15 * 60_000), [status]);
    expect(sendFlakyMock).not.toHaveBeenCalled();
  });
});

describe("dispatchCronRecoveryAlerts (all-clear on first tick after outage)", () => {
  async function insertOpenStamp(target: string, staleSinceKey: string) {
    await db.insert(cronStaleNotificationsTable).values({
      target,
      staleSinceKey,
      overdueMinutes: 90,
    });
  }

  it("emails every admin exactly once per episode and marks the stamp recovered", async () => {
    const target = `test-target-${randomUUID()}`;
    createdStampTargets.push(target);
    const staleSince = new Date(Date.UTC(3000 + Math.floor(Math.random() * 6000), 0, 15));
    await insertOpenStamp(target, staleSince.toISOString());

    const tickAt = new Date(staleSince.getTime() + 4 * 60 * 60_000);
    await dispatchCronRecoveryAlerts(target, tickAt);

    expect(recoveredMock).toHaveBeenCalledTimes(2);
    const tos = recoveredMock.mock.calls.map((call) => call[0].to).sort();
    expect(tos).toEqual(["boss@example.test", "ops@example.test"]);
    const args = recoveredMock.mock.calls[0]![0];
    expect(args.target).toBe(target);
    expect(args.recoveredAt.toISOString()).toBe(tickAt.toISOString());
    expect(args.staleSince?.toISOString()).toBe(staleSince.toISOString());

    const stamps = await stampsFor(target);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!.recoveredNotifiedAt?.toISOString()).toBe(tickAt.toISOString());

    recoveredMock.mockClear();
    await dispatchCronRecoveryAlerts(target, new Date(tickAt.getTime() + 15 * 60_000));
    expect(recoveredMock).not.toHaveBeenCalled();
  });

  it("sends nothing when the stale alert itself was never sent", async () => {
    const target = `test-target-${randomUUID()}`;
    createdStampTargets.push(target);
    await dispatchCronRecoveryAlerts(target, new Date());
    expect(recoveredMock).not.toHaveBeenCalled();
    expect(await stampsFor(target)).toHaveLength(0);
  });

  it("does not claim a stamp while ADMIN_EMAILS is empty", async () => {
    const target = `test-target-${randomUUID()}`;
    createdStampTargets.push(target);
    const staleSince = new Date(Date.UTC(3000 + Math.floor(Math.random() * 6000), 0, 15));
    await insertOpenStamp(target, staleSince.toISOString());
    const tickAt = new Date(staleSince.getTime() + 4 * 60 * 60_000);

    process.env.ADMIN_EMAILS = "";
    await dispatchCronRecoveryAlerts(target, tickAt);
    expect(recoveredMock).not.toHaveBeenCalled();
    expect((await stampsFor(target))[0]!.recoveredNotifiedAt).toBeNull();

    process.env.ADMIN_EMAILS = "ops@example.test";
    await dispatchCronRecoveryAlerts(target, new Date(tickAt.getTime() + 15 * 60_000));
    expect(recoveredMock).toHaveBeenCalledTimes(1);
    expect((await stampsFor(target))[0]!.recoveredNotifiedAt).not.toBeNull();
  });

  it("claims all older open episodes and reports the latest anchor", async () => {
    const target = `test-target-${randomUUID()}`;
    createdStampTargets.push(target);
    const base = new Date(Date.UTC(3000 + Math.floor(Math.random() * 6000), 0, 15));
    const older = new Date(base.getTime() - 24 * 60 * 60_000);
    const future = new Date(base.getTime() + 24 * 60 * 60_000);
    await insertOpenStamp(target, older.toISOString());
    await insertOpenStamp(target, base.toISOString());
    await insertOpenStamp(target, future.toISOString());

    const tickAt = new Date(base.getTime() + 60 * 60_000);
    await dispatchCronRecoveryAlerts(target, tickAt);

    expect(recoveredMock).toHaveBeenCalledTimes(2);
    expect(recoveredMock.mock.calls[0]![0].staleSince?.toISOString()).toBe(base.toISOString());

    const stamps = await stampsFor(target);
    const byKey = new Map(stamps.map((stamp) => [stamp.staleSinceKey, stamp.recoveredNotifiedAt]));
    expect(byKey.get(older.toISOString())).not.toBeNull();
    expect(byKey.get(base.toISOString())).not.toBeNull();
    expect(byKey.get(future.toISOString())).toBeNull();
  });

  it("recordCronTick does not auto-dispatch recovery under vitest", async () => {
    const target = "sweep-cost-cap-alerts";
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    try {
      await recordCronTick(target, new Date());
      expect(recoveredMock).not.toHaveBeenCalled();
    } finally {
      if (before) {
        await db
          .update(cronTickStatusTable)
          .set({ lastTickAt: before.lastTickAt, tickCount: before.tickCount })
          .where(eq(cronTickStatusTable.target, target));
      } else {
        await db.delete(cronTickStatusTable).where(eq(cronTickStatusTable.target, target));
      }
    }
  });
});

describe("startCronHeartbeatMonitor", () => {
  it("no-ops under vitest so suites cannot stamp real targets in the shared dev DB", async () => {
    const stop = startCronHeartbeatMonitor();
    stop();
    await new Promise((r) => setTimeout(r, 50));
    expect(sendMock).not.toHaveBeenCalled();
  });
});
