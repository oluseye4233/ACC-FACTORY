import type { LlmProvider } from "@workspace/db";

/** Provider-specific default model IDs used by engine calls and pricing checks. */
export const PROVIDER_MODELS: Record<LlmProvider, string> = {
  claude: "claude-sonnet-4-6",
  openai: "gpt-5.4",
  gemini: "gemini-3.1-pro-preview",
  deepseek: "deepseek-flash",
  kimi: "kimi-k3",
  qwen: "qwen3.7-plus",
  glm: "glm-5.3",
};