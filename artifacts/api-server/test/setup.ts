import { vi } from "vitest";
import { hashKey, readFixture, writeFixture, IS_RECORD, MissingFixtureError } from "./llm-cache";

// In replay mode, set dummy env vars so providerConfigured() in the tests
// reports each provider as available without needing real keys. The mocked
// clients below never actually open a network socket in replay mode.
if (!IS_RECORD) {
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ||= "https://replay.invalid";
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||= "replay";
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||= "https://replay.invalid";
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||= "replay";
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ||= "https://replay.invalid";
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||= "replay";
}

type AnyFn = (...args: unknown[]) => unknown;

function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface ClaudeParams {
  model: string;
  system: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
}

interface OpenAiParams {
  model: string;
  max_completion_tokens: number;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: string };
}

interface GeminiParams {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    maxOutputTokens: number;
    responseMimeType?: string;
    thinkingConfig?: { thinkingBudget: number };
  };
}

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@workspace/integrations-anthropic-ai")
  >();
  return {
    ...actual,
    getAnthropic: () => buildFakeAnthropic(actual.getAnthropic as AnyFn),
  };
});

vi.mock("@workspace/integrations-openai-ai", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@workspace/integrations-openai-ai")
  >();
  return {
    ...actual,
    getOpenAi: () => buildFakeOpenAi(actual.getOpenAi as AnyFn),
  };
});

vi.mock("@workspace/integrations-gemini-ai", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@workspace/integrations-gemini-ai")
  >();
  return {
    ...actual,
    getGemini: () => buildFakeGemini(actual.getGemini as AnyFn),
  };
});

function buildFakeAnthropic(realFactory: AnyFn): unknown {
  return {
    messages: {
      create: async (params: ClaudeParams) => {
        const payload = {
          model: params.model,
          system: params.system,
          messages: params.messages,
        };
        const key = hashKey("claude", payload);
        const cached = readFixture<unknown>("claude", key);
        if (cached) return cached;
        if (!IS_RECORD) {
          throw new MissingFixtureError("claude", key, params.system + " || " + (params.messages[0]?.content ?? ""));
        }
        const real = realFactory() as { messages: { create: (p: ClaudeParams) => Promise<unknown> } };
        const result = await real.messages.create(params);
        writeFixture("claude", key, sanitize(result));
        return result;
      },
    },
  };
}

function buildFakeOpenAi(realFactory: AnyFn): unknown {
  return {
    chat: {
      completions: {
        create: async (params: OpenAiParams) => {
          const payload = {
            model: params.model,
            messages: params.messages,
            json: params.response_format?.type === "json_object",
          };
          const key = hashKey("openai", payload);
          const cached = readFixture<unknown>("openai", key);
          if (cached) return cached;
          if (!IS_RECORD) {
            throw new MissingFixtureError("openai", key, JSON.stringify(params.messages).slice(0, 200));
          }
          const real = realFactory() as {
            chat: { completions: { create: (p: OpenAiParams) => Promise<unknown> } };
          };
          const result = await real.chat.completions.create(params);
          writeFixture("openai", key, sanitize(result));
          return result;
        },
      },
    },
  };
}

function geminiTextFrom(r: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  if (r.text) return r.text;
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

function buildFakeGemini(realFactory: AnyFn): unknown {
  return {
    models: {
      generateContent: async (params: GeminiParams) => {
        const payload = {
          model: params.model,
          contents: params.contents,
          systemInstruction: params.config.systemInstruction,
          json: params.config.responseMimeType === "application/json",
        };
        const key = hashKey("gemini", payload);
        const cached = readFixture<{
          text?: string;
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        }>("gemini", key);
        if (cached) {
          // Always derive `text` from candidates when the cached value lacks
          // it — protects against fixtures recorded before we captured the
          // SDK getter, and against the proxy occasionally returning an
          // empty top-level `text` even when candidate parts hold content.
          cached.text = geminiTextFrom(cached);
          return cached;
        }
        if (!IS_RECORD) {
          throw new MissingFixtureError("gemini", key, params.contents.slice(0, 200));
        }
        const real = realFactory() as {
          models: {
            generateContent: (
              p: GeminiParams,
            ) => Promise<{
              text?: string;
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            }>;
          };
        };
        const result = await real.models.generateContent(params);
        // `response.text` is a getter on the SDK object; JSON-serialising
        // strips it. Capture (or reconstruct from candidate parts) so the
        // engine, which reads `response.text`, always sees the real string.
        const stored = sanitize(result) as Record<string, unknown> & {
          text?: string;
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        stored.text = geminiTextFrom({
          text: result.text,
          candidates: stored.candidates,
        });
        writeFixture("gemini", key, stored);
        return stored;
      },
    },
  };
}
