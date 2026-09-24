import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Request } from "express";
import {
  callLlm,
  ProviderRequiresTierError,
  PROVIDER_MODELS,
  resolveProvider,
} from "../src/engines/shared";

const PROVIDERS = [
  {
    provider: "deepseek" as const,
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com",
  },
  {
    provider: "kimi" as const,
    apiKeyEnv: "MOONSHOT_API_KEY",
    baseUrlEnv: "MOONSHOT_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
  },
  {
    provider: "qwen" as const,
    apiKeyEnv: "DASHSCOPE_API_KEY",
    baseUrlEnv: "DASHSCOPE_BASE_URL",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  {
    provider: "glm" as const,
    apiKeyEnv: "ZHIPU_API_KEY",
    baseUrlEnv: "ZHIPU_BASE_URL",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
];

const ENV_KEYS = PROVIDERS.flatMap((config) => [
  config.apiKeyEnv,
  config.baseUrlEnv,
]);
const previousEnv = new Map<string, string | undefined>();

beforeEach(() => {
  previousEnv.clear();
  for (const key of ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("OpenAI-compatible HARNESS providers", () => {
  for (const config of PROVIDERS) {
    test(`${config.provider} sends JSON-mode chat requests`, async () => {
      process.env[config.apiKeyEnv] = `test-key-${config.provider}`;
      const overrideBaseUrl =
        config.provider === "qwen"
          ? "https://workspace.example/compatible-mode/v1/"
          : undefined;
      if (overrideBaseUrl) process.env[config.baseUrlEnv] = overrideBaseUrl;

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"status":"ok"}' } }],
            usage: { prompt_tokens: 23, completion_tokens: 8 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const text = await callLlm(
        config.provider,
        "system instructions",
        "user request",
        undefined,
        { jsonMode: true },
      );

      expect(text).toBe('{"status":"ok"}');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, request] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      const baseUrl = (overrideBaseUrl ?? config.defaultBaseUrl).replace(
        /\/+$/,
        "",
      );
      expect(url).toBe(`${baseUrl}/chat/completions`);
      expect(request.method).toBe("POST");
      expect(new Headers(request.headers).get("authorization")).toBe(
        `Bearer test-key-${config.provider}`,
      );

      const body = JSON.parse(String(request.body)) as {
        model: string;
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
        response_format?: { type: string };
      };
      expect(body.model).toBe(PROVIDER_MODELS[config.provider]);
      expect(body.max_tokens).toBeGreaterThan(0);
      expect(body.messages).toEqual([
        { role: "system", content: "system instructions" },
        { role: "user", content: "user request" },
      ]);
      expect(body.response_format).toEqual({ type: "json_object" });
    });

    test(`${config.provider} fails explicitly when its API key is missing`, async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        callLlm(config.provider, "system", "user"),
      ).rejects.toMatchObject({
        code: "PROVIDER_NOT_CONFIGURED",
        provider: config.provider,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test(`${config.provider} remains unavailable to Explorer requests`, () => {
      const practitionerRequest = {
        subscriber: { tier: "PRACTITIONER" },
      } as unknown as Request;
      const explorerRequest = {
        subscriber: { tier: "EXPLORER" },
      } as unknown as Request;

      expect(
        resolveProvider(practitionerRequest, config.provider, "claude"),
      ).toBe(config.provider);
      expect(() =>
        resolveProvider(explorerRequest, config.provider, "claude"),
      ).toThrow(ProviderRequiresTierError);
    });
  }
});