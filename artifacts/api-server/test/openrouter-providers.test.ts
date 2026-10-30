import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { z } from "zod/v4";

const mocks = vi.hoisted(() => ({ create: vi.fn(), config: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    constructor(config: unknown) { mocks.config(config); }
    chat = { completions: { create: mocks.create } };
  },
}));
import {
  callLlm, callLlmJson, MAX_TOKENS, PROVIDER_MODELS,
  ProviderRequiresTierError, resolveProvider,
} from "../src/engines/shared";
import { computeCostUsd, computeWorstCaseReservationUsd } from "../src/lib/pricing";

beforeEach(() => {
  mocks.create.mockReset();
  mocks.config.mockClear();
  vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_BASE_URL", "https://managed.example/openrouter/v1");
  vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_API_KEY", "unit-test-key");
});
afterEach(() => vi.unstubAllEnvs());

for (const provider of ["deepseek", "kimi", "qwen", "mistral"] as const) {
  describe(`${provider} managed OpenRouter routing`, () => {
    const response = () => ({
      model: PROVIDER_MODELS[provider],
      choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 20, completion_tokens: 5 },
    });
    beforeEach(() => mocks.create.mockResolvedValue(response()));

    it("uses managed credentials, exact catalog identity and priced JSON requests", async () => {
      await expect(callLlmJson(provider, "system", "user", z.object({ ok: z.literal(true) })))
        .resolves.toEqual({ ok: true });
      expect(mocks.config).toHaveBeenCalledWith({
        baseURL: "https://managed.example/openrouter/v1",
        apiKey: "unit-test-key", maxRetries: 0, timeout: 110_000,
      });
      const request = mocks.create.mock.calls[0]![0];
      expect(request).toMatchObject({
        model: PROVIDER_MODELS[provider], max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: "system" }, { role: "user", content: "user" }],
        response_format: { type: "json_object" },
        provider: { require_parameters: true },
      });
      const bound = Buffer.byteLength("systemuser") + 256;
      expect(computeWorstCaseReservationUsd(request.model, bound, MAX_TOKENS))
        .toBeGreaterThanOrEqual(
          (bound * request.provider.max_price.prompt +
            MAX_TOKENS * request.provider.max_price.completion) / 1_000_000,
        );
      expect(computeCostUsd(request.model, 20, 5)).toBeGreaterThan(0);
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    it("omits JSON-mode instructions for text requests", async () => {
      await callLlm(provider, "system", "user");
      expect(mocks.create.mock.calls[0]![0]).not.toHaveProperty("response_format");
    });

    for (const key of ["AI_INTEGRATIONS_OPENROUTER_BASE_URL", "AI_INTEGRATIONS_OPENROUTER_API_KEY"]) {
      it(`fails closed without ${key}, even with direct vendor credentials`, async () => {
        vi.stubEnv(key, "");
        for (const direct of ["DEEPSEEK_API_KEY", "MOONSHOT_API_KEY", "DASHSCOPE_API_KEY"]) {
          vi.stubEnv(direct, "must-not-be-used");
        }
        await expect(callLlm(provider, "system", "user")).rejects.toMatchObject({
          code: "PROVIDER_NOT_CONFIGURED", provider,
        });
        expect(mocks.create).not.toHaveBeenCalled();
      });
    }

    it("accepts the provisioned internal HTTP proxy", async () => {
      vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_BASE_URL", "http://managed-proxy.internal/openrouter");
      await expect(callLlm(provider, "system", "user")).resolves.toBe('{"ok":true}');
      expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: "http://managed-proxy.internal/openrouter",
      }));
    });
    it("rejects unsupported transport protocols before sending", async () => {
      vi.stubEnv("AI_INTEGRATIONS_OPENROUTER_BASE_URL", "ftp://unsupported.example");
      await expect(callLlm(provider, "system", "user")).rejects.toThrow("HTTP or HTTPS");
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("rejects truncated results and unexpected model identities", async () => {
      mocks.create.mockResolvedValueOnce({
        ...response(), choices: [{ finish_reason: "length", message: { content: '{"ok":' } }],
      });
      await expect(callLlm(provider, "system", "user")).rejects.toThrow("complete text result");
      mocks.create.mockResolvedValueOnce({ ...response(), model: "another/model" });
      await expect(callLlm(provider, "system", "user")).rejects.toThrow("model identity");
    });

    it("requires usage and strict schema validation", async () => {
      mocks.create.mockResolvedValueOnce({ ...response(), usage: undefined });
      await expect(callLlm(provider, "system", "user")).rejects.toThrow("token count");
      await expect(callLlmJson(provider, "system", "user", z.object({ missing: z.string() })))
        .rejects.toThrow("schema validation");
    });

    it("keeps Explorer locked out and Practitioner access available", () => {
      expect(() => resolveProvider({ subscriber: { tier: "EXPLORER" } } as Request,
        provider, "claude")).toThrow(ProviderRequiresTierError);
      expect(resolveProvider({ subscriber: { tier: "PRACTITIONER" } } as Request,
        provider, "claude")).toBe(provider);
    });
  });
}
