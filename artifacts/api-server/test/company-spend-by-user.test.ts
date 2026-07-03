import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
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
// GET /api/me/company-spend/by-user — who is consuming the shared budget.
//
// The per-user rows must come from the exact same current-UTC-month SUM over
// harness_engine_runs.cost_usd that the company-wide meter uses, grouped by
// user and sorted by spend (highest first). Because the dev DB is shared with
// other suites, assertions target OUR seeded users' rows rather than the
// global shape of the response.
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
let bigSpenderId = "";
let smallSpenderId = "";
let noNameUserId = "";
let app: Express;
let server: Server;
let baseUrl = "";

interface UserRow {
  userId: string;
  displayName: string;
  email: string | null;
  costUsd: number;
  runs: number;
  sharePercent: number;
}
interface ByUserBody {
  totalUsd: number;
  capUsd: number;
  monthResetsAt: string;
  users: UserRow[];
}

beforeAll(async () => {
  const [big] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_spendbyuser_big_${stamp}`,
      email: `spendbyuser-big-${stamp}@example.test`,
      displayName: "Big Spender",
    })
    .returning();
  bigSpenderId = big!.id;
  const [small] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_spendbyuser_small_${stamp}`,
      email: `spendbyuser-small-${stamp}@example.test`,
      displayName: "Small Spender",
    })
    .returning();
  smallSpenderId = small!.id;
  // No display name — endpoint must fall back to email.
  const [anon] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_spendbyuser_anon_${stamp}`,
      email: `spendbyuser-anon-${stamp}@example.test`,
    })
    .returning();
  noNameUserId = anon!.id;

  // Big: two runs totalling $3, incl. a session-less (pre-session) row —
  // those must still count. Small: one $1 run. Anon: one $0.50 run.
  await db.insert(harnessEngineRunsTable).values([
    {
      sessionId: null,
      userId: bigSpenderId,
      engineId: 1,
      modelId: "claude-sonnet-4-6",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: "2.000000",
      durationMs: 42,
    },
    {
      sessionId: null,
      userId: bigSpenderId,
      engineId: 2,
      modelId: "claude-sonnet-4-6",
      inputTokens: 500,
      outputTokens: 250,
      costUsd: "1.000000",
      durationMs: 21,
    },
    {
      sessionId: null,
      userId: smallSpenderId,
      engineId: 1,
      modelId: "claude-sonnet-4-6",
      inputTokens: 300,
      outputTokens: 100,
      costUsd: "1.000000",
      durationMs: 13,
    },
    {
      sessionId: null,
      userId: noNameUserId,
      engineId: 1,
      modelId: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: "0.500000",
      durationMs: 9,
    },
  ]);

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
  // Runs cascade-delete with the users.
  await db.execute(
    sql`DELETE FROM users WHERE id IN (${bigSpenderId}, ${smallSpenderId}, ${noNameUserId})`,
  );
});

async function getByUser(): Promise<ByUserBody> {
  const res = await fetch(`${baseUrl}/me/company-spend/by-user`, {
    headers: { "x-test-user-id": smallSpenderId },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as ByUserBody;
}

describe("GET /me/company-spend/by-user", () => {
  test("lists each user's month-to-date cost + run count, sorted by spend desc", async () => {
    const body = await getByUser();

    const big = body.users.find((u) => u.userId === bigSpenderId);
    const small = body.users.find((u) => u.userId === smallSpenderId);
    const anon = body.users.find((u) => u.userId === noNameUserId);
    expect(big).toBeDefined();
    expect(small).toBeDefined();
    expect(anon).toBeDefined();

    expect(big!.costUsd).toBeCloseTo(3, 6);
    expect(big!.runs).toBe(2);
    expect(big!.displayName).toBe("Big Spender");
    expect(small!.costUsd).toBeCloseTo(1, 6);
    expect(small!.runs).toBe(1);
    expect(anon!.costUsd).toBeCloseTo(0.5, 6);

    // Sorted by spend, highest first — our big spender must come before the
    // small one, which must come before the anon user.
    const idxBig = body.users.findIndex((u) => u.userId === bigSpenderId);
    const idxSmall = body.users.findIndex((u) => u.userId === smallSpenderId);
    const idxAnon = body.users.findIndex((u) => u.userId === noNameUserId);
    expect(idxBig).toBeLessThan(idxSmall);
    expect(idxSmall).toBeLessThan(idxAnon);
    // Whole list is non-increasing by cost.
    for (let i = 1; i < body.users.length; i++) {
      expect(body.users[i - 1]!.costUsd).toBeGreaterThanOrEqual(body.users[i]!.costUsd);
    }
  });

  test("rows sum to the company-wide total and shares add to ~100%", async () => {
    const body = await getByUser();
    const rowSum = body.users.reduce((s, u) => s + u.costUsd, 0);
    expect(Math.abs(rowSum - body.totalUsd)).toBeLessThan(0.000001);

    // Same SUM the company-wide meter / 402 gate use (allow a whisker for
    // concurrent suites writing runs between the two reads).
    const { currentMonthCostGlobal, globalMonthlyCostCapUsd } = await import(
      "../src/lib/cost-budget"
    );
    const gateUsed = await currentMonthCostGlobal();
    expect(Math.abs(body.totalUsd - gateUsed)).toBeLessThan(0.05);
    expect(body.capUsd).toBe(globalMonthlyCostCapUsd());

    const shareSum = body.users.reduce((s, u) => s + u.sharePercent, 0);
    expect(Math.abs(shareSum - 100)).toBeLessThan(0.01);
  });

  test("falls back to email when a user has no display name", async () => {
    const body = await getByUser();
    const anon = body.users.find((u) => u.userId === noNameUserId);
    expect(anon!.displayName).toBe(`spendbyuser-anon-${stamp}@example.test`);
  });

  test("rejects unauthenticated callers", async () => {
    const res = await fetch(`${baseUrl}/me/company-spend/by-user`);
    expect(res.status).toBe(401);
  });
});
