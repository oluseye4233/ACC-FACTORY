import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";

const mocks = vi.hoisted(() => ({
  credits: vi.fn(),
  storage: vi.fn(),
  subscriptionsEnabled: vi.fn(),
  heartbeat: vi.fn(),
  error: vi.fn(),
}));
vi.mock("../src/lib/cartridge-credits", () => ({ reconcileStaleCartridgeCredits: mocks.credits }));
vi.mock("../src/lib/artifact-operations/preparation-recovery", () => ({ recoverPreparationStorage: mocks.storage }));
vi.mock("../src/lib/feature-flags", () => ({ subscriptionsEnabled: mocks.subscriptionsEnabled }));
vi.mock("../src/lib/logger", () => ({ logger: { error: mocks.error } }));
vi.mock("../src/lib/cron-heartbeat", () => ({ recordCronTick: mocks.heartbeat }));
vi.mock("../src/lib/notification-dispatch", () => ({ runWeeklyDigest: vi.fn() }));
vi.mock("../src/engines/f0", () => ({ runF0MonitoringSweep: vi.fn() }));
vi.mock("../src/lib/cost-cap-sweeper", () => ({ runCostCapAlertSweepOnce: vi.fn() }));
vi.mock("../src/lib/f10-reconciliation", () => ({ runF10ReconciliationSweep: vi.fn() }));

import { runRecoverySweep } from "../src/lib/recovery-sweep";
import cronRouter from "../src/routes/cron";

const cleanReport = {
  dryRun: true, scanned: 2, candidates: 1, deleted: 0,
  missing: 0, retained: 1, busy: 0, errors: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PRIVATE_OBJECT_DIR", "test-only/private");
  vi.stubEnv("PREPARATION_ORPHAN_RECOVERY_APPLY", "");
  vi.stubEnv("CRON_SECRET", "local-cron-test");
  mocks.subscriptionsEnabled.mockReturnValue(true);
  mocks.credits.mockResolvedValue(2);
  mocks.storage.mockResolvedValue({ ...cleanReport });
  mocks.heartbeat.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded scheduled recovery orchestration", () => {
  it("preserves default report-only inspection and reports both lanes", async () => {
    expect(await runRecoverySweep()).toEqual({
      ok: true,
      credits: { status: "completed", recovered: 2 },
      storage: { status: "completed", report: cleanReport },
    });
    expect(mocks.credits).toHaveBeenCalledOnce();
    expect(mocks.storage).toHaveBeenCalledExactlyOnceWith({ dryRun: true });
  });

  it("does not recover credits while subscriptions are disabled", async () => {
    mocks.subscriptionsEnabled.mockReturnValue(false);
    const result = await runRecoverySweep();
    expect(result.credits).toEqual({ status: "disabled" });
    expect(result.ok).toBe(true);
    expect(mocks.credits).not.toHaveBeenCalled();
    expect(mocks.storage).toHaveBeenCalledOnce();
  });

  it("explicitly skips unconfigured storage without touching it", async () => {
    vi.stubEnv("PRIVATE_OBJECT_DIR", "");
    const result = await runRecoverySweep();
    expect(result.storage).toEqual({ status: "unconfigured" });
    expect(result.credits.status).toBe("completed");
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("only honors the existing exact operator deletion opt-in", async () => {
    vi.stubEnv("PREPARATION_ORPHAN_RECOVERY_APPLY", "true");
    await runRecoverySweep();
    expect(mocks.storage).toHaveBeenCalledExactlyOnceWith({ dryRun: false });
  });

  it("still runs storage after a failed credit pass without returning error details", async () => {
    mocks.credits.mockRejectedValue(new Error("sensitive provider detail"));
    const result = await runRecoverySweep();
    expect(result.ok).toBe(false);
    expect(result.credits).toEqual({ status: "failed" });
    expect(result.storage.status).toBe("completed");
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("reports an exception in storage independently of successful credits", async () => {
    mocks.storage.mockRejectedValue(new Error("storage unavailable"));
    const result = await runRecoverySweep();
    expect(result.ok).toBe(false);
    expect(result.credits.status).toBe("completed");
    expect(result.storage).toEqual({ status: "failed" });
  });

  it("treats a returned per-object error count as failure, not healthy completion", async () => {
    mocks.storage.mockResolvedValue({ ...cleanReport, errors: 1 });
    const result = await runRecoverySweep();
    expect(result.ok).toBe(false);
    expect(result.storage.status).toBe("failed");
  });

  it("does not let both lane failures suppress either attempted retry", async () => {
    mocks.credits.mockRejectedValue(new Error("credit failure"));
    mocks.storage.mockRejectedValue(new Error("storage failure"));
    expect(await runRecoverySweep()).toEqual({
      ok: false, credits: { status: "failed" }, storage: { status: "failed" },
    });
    expect(mocks.credits).toHaveBeenCalledOnce();
    expect(mocks.storage).toHaveBeenCalledOnce();
  });
});

describe("authenticated recovery cron endpoint", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const app = express();
    app.use("/api", express.json(), cronRouter);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/cron/recover-abandoned-resources`;
  });
  afterAll(() => new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve())));

  it.each([undefined, "wrong-secret"])("rejects missing/incorrect authentication (%s) before doing work", async secret => {
    const response = await fetch(url, {
      method: "POST", headers: secret ? { "x-cron-secret": secret } : {},
    });
    expect(response.status).toBe(401);
    expect(mocks.credits).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });

  it("fails closed when the server cron secret is unconfigured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await fetch(url, {
      method: "POST", headers: { "x-cron-secret": "local-cron-test" },
    });
    expect(response.status).toBe(401);
    expect(mocks.credits).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("records a successful heartbeat but cannot enable deletion from a request", async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": "local-cron-test", "content-type": "application/json" },
      body: JSON.stringify({ dryRun: false, apply: true }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(mocks.storage).toHaveBeenCalledExactlyOnceWith({ dryRun: true });
    expect(mocks.heartbeat).toHaveBeenCalledExactlyOnceWith("recover-abandoned-resources");
  });

  it.each(["credit", "storage", "object"])("returns 503 without a healthy stamp on a %s failure", async lane => {
    if (lane === "credit") mocks.credits.mockRejectedValue(new Error("failed"));
    if (lane === "storage") mocks.storage.mockRejectedValue(new Error("failed"));
    if (lane === "object") mocks.storage.mockResolvedValue({ ...cleanReport, errors: 1 });
    const response = await fetch(url, {
      method: "POST", headers: { "x-cron-secret": "local-cron-test" },
    });
    expect(response.status).toBe(503);
    expect((await response.json()).ok).toBe(false);
    expect(mocks.heartbeat).not.toHaveBeenCalled();
    expect(mocks.credits).toHaveBeenCalledOnce();
    expect(mocks.storage).toHaveBeenCalledOnce();
  });

  it.each([false, true])("the actual scheduled driver recognizes the target and exits nonzero on failure=%s", async failing => {
    if (failing) mocks.storage.mockResolvedValue({ ...cleanReport, errors: 1 });
    const child = spawn("pnpm", [
      "--filter", "@workspace/scripts", "run", "cron-tick", "--", "recover-abandoned-resources",
    ], {
      env: {
        ...process.env,
        PUBLIC_BASE_URL: new URL(url).origin,
        CRON_SECRET: "local-cron-test",
        CRON_TIMEOUT_MS: "5000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", data => { output += data.toString(); });
    child.stderr.on("data", data => { output += data.toString(); });
    const [code] = await once(child, "close");
    expect(output).toContain("/api/cron/recover-abandoned-resources");
    expect(output).toContain(`status=${failing ? 503 : 200}`);
    expect(code).toBe(failing ? 1 : 0);
    expect(mocks.storage).toHaveBeenCalledExactlyOnceWith({ dryRun: true });
    expect(mocks.heartbeat).toHaveBeenCalledTimes(failing ? 0 : 1);
  }, 15_000);
});
