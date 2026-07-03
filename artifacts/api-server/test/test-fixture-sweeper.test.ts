/**
 * Dev-only periodic test-fixture sweeper (`src/lib/test-fixture-sweeper.ts`).
 *
 * Verifies the three "done looks like" properties of the in-process sweep:
 *  1. Stale `@example.test` fixtures (older than the 60-minute guard) are
 *     deleted, while fresh fixtures — a suite that could be mid-flight — are
 *     never raced.
 *  2. The sweeper never starts in production (`NODE_ENV === "production"`).
 *  3. Failures are log-and-continue: a throwing sweep must resolve without
 *     rejecting so it can never crash the server.
 */
import { describe, test, expect, afterAll, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";

// ---------- Mock the pino singleton ----------
// The failure-path test trips logger.warn ON PURPOSE; capturing it keeps the
// intentional error out of the shared worker stdout (where vitest would
// interleave it into another suite's output) and makes it assertable.
const loggerWarns = vi.fn();
const loggerInfos = vi.fn();

vi.mock("../src/lib/logger", () => {
  const noop = (): void => {};
  const fake = {
    info: loggerInfos,
    warn: loggerWarns,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: (): unknown => fake,
  };
  return { logger: fake };
});

// ---------- Controllable failure injection for the shared sweep ----------
// Delegates to the real `sweepStaleTestFixtures` by default so the deletion
// test exercises the genuine shared query logic; the failure-path test flips
// `forceSweepError` to prove the sweeper survives a broken sweep.
let forceSweepError: Error | null = null;

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    sweepStaleTestFixtures: async (
      ...args: Parameters<typeof actual.sweepStaleTestFixtures>
    ) => {
      if (forceSweepError) throw forceSweepError;
      return actual.sweepStaleTestFixtures(...args);
    },
  };
});

const { db, usersTable } = await import("@workspace/db");
const { runTestFixtureSweepOnce, startTestFixtureSweeper } = await import(
  "../src/lib/test-fixture-sweeper"
);

const seededUserIds: string[] = [];

async function seedTestUser(ageMinutes: number): Promise<string> {
  const suffix = randomUUID();
  const [row] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `sweeper-test-${suffix}`,
      email: `sweeper-${suffix}@example.test`,
      displayName: "Sweeper Fixture",
      createdAt: new Date(Date.now() - ageMinutes * 60_000),
    })
    .returning({ id: usersTable.id });
  const id = row!.id;
  seededUserIds.push(id);
  return id;
}

async function userExists(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, [id]));
  return rows.length > 0;
}

afterAll(async () => {
  if (seededUserIds.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, seededUserIds));
  }
});

beforeEach(() => {
  forceSweepError = null;
  loggerWarns.mockClear();
  loggerInfos.mockClear();
});

describe("runTestFixtureSweepOnce", () => {
  test("deletes stale @example.test fixtures but never fresh ones", async () => {
    const staleId = await seedTestUser(120); // 2h old — past the 60-min guard
    const freshId = await seedTestUser(0); // just created — could be a live suite

    await runTestFixtureSweepOnce();

    expect(await userExists(staleId)).toBe(false);
    expect(await userExists(freshId)).toBe(true);
  });

  test("a throwing sweep resolves (log-and-continue) and recovers on the next tick", async () => {
    forceSweepError = new Error("simulated DB outage");

    await expect(runTestFixtureSweepOnce()).resolves.toBeUndefined();
    expect(loggerWarns).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining("sweep failed"),
    );

    // Next tick recovers: the in-flight latch must have been released.
    forceSweepError = null;
    const staleId = await seedTestUser(120);
    await runTestFixtureSweepOnce();
    expect(await userExists(staleId)).toBe(false);
  });
});

describe("startTestFixtureSweeper", () => {
  test("is a no-op in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const stop = startTestFixtureSweeper();
      stop();
      expect(loggerInfos).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  test("starts (and can be stopped) outside production", () => {
    const stop = startTestFixtureSweeper();
    try {
      expect(loggerInfos).toHaveBeenCalledWith(
        expect.objectContaining({ intervalMinutes: expect.any(Number) }),
        expect.stringContaining("periodic test-fixture sweep started"),
      );
    } finally {
      stop();
    }
  });
});
