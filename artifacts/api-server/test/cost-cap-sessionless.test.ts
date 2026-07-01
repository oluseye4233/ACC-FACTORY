import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { sql } from "drizzle-orm";
import { db, usersTable, harnessEngineRunsTable } from "@workspace/db";
import {
  currentMonthCostForUser,
  currentMonthCostGlobal,
} from "../src/lib/cost-budget";

// ---------------------------------------------------------------------------
// Session-less LLM spend accounting.
//
// Pre-session LLM calls (ingestion / cartridge normalisation) run before any
// harness session exists, so they record a `harness_engine_runs` row with a
// NULL session_id and a sentinel engine id. The company-wide monthly cost cap
// must still count that spend — the SUM predicate keys on user + month only,
// never on session_id, so a null-session row is included like any other.
// ---------------------------------------------------------------------------

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = "";

beforeAll(async () => {
  const [u] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_costsessionless_${stamp}`, email: `costsessionless-${stamp}@example.test` })
    .returning();
  userId = u!.id;
});

afterAll(async () => {
  // Runs cascade-delete with the user.
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
});

describe("session-less engine-run spend is metered", () => {
  test("currentMonthCostForUser counts a run with a null session id", async () => {
    // Sentinel engine id 20 = ingestion (see routes/ingest.ts).
    await db.insert(harnessEngineRunsTable).values({
      sessionId: null,
      userId,
      engineId: 20,
      modelId: "claude-sonnet-4-6",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: "0.123456",
      durationMs: 42,
    });

    const total = await currentMonthCostForUser(userId);
    expect(total).toBeCloseTo(0.123456, 6);

    // The global SUM shares the same month predicate (minus the user filter),
    // so it must be at least this user's session-less spend.
    const global = await currentMonthCostGlobal();
    expect(global).toBeGreaterThanOrEqual(0.123456);
  });
});

// ---------------------------------------------------------------------------
// /pricing is dormant in internal-staff mode.
//
// The subscription/billing surface is gated behind SUBSCRIPTIONS_ENABLED. The
// flag is read at call-time, so GET /pricing returns 503 SUBSCRIPTIONS_DISABLED
// while OFF and serves content once flipped ON — no restart needed.
// ---------------------------------------------------------------------------

function injectLog(req: Request, _res: Response, next: NextFunction): void {
  const noop = (): void => {};
  (req as unknown as { log: Record<string, unknown> }).log = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => (req as unknown as { log: unknown }).log,
  };
  next();
}

async function startApp(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no test server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

describe("GET /pricing respects SUBSCRIPTIONS_ENABLED", () => {
  const prev = process.env.SUBSCRIPTIONS_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.SUBSCRIPTIONS_ENABLED;
    else process.env.SUBSCRIPTIONS_ENABLED = prev;
  });

  test("returns 503 SUBSCRIPTIONS_DISABLED when the flag is off", async () => {
    delete process.env.SUBSCRIPTIONS_ENABLED;
    const pricingRouter = (await import("../src/routes/pricing")).default;
    const app = express();
    app.use(injectLog);
    app.use("/api", pricingRouter);
    const srv = await startApp(app);
    try {
      const res = await fetch(`${srv.url}/api/pricing`);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("SUBSCRIPTIONS_DISABLED");
    } finally {
      await srv.close();
    }
  });

  test("serves pricing content once the flag is flipped on", async () => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    const pricingRouter = (await import("../src/routes/pricing")).default;
    const app = express();
    app.use(injectLog);
    app.use("/api", pricingRouter);
    const srv = await startApp(app);
    try {
      const res = await fetch(`${srv.url}/api/pricing`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tiers?: unknown[] };
      expect(Array.isArray(body.tiers)).toBe(true);
    } finally {
      await srv.close();
    }
  });
});
