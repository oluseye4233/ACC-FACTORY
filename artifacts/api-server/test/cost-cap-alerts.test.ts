// Company cost-cap threshold alert dispatcher (Task: email admins when
// company LLM spend nears the monthly cap).
//
// Exercises `dispatchCostCapAlerts` directly (the hot-path wrapper
// `maybeDispatchCostCapAlerts` intentionally no-ops under vitest so suites
// that shrink the cap to force 402s cannot stamp the REAL current month in
// the shared dev DB and suppress a genuine production alert).
//
// Isolation: every test uses its own randomised far-future UTC month so
// concurrent/killed runs never collide on the UNIQUE (month, threshold)
// index (never seed a fixed constant into a unique column). Rows are cleaned
// up per test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, costCapNotificationsTable } from "@workspace/db";

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendCostCapThresholdAlert: vi.fn(async () => ({ ok: true as const, id: "test" })),
  };
});

import { sendCostCapThresholdAlert } from "@workspace/email";
import {
  adminAlertEmails,
  dispatchCostCapAlerts,
  maybeDispatchCostCapAlerts,
} from "../src/lib/cost-cap-alerts";

const sendMock = vi.mocked(sendCostCapThresholdAlert);

/**
 * A unique far-future month per test: no cross-run unique-index collisions.
 * Year stays 4-digit — toISOString() switches to a `+YYYYYY-` prefix past
 * 9999, which would break the `slice(0, 7)` month key.
 */
function randomFutureNow(): { now: Date; month: string } {
  const year = 3000 + Math.floor(Math.random() * 6000);
  const monthIdx = Math.floor(Math.random() * 12);
  const now = new Date(Date.UTC(year, monthIdx, 15, 12, 0, 0));
  return { now, month: now.toISOString().slice(0, 7) };
}

const createdMonths: string[] = [];
let prevAdminEmails: string | undefined;

beforeEach(() => {
  sendMock.mockClear();
  prevAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "ops@example.test, boss@example.test";
});

afterEach(async () => {
  if (prevAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = prevAdminEmails;
  while (createdMonths.length > 0) {
    const month = createdMonths.pop()!;
    await db
      .delete(costCapNotificationsTable)
      .where(eq(costCapNotificationsTable.month, month));
  }
});

async function rowsForMonth(month: string) {
  return db
    .select()
    .from(costCapNotificationsTable)
    .where(eq(costCapNotificationsTable.month, month));
}

describe("adminAlertEmails", () => {
  it("parses the comma-separated allowlist and drops junk", () => {
    process.env.ADMIN_EMAILS = " a@x.test ,, not-an-email , b@y.test ";
    expect(adminAlertEmails()).toEqual(["a@x.test", "b@y.test"]);
    process.env.ADMIN_EMAILS = "";
    expect(adminAlertEmails()).toEqual([]);
  });
});

describe("dispatchCostCapAlerts", () => {
  it("does nothing below 80%", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);
    await dispatchCostCapAlerts(790, 1000, now);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await rowsForMonth(month)).toHaveLength(0);
  });

  it("emails every admin once when 80% is first crossed, and never repeats", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);

    await dispatchCostCapAlerts(810, 1000, now);
    expect(sendMock).toHaveBeenCalledTimes(2); // one per admin
    const tos = sendMock.mock.calls.map((c) => c[0].to).sort();
    expect(tos).toEqual(["boss@example.test", "ops@example.test"]);
    const args = sendMock.mock.calls[0]![0];
    expect(args.thresholdPercent).toBe(80);
    expect(args.usedUsd).toBe(810);
    expect(args.capUsd).toBe(1000);
    expect(args.percentUsed).toBeCloseTo(81);
    // Resets at the start of the NEXT UTC month.
    expect(args.resetsAt.toISOString()).toBe(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    );

    // Same month, higher spend but same threshold band → no repeat.
    sendMock.mockClear();
    await dispatchCostCapAlerts(900, 1000, now);
    expect(sendMock).not.toHaveBeenCalled();

    const rows = await rowsForMonth(month);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.thresholdPercent).toBe(80);
  });

  it("sends each threshold exactly once as spend climbs through 95% and 100%", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);

    await dispatchCostCapAlerts(850, 1000, now); // 80 only
    await dispatchCostCapAlerts(960, 1000, now); // 95 (80 already stamped)
    await dispatchCostCapAlerts(1200, 1000, now); // 100 (80+95 already stamped)
    await dispatchCostCapAlerts(1500, 1000, now); // nothing new

    // 3 thresholds × 2 admins.
    expect(sendMock).toHaveBeenCalledTimes(6);
    const thresholds = sendMock.mock.calls.map((c) => c[0].thresholdPercent).sort((a, b) => a - b);
    expect(thresholds).toEqual([80, 80, 95, 95, 100, 100]);

    const rows = await rowsForMonth(month);
    expect(rows.map((r) => r.thresholdPercent).sort((a, b) => a - b)).toEqual([80, 95, 100]);
  });

  it("stamps all crossed thresholds at once when spend jumps straight past the cap", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);

    await dispatchCostCapAlerts(2000, 1000, now);
    expect(sendMock).toHaveBeenCalledTimes(6); // 80, 95, 100 × 2 admins
    expect((await rowsForMonth(month)).map((r) => r.thresholdPercent).sort((a, b) => a - b)).toEqual(
      [80, 95, 100],
    );
  });

  it("a new month starts fresh — thresholds fire again", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);
    await dispatchCostCapAlerts(900, 1000, now);
    expect(sendMock).toHaveBeenCalledTimes(2);

    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
    createdMonths.push(nextMonth.toISOString().slice(0, 7));
    sendMock.mockClear();
    await dispatchCostCapAlerts(900, 1000, nextMonth);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT stamp the month when ADMIN_EMAILS is empty, so a later config still alerts", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);

    process.env.ADMIN_EMAILS = "";
    await dispatchCostCapAlerts(850, 1000, now);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await rowsForMonth(month)).toHaveLength(0);

    process.env.ADMIN_EMAILS = "ops@example.test";
    await dispatchCostCapAlerts(850, 1000, now);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(await rowsForMonth(month)).toHaveLength(1);
  });

  it("ignores nonsense caps", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);
    await dispatchCostCapAlerts(100, 0, now);
    await dispatchCostCapAlerts(Number.NaN, 1000, now);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await rowsForMonth(month)).toHaveLength(0);
  });

  it("records audit values (used/cap at dispatch time) on the stamp row", async () => {
    const { now, month } = randomFutureNow();
    createdMonths.push(month);
    await dispatchCostCapAlerts(812.345678, 1000, now);
    const rows = await rowsForMonth(month);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.usedUsd)).toBeCloseTo(812.345678, 5);
    expect(Number(rows[0]!.capUsd)).toBe(1000);
  });
});

describe("maybeDispatchCostCapAlerts (hot-path wrapper)", () => {
  it("no-ops under vitest so cap-shrinking suites cannot stamp the real month", async () => {
    maybeDispatchCostCapAlerts(999999, 1);
    // Give any (unexpected) async dispatch a tick to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(sendMock).not.toHaveBeenCalled();
  });
});
