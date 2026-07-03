import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Server } from "node:http";
import { sql } from "drizzle-orm";
import { db, usersTable, harnessEngineRunsTable } from "@workspace/db";

// ---------------------------------------------------------------------------
// GET /api/me/company-spend — the staff-facing spend meter.
//
// The whole point of the endpoint is that its numbers MUST match the
// requireCostBudget gate's own 402 decision: same global SUM over
// harness_engine_runs.cost_usd for the current UTC month, same
// STAFF_MONTHLY_COST_CAP_USD cap. These tests pin that equivalence plus the
// warnLevel thresholds (ok < 80% <= warn < 95% <= critical < blocked) that
// drive the front-end banner.
// ---------------------------------------------------------------------------

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { db: d, usersTable: u } = await import("@workspace/db");
    const { eq: e } = await import("drizzle-orm");
    const headerVal = req.headers["x-test-user-id"];
    const uid = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!uid) {
      res.status(401).json({ error: "test user header missing" });
      return;
    }
    const [user] = await d.select().from(u).where(e(u.id, uid)).limit(1);
    if (!user) {
      res.status(401).json({ error: "test user not found" });
      return;
    }
    req.localUser = user;
    next();
  };
  return { ...actual, requireAuth };
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = "";
let app: Express;
let server: Server;
let baseUrl = "";

const CAP_ENV = "STAFF_MONTHLY_COST_CAP_USD";
const capSnapshot = process.env[CAP_ENV];

beforeAll(async () => {
  const [u] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_companyspend_${stamp}`,
      email: `companyspend-${stamp}@example.test`,
    })
    .returning();
  userId = u!.id;

  // A known run row so the global month SUM is strictly positive even on an
  // otherwise-empty DB — lets the threshold cases derive caps from usedUsd.
  await db.insert(harnessEngineRunsTable).values({
    sessionId: null,
    userId,
    engineId: 1,
    modelId: "claude-sonnet-4-6",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: "1.000000",
    durationMs: 42,
  });

  const { default: costRouter } = await import("../src/routes/cost");
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;
    next();
  });
  app.use(costRouter);

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Runs cascade-delete with the user.
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
});

afterEach(() => {
  if (capSnapshot === undefined) delete process.env[CAP_ENV];
  else process.env[CAP_ENV] = capSnapshot;
});

async function getSpend(capUsd?: number) {
  if (capUsd !== undefined) process.env[CAP_ENV] = String(capUsd);
  const res = await fetch(`${baseUrl}/me/company-spend`, {
    headers: { "x-test-user-id": userId },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    usedUsd: number;
    capUsd: number;
    percentUsed: number;
    overCap: boolean;
    warnLevel: "ok" | "warn" | "critical" | "blocked";
    monthResetsAt: string;
    alertsSent: Array<{ thresholdPercent: number; sentAt: string }>;
  };
}

describe("GET /me/company-spend", () => {
  test("matches the enforcement gate's own numbers (same SUM, same cap)", async () => {
    const { currentMonthCostGlobal, globalMonthlyCostCapUsd } = await import(
      "../src/lib/cost-budget"
    );
    const body = await getSpend();
    const gateUsed = await currentMonthCostGlobal();
    const gateCap = globalMonthlyCostCapUsd();
    // Same SUM (allow a whisker for concurrent suites writing runs to the
    // shared dev DB between the two reads).
    expect(Math.abs(body.usedUsd - gateUsed)).toBeLessThan(0.05);
    expect(body.capUsd).toBe(gateCap);
    expect(body.usedUsd).toBeGreaterThanOrEqual(1); // our seeded run
    // First instant of next UTC month.
    const reset = new Date(body.monthResetsAt);
    expect(reset.getUTCDate()).toBe(1);
    expect(reset.getUTCHours()).toBe(0);
    expect(reset.getTime()).toBeGreaterThan(Date.now());
  });

  test("warnLevel=ok below 80%", async () => {
    const { usedUsd } = await getSpend();
    const body = await getSpend(usedUsd / 0.5); // 50% used
    expect(body.warnLevel).toBe("ok");
    expect(body.overCap).toBe(false);
    expect(body.percentUsed).toBeLessThan(80);
  });

  test("warnLevel=warn at >=80%", async () => {
    const { usedUsd } = await getSpend();
    const body = await getSpend(usedUsd / 0.85); // 85% used
    expect(body.warnLevel).toBe("warn");
    expect(body.overCap).toBe(false);
    expect(body.percentUsed).toBeGreaterThanOrEqual(80);
    expect(body.percentUsed).toBeLessThan(95);
  });

  test("warnLevel=critical at >=95%", async () => {
    const { usedUsd } = await getSpend();
    const body = await getSpend(usedUsd / 0.97); // 97% used
    expect(body.warnLevel).toBe("critical");
    expect(body.overCap).toBe(false);
    expect(body.percentUsed).toBeGreaterThanOrEqual(95);
  });

  test("warnLevel=blocked once the cap is reached — the exact condition the 402 gate uses", async () => {
    const { usedUsd } = await getSpend();
    const body = await getSpend(Math.max(0.01, usedUsd * 0.5)); // cap below spend
    expect(body.warnLevel).toBe("blocked");
    expect(body.overCap).toBe(true);
    expect(body.percentUsed).toBe(100);
  });

  test("rejects unauthenticated callers", async () => {
    const res = await fetch(`${baseUrl}/me/company-spend`);
    expect(res.status).toBe(401);
  });

  test("alertsSent mirrors this month's cost_cap_notifications stamps", async () => {
    const { costCapNotificationsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const month = new Date().toISOString().slice(0, 7);

    // Snapshot what's already stamped this month on the shared dev DB —
    // the endpoint must return exactly the stamped rows, ordered ascending.
    const before = await getSpend();
    expect(Array.isArray(before.alertsSent)).toBe(true);
    const preexisting = new Set(before.alertsSent.map((a) => a.thresholdPercent));
    for (const a of before.alertsSent) {
      expect([80, 95, 100]).toContain(a.thresholdPercent);
      expect(Number.isNaN(new Date(a.sentAt).getTime())).toBe(false);
    }

    // Pick a threshold not yet stamped this month; if all three are stamped
    // (real spend crossed 100% on the shared dev DB) the mirror property is
    // already fully exercised by the snapshot assertions above.
    const free = [80, 95, 100].find((t) => !preexisting.has(t));
    if (free === undefined) return;

    const inserted = await db
      .insert(costCapNotificationsTable)
      .values({ month, thresholdPercent: free, usedUsd: "1.000000", capUsd: "100.00" })
      .onConflictDoNothing()
      .returning({ id: costCapNotificationsTable.id });
    try {
      const after = await getSpend();
      const mine = after.alertsSent.find((a) => a.thresholdPercent === free);
      expect(mine).toBeDefined();
      expect(Number.isNaN(new Date(mine!.sentAt).getTime())).toBe(false);
      // Ascending by threshold.
      const thresholds = after.alertsSent.map((a) => a.thresholdPercent);
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    } finally {
      // Remove only the row this test created so a genuine production stamp
      // for the real month is never deleted (exactly-once must survive tests).
      if (inserted[0]) {
        await db
          .delete(costCapNotificationsTable)
          .where(
            and(
              eq(costCapNotificationsTable.id, inserted[0].id),
              eq(costCapNotificationsTable.month, month),
            ),
          );
      }
    }
  });
});
