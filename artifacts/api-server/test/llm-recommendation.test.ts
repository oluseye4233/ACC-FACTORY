import express from "express";
import type { Request, Response, NextFunction } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recommendLlm } from "../src/lib/llm-recommendation";
import { computeCostUsd } from "../src/lib/pricing";

vi.mock("../src/lib/auth", () => ({
  requireAuth(req: Request, res: Response, next: NextFunction) {
    const tier = req.get("x-test-tier");
    if (!tier) { res.status(401).json({ error: "Unauthorized" }); return; }
    req.subscriber = { tier } as Request["subscriber"];
    next();
  },
}));
import router from "../src/routes/llm-recommendation";
const env = {
  AI_INTEGRATIONS_ANTHROPIC_BASE_URL: "configured", AI_INTEGRATIONS_ANTHROPIC_API_KEY: "configured",
  AI_INTEGRATIONS_OPENAI_BASE_URL: "configured", AI_INTEGRATIONS_OPENAI_API_KEY: "configured",
  AI_INTEGRATIONS_GEMINI_BASE_URL: "configured", AI_INTEGRATIONS_GEMINI_API_KEY: "configured",
  AI_INTEGRATIONS_OPENROUTER_BASE_URL: "configured", AI_INTEGRATIONS_OPENROUTER_API_KEY: "configured",
};
const recommend = (featureId: number) => recommendLlm({ featureId, tier: "PRACTITIONER", env });
afterEach(() => vi.unstubAllEnvs());

describe("optional model recommendation policy", () => {
  it("uses a cost-first profile for F1/F2 and a balanced profile for F3–F5", () => {
    for (const id of [1, 2]) expect(recommend(id).recommended?.provider).toBe("deepseek");
    for (const id of [3, 4, 5]) expect(recommend(id).recommended?.provider).toBe("qwen");
  });
  it("uses a complex-task profile for F6/F7/F8", () => {
    for (const id of [6, 7, 8]) {
      expect(recommend(id).complexity).toBe("complex");
      expect(recommend(id).recommended?.provider).toBe("kimi");
    }
  });
  it("respects a user-requested complexity rather than forcing the stage default", () => {
    expect(recommendLlm({ featureId: 8, complexity: "simple", tier: "PRACTITIONER", env })
      .recommended?.provider).toBe("deepseek");
  });
  it("never recommends a tier-ineligible provider", () => {
    for (const id of [1, 5, 8]) {
      const result = recommendLlm({ featureId: id, tier: "EXPLORER", env });
      expect(result.candidates.map(item => item.provider)).toEqual(["claude"]);
    }
  });
  it("excludes unconfigured providers and does not downgrade complex-task policy silently", () => {
    const result = recommendLlm({ featureId: 8, tier: "PRACTITIONER", env: {
      AI_INTEGRATIONS_OPENROUTER_API_KEY: "configured",
    } });
    expect(result.recommended).toBeNull();
    expect(result.candidates).toEqual([]);
  });
  it("has no hidden GLM fallback and returns null when nothing is configured", () => {
    expect(recommend(3).candidates.some(candidate => candidate.provider === "glm")).toBe(false);
    expect(recommendLlm({ featureId: 1, tier: "EXPLORER", env: {} }).recommended).toBeNull();
  });
  it("derives costs from the reviewed server-side rate table and sorts deterministically", () => {
    const result = recommend(8);
    for (const candidate of result.candidates) {
      expect(candidate.estimatedCostUsd).toBe(computeCostUsd(candidate.modelId,
        result.estimatedInputTokens, result.estimatedOutputTokens));
    }
    expect(result.candidates.map(item => item.estimatedCostUsd))
      .toEqual(result.candidates.map(item => item.estimatedCostUsd).sort((a, b) => a - b));
    expect(result.disclaimer).toContain("artifact content is not analyzed");
    expect(result.disclaimer).toContain("never calls a model");
  });
});

describe("read-only recommendation API", () => {
  async function request(path: string, tier?: string) {
    const app = express();
    app.use(router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address() as { port: number };
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        headers: tier ? { "x-test-tier": tier } : {},
      });
      return { status: response.status, cache: response.headers.get("cache-control"),
        body: await response.json() };
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }
  it("requires authentication", async () => {
    expect((await request("/llm/recommendation?featureId=8")).status).toBe(401);
  });
  it("validates stage and complexity parameters", async () => {
    for (const query of ["featureId=13", "featureId=no", "complexity=unknown"]) {
      expect((await request(`/llm/recommendation?${query}`, "PRACTITIONER")).status).toBe(400);
    }
  });
  it("returns a private advisory response, honoring the server-side tier", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const response = await request("/llm/recommendation?featureId=1", "EXPLORER");
    expect(response.status).toBe(200);
    expect(response.cache).toBe("private, no-store");
    expect(response.body.recommended.provider).toBe("claude");
  });
});
