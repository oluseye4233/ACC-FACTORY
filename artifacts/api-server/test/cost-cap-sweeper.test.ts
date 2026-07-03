/**
 * Periodic cost-cap alert sweep (`src/lib/cost-cap-sweeper.ts`).
 *
 * Verifies the "done looks like" properties of the sweep:
 *  1. A tick reads the live company-wide month spend + cap and hands them to
 *     the exactly-once dispatcher (so a threshold crossing is emailed within
 *     ~15 minutes even with zero portal traffic — the dispatcher's UNIQUE
 *     stamp keeps exactly-once across restarts and duplicate instances).
 *  2. The sweeper never starts under vitest (a tick against the shared dev
 *     DB could stamp the REAL current month and suppress a genuine alert).
 *  3. Failures are log-and-continue: a throwing spend lookup must resolve
 *     without rejecting, and the next tick recovers.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";

// ---------- Mock the pino singleton ----------
// The failure-path test trips logger.warn ON PURPOSE; capturing it keeps the
// intentional error out of the shared worker stdout and makes it assertable.
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

// ---------- Mock the spend lookup + dispatcher ----------
// The dispatcher's own semantics (exactly-once stamp, empty-ADMIN_EMAILS
// behaviour, threshold bands) are covered in cost-cap-alerts.test.ts; here we
// only verify the sweep wires the live numbers into it and survives failures.
let forceCostError: Error | null = null;
const costGlobalMock = vi.fn(async () => 850);
const capMock = vi.fn(() => 1000);
const dispatchMock = vi.fn(async () => undefined);

vi.mock("../src/lib/cost-budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/cost-budget")>();
  return {
    ...actual,
    currentMonthCostGlobal: async () => {
      if (forceCostError) throw forceCostError;
      return costGlobalMock();
    },
    globalMonthlyCostCapUsd: () => capMock(),
  };
});

vi.mock("../src/lib/cost-cap-alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/cost-cap-alerts")>();
  return {
    ...actual,
    dispatchCostCapAlerts: (...args: unknown[]) => dispatchMock(...(args as [])),
  };
});

const { runCostCapAlertSweepOnce, startCostCapAlertSweeper } = await import(
  "../src/lib/cost-cap-sweeper"
);

beforeEach(() => {
  forceCostError = null;
  costGlobalMock.mockClear();
  capMock.mockClear();
  dispatchMock.mockClear();
  loggerWarns.mockClear();
  loggerInfos.mockClear();
});

describe("runCostCapAlertSweepOnce", () => {
  test("reads live spend + cap and hands them to the exactly-once dispatcher", async () => {
    costGlobalMock.mockResolvedValueOnce(812.5);
    capMock.mockReturnValueOnce(1000);

    await runCostCapAlertSweepOnce();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(812.5, 1000);
  });

  test("a throwing spend lookup resolves (log-and-continue) and recovers next tick", async () => {
    forceCostError = new Error("simulated DB outage");

    await expect(runCostCapAlertSweepOnce()).resolves.toBeUndefined();
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(loggerWarns).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining("sweep failed"),
    );

    // Next tick recovers: the in-flight latch must have been released.
    forceCostError = null;
    await runCostCapAlertSweepOnce();
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  test("overlapping ticks are skipped, not stacked", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    costGlobalMock.mockImplementationOnce(async () => {
      await gate;
      return 850;
    });

    const first = runCostCapAlertSweepOnce();
    // Second tick while the first is still awaiting the spend query.
    await runCostCapAlertSweepOnce();
    expect(loggerWarns).toHaveBeenCalledWith(
      expect.stringContaining("previous sweep still running"),
    );

    release();
    await first;
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});

describe("startCostCapAlertSweeper", () => {
  test("is a no-op under vitest so suites can never stamp the real month", () => {
    // VITEST is set in this process — the guard must refuse to start.
    const stop = startCostCapAlertSweeper();
    stop();
    expect(loggerInfos).not.toHaveBeenCalled();
  });

  test("starts (and can be stopped) outside test environments", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVitest = process.env.VITEST;
    process.env.NODE_ENV = "development";
    delete process.env.VITEST;
    try {
      const stop = startCostCapAlertSweeper();
      try {
        expect(loggerInfos).toHaveBeenCalledWith(
          expect.objectContaining({ intervalMinutes: 15 }),
          expect.stringContaining("cost-cap alert sweep started"),
        );
        // The 30s initial delay means nothing fires during the test.
        expect(dispatchMock).not.toHaveBeenCalled();
      } finally {
        stop();
      }
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevVitest === undefined) delete process.env.VITEST;
      else process.env.VITEST = prevVitest;
    }
  });
});
