import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createReadinessProbe, hasConfiguredAi } from "../src/lib/launch-readiness";
const readiness = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/launch-readiness", async (original) => ({
  ...await original<typeof import("../src/lib/launch-readiness")>(),
  getLaunchReadiness: readiness,
}));
import healthRouter from "../src/routes/health";

describe("MVP dependency assessment", () => {
  it("reports query failures without exposing provider details", async () => {
    const probe = createReadinessProbe(async () => { throw new Error("private connection detail"); });
    const result = await probe();
    expect(result.database).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("coalesces concurrent checks and refreshes cached failures", async () => {
    let clock = 10000;
    let release!: () => void;
    const query = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const probe = createReadinessProbe(query, () => clock);
    const a = probe(); const b = probe();
    expect(query).toHaveBeenCalledTimes(1);
    release();
    expect(await a).toEqual(await b);
    await probe();
    expect(query).toHaveBeenCalledTimes(1);
    clock += 5001;
    query.mockRejectedValueOnce(new Error("offline"));
    expect((await probe()).database).toBe("unavailable");
    clock += 5001;
    query.mockResolvedValueOnce({});
    expect((await probe()).database).toBe("available");
  });
  it("requires a complete proxy configuration and supports multiple providers", () => {
    expect(hasConfiguredAi({})).toBe(false);
    expect(hasConfiguredAi({ AI_INTEGRATIONS_OPENAI_API_KEY: "test" })).toBe(false);
    expect(hasConfiguredAi({ AI_INTEGRATIONS_OPENAI_API_KEY: "test", AI_INTEGRATIONS_OPENAI_BASE_URL: "https://example.test" })).toBe(true);
    expect(hasConfiguredAi({ GEMINI_API_KEY: "test" })).toBe(true);
  });
});

describe("public health endpoint contracts", () => {
  let server: ReturnType<express.Express["listen"]>;
  let base: string;
  beforeAll(async () => {
    const app = express(); app.use("/api", healthRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    base = `http://127.0.0.1:${address.port}/api`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  it("keeps liveness independent of the database", async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
  });
  it("returns a readable public diagnosis while readiness returns 503", async () => {
    readiness.mockResolvedValue({ database: "unavailable", buildReady: false, message: "Database unavailable" });
    const status = await fetch(`${base}/launch-readiness`);
    expect(status.status).toBe(200);
    expect(status.headers.get("cache-control")).toBe("no-store");
    expect((await status.json()).database).toBe("unavailable");
    expect((await fetch(`${base}/readyz`)).status).toBe(503);
  });
  it("reports ready dependencies without requiring sign-in", async () => {
    readiness.mockResolvedValue({ database: "available", ai: "configured", buildReady: true });
    expect((await fetch(`${base}/readyz`)).status).toBe(200);
  });
  it("names the serving revision instead of implying one", async () => {
    // Unbundled test runs have no build stamp; they must not claim a commit.
    readiness.mockResolvedValue({ database: "available", ai: "configured", buildReady: true });
    for (const path of ["readyz", "launch-readiness"]) {
      expect((await fetch(`${base}/${path}`)).headers.get("x-serving-revision")).toBe("unbuilt");
    }
  });
});
