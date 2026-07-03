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
import { eq, inArray } from "drizzle-orm";
import {
  db,
  cronTickStatusTable,
  cronStaleNotificationsTable,
} from "@workspace/db";

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendCronTargetStaleAlert: vi.fn(async () => ({ ok: true as const, id: "test" })),
  };
});

import { sendCronTargetStaleAlert } from "@workspace/email";
import {
  CRON_TARGET_CONFIGS,
  type CronTargetStatus,
  dispatchCronStaleAlerts,
  ensureCronTargetsSeeded,
  getCronTargetStatuses,
  recordCronTick,
  startCronHeartbeatMonitor,
} from "../src/lib/cron-heartbeat";

const sendMock = vi.mocked(sendCronTargetStaleAlert);

const createdStampTargets: string[] = [];
let prevAdminEmails: string | undefined;

beforeEach(() => {
  sendMock.mockClear();
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
    ...overrides,
  };
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
    try {
      const t0 = new Date();
      await recordCronTick(target, t0);
      const statuses = await getCronTargetStatuses(new Date(t0.getTime() + 60_000));
      const s = statuses.find((x) => x.target === target)!;
      expect(s.lastTickAt).toBe(t0.toISOString());
      expect(s.neverTicked).toBe(false);
      expect(s.minutesSinceLastTick).toBe(1);
      expect(s.stale).toBe(false);
      expect(s.tickCount).toBeGreaterThanOrEqual(1);

      // Second tick increments the counter and moves the timestamp.
      const t1 = new Date(t0.getTime() + 5_000);
      await recordCronTick(target, t1);
      const after = await getCronTargetStatuses(new Date(t1.getTime() + 60_000));
      const s2 = after.find((x) => x.target === target)!;
      expect(s2.lastTickAt).toBe(t1.toISOString());
      expect(s2.tickCount).toBe(s.tickCount + 1);
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

  it("flags a target stale once past its window, and never-ticked targets use first_seen_at", async () => {
    const target = "reset-harness-limits";
    const [before] = await db
      .select()
      .from(cronTickStatusTable)
      .where(eq(cronTickStatusTable.target, target));
    try {
      const t0 = new Date();
      await recordCronTick(target, t0);
      const cfg = CRON_TARGET_CONFIGS.find((c) => c.target === target)!;
      const justUnder = new Date(t0.getTime() + cfg.staleAfterMinutes * 60_000);
      const justOver = new Date(t0.getTime() + (cfg.staleAfterMinutes + 1) * 60_000);

      const fresh = (await getCronTargetStatuses(justUnder)).find((x) => x.target === target)!;
      expect(fresh.stale).toBe(false);
      const overdue = (await getCronTargetStatuses(justOver)).find((x) => x.target === target)!;
      expect(overdue.stale).toBe(true);
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

describe("startCronHeartbeatMonitor", () => {
  it("no-ops under vitest so suites cannot stamp real targets in the shared dev DB", async () => {
    const stop = startCronHeartbeatMonitor();
    stop();
    await new Promise((r) => setTimeout(r, 50));
    expect(sendMock).not.toHaveBeenCalled();
  });
});
