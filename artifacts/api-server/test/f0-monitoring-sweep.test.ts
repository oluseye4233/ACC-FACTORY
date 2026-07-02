import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  notificationPreferencesTable,
  f0RetainersTable,
  f0MonitoringRunsTable,
} from "@workspace/db";

// ---------- Mock @workspace/email so no mail actually leaves ----------
const sentRetainer: Array<Record<string, unknown>> = [];

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendRetainerMonitoringAlert: vi.fn(async (args: Record<string, unknown>) => {
      sentRetainer.push(args);
      return { ok: true } as unknown;
    }),
  };
});

// ---------- Mock the LLM call ----------
// The weekly sweep drives one LLM call per active retainer. Stubbing
// callLlmJson keeps the whole sweep offline and lets each test dictate exactly
// what monitoring brief comes back (breach vs. calm) without recording a cost
// row (so the cost-cap guard is never tripped by this suite).
let nextMonitoringOutput: unknown = null;

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return {
    ...actual,
    callLlmJson: vi.fn(async () => nextMonitoringOutput),
  };
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = "";
const userEmail = `f0sweep-${stamp}@example.test`;
const retainerIds: string[] = [];

const BREACH_OUTPUT = {
  capiPosture: "Slipping",
  movements: [{ summary: "Competitor moved on price", significance: "HIGH" }],
  eventAlerts: [
    { alert: "Rival launched a competing product", urgency: "ACT_NOW", recommendedAction: "Respond this week" },
    { alert: "Pricing pressure building", urgency: "ACT_SOON", recommendedAction: "Review pricing" },
    { alert: "Minor forum chatter", urgency: "WATCH", recommendedAction: "Keep watching" },
  ],
  weeklyCounsel: "Move fast on positioning.",
};

const CALM_OUTPUT = {
  capiPosture: "Stable",
  movements: [{ summary: "Nothing material this week", significance: "LOW" }],
  eventAlerts: [{ alert: "Minor chatter", urgency: "WATCH", recommendedAction: "Keep watching" }],
  weeklyCounsel: "Hold steady.",
};

async function seedRetainer(title: string): Promise<string> {
  const [r] = await db
    .insert(f0RetainersTable)
    .values({ userId, title, status: "ACTIVE" })
    .returning();
  retainerIds.push(r!.id);
  return r!.id;
}

async function runsFor(retainerId: string) {
  return db
    .select()
    .from(f0MonitoringRunsTable)
    .where(eq(f0MonitoringRunsTable.retainerId, retainerId))
    .orderBy(f0MonitoringRunsTable.createdAt);
}

function emailsFor(title: string) {
  return sentRetainer.filter((e) => e.retainerTitle === title);
}

beforeAll(async () => {
  const [u] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_f0sweep_${stamp}`, email: userEmail })
    .returning();
  userId = u!.id;
});

afterAll(async () => {
  for (const id of retainerIds) {
    await db.delete(f0MonitoringRunsTable).where(eq(f0MonitoringRunsTable.retainerId, id));
    await db.delete(f0RetainersTable).where(eq(f0RetainersTable.id, id));
  }
  await db
    .delete(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
});

beforeEach(async () => {
  sentRetainer.length = 0;
  nextMonitoringOutput = null;
  // Retire retainers seeded by earlier tests so each test's sweep only touches
  // the single ACTIVE retainer it creates.
  if (retainerIds.length) {
    await db
      .update(f0RetainersTable)
      .set({ status: "ENDED" })
      .where(inArray(f0RetainersTable.id, retainerIds));
  }
  // Reset notification prefs to the default (retainer alerts enabled).
  await db
    .delete(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
});

describe("runF0MonitoringSweep", () => {
  test("persists a cron run and emails the owner on a breach", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const title = `Sweep breach ${stamp}`;
    const id = await seedRetainer(title);
    nextMonitoringOutput = BREACH_OUTPUT;

    const result = await runF0MonitoringSweep();

    const runs = await runsFor(id);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.source).toBe("cron");
    expect(runs[0]!.breached).toBe(true);
    expect(runs[0]!.highestUrgency).toBe("ACT_NOW");
    expect(runs[0]!.notifiedAt).not.toBeNull();

    const mine = emailsFor(title);
    expect(mine).toHaveLength(1);
    // Only actionable alerts (ACT_SOON / ACT_NOW) ride the email; WATCH is dropped.
    expect((mine[0]!.alerts as unknown[]).length).toBe(2);
    expect(mine[0]!.highestUrgency).toBe("ACT_NOW");

    expect(result.breaches).toBeGreaterThanOrEqual(1);
    expect(result.alertsSent).toBeGreaterThanOrEqual(1);
  });

  test("persists a calm run without emailing", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const title = `Sweep calm ${stamp}`;
    const id = await seedRetainer(title);
    nextMonitoringOutput = CALM_OUTPUT;

    await runF0MonitoringSweep();

    const runs = await runsFor(id);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.source).toBe("cron");
    expect(runs[0]!.breached).toBe(false);
    expect(runs[0]!.highestUrgency).toBe("WATCH");
    expect(runs[0]!.notifiedAt).toBeNull();

    expect(emailsFor(title)).toHaveLength(0);
  });

  test("suppresses the breach email when the owner disabled retainer alerts", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const { getOrCreatePreferences } = await import("../src/lib/notifications");
    const prefs = await getOrCreatePreferences(userId, null);
    await db
      .update(notificationPreferencesTable)
      .set({ retainerAlertsEnabled: false })
      .where(eq(notificationPreferencesTable.id, prefs.id));

    const title = `Sweep muted ${stamp}`;
    const id = await seedRetainer(title);
    nextMonitoringOutput = BREACH_OUTPUT;

    await runF0MonitoringSweep();

    const runs = await runsFor(id);
    // The breach is still persisted (surfaces as an OPEN dashboard alert)...
    expect(runs).toHaveLength(1);
    expect(runs[0]!.breached).toBe(true);
    // ...but no email is sent and notifiedAt stays null.
    expect(runs[0]!.notifiedAt).toBeNull();
    expect(emailsFor(title)).toHaveLength(0);
  });

  test("skips a retainer already swept within the last 6 days", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const title = `Sweep skip ${stamp}`;
    const id = await seedRetainer(title);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.insert(f0MonitoringRunsTable).values({
      retainerId: id,
      userId,
      content: CALM_OUTPUT,
      source: "cron",
      breached: false,
      createdAt: twoDaysAgo,
    });
    nextMonitoringOutput = BREACH_OUTPUT;

    const result = await runF0MonitoringSweep();

    const runs = await runsFor(id);
    expect(runs).toHaveLength(1); // no new run added
    expect(result.skippedRecent).toBeGreaterThanOrEqual(1);
    expect(emailsFor(title)).toHaveLength(0);
  });

  test("re-runs a retainer whose last cron run is older than 6 days", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const title = `Sweep rerun ${stamp}`;
    const id = await seedRetainer(title);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(f0MonitoringRunsTable).values({
      retainerId: id,
      userId,
      content: CALM_OUTPUT,
      source: "cron",
      breached: false,
      createdAt: eightDaysAgo,
    });
    nextMonitoringOutput = BREACH_OUTPUT;

    await runF0MonitoringSweep();

    const runs = await runsFor(id);
    expect(runs).toHaveLength(2); // fresh run appended
    const latest = runs[runs.length - 1]!;
    expect(latest.breached).toBe(true);
    expect(latest.notifiedAt).not.toBeNull();
    expect(emailsFor(title)).toHaveLength(1);
  });
});
