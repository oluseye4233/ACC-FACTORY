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

const llmCalls = vi.fn(async () => nextMonitoringOutput);

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return {
    ...actual,
    callLlmJson: llmCalls,
  };
});

// ---------- Mock the company-wide cost-cap probe ----------
// The sweep checks currentMonthCostGlobal() against globalMonthlyCostCapUsd()
// before every LLM call and halts the loop once used >= cap. Defaults here
// never trip the guard (used 0 vs cap 1000) so the other tests are unaffected;
// the cost-cap tests below override these knobs.
let mockedCapUsd = 1000;
let mockedUsedUsd = 0;

vi.mock("../src/lib/cost-budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/cost-budget")>();
  return {
    ...actual,
    globalMonthlyCostCapUsd: vi.fn(() => mockedCapUsd),
    currentMonthCostGlobal: vi.fn(async () => mockedUsedUsd),
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
  mockedCapUsd = 1000;
  mockedUsedUsd = 0;
  llmCalls.mockClear();
  // Restore the knob-driven default in case a test replaced the
  // implementation via mockResolvedValue/mockResolvedValueOnce.
  const costBudget = await import("../src/lib/cost-budget");
  vi.mocked(costBudget.currentMonthCostGlobal).mockImplementation(async () => mockedUsedUsd);
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

  test("halts before any LLM call when spend already meets the cost cap", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const titleA = `Sweep cap A ${stamp}`;
    const titleB = `Sweep cap B ${stamp}`;
    const idA = await seedRetainer(titleA);
    const idB = await seedRetainer(titleB);
    nextMonitoringOutput = BREACH_OUTPUT;
    mockedCapUsd = 50;
    mockedUsedUsd = 50; // at the cap — guard trips on used >= cap

    const result = await runF0MonitoringSweep();

    expect(result.costCapReached).toBe(true);
    expect(result.retainersConsidered).toBe(2);
    expect(result.runsExecuted).toBe(0);
    expect(result.breaches).toBe(0);
    expect(result.alertsSent).toBe(0);
    // The loop broke before the first LLM call: no runs persisted, no spend.
    expect(llmCalls).not.toHaveBeenCalled();
    expect(await runsFor(idA)).toHaveLength(0);
    expect(await runsFor(idB)).toHaveLength(0);
    expect(emailsFor(titleA)).toHaveLength(0);
    expect(emailsFor(titleB)).toHaveLength(0);
  });

  test("stops mid-sweep once spend crosses the cap between retainers", async () => {
    const { runF0MonitoringSweep } = await import("../src/engines/f0");
    const costBudget = await import("../src/lib/cost-budget");
    const titleFirst = `Sweep cap mid A ${stamp}`;
    const titleSecond = `Sweep cap mid B ${stamp}`;
    const idFirst = await seedRetainer(titleFirst);
    const idSecond = await seedRetainer(titleSecond);
    nextMonitoringOutput = CALM_OUTPUT;
    mockedCapUsd = 50;
    // First probe is under the cap; the first retainer's run pushes spend to
    // the ceiling, so the probe before the second retainer trips the guard.
    vi.mocked(costBudget.currentMonthCostGlobal)
      .mockResolvedValueOnce(49)
      .mockResolvedValue(50);

    const result = await runF0MonitoringSweep();

    expect(result.costCapReached).toBe(true);
    expect(result.retainersConsidered).toBe(2);
    expect(result.runsExecuted).toBe(1);
    expect(llmCalls).toHaveBeenCalledTimes(1);
    // Retainers are swept in createdAt order: the first ran, the second never started.
    expect(await runsFor(idFirst)).toHaveLength(1);
    expect(await runsFor(idSecond)).toHaveLength(0);
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
