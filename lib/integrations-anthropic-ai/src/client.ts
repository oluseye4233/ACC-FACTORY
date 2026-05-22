import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export class AnthropicIntegrationNotConfiguredError extends Error {
  readonly code = "ANTHROPIC_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Lazy accessor for the Anthropic client. Throws a typed error at first
 * call time (NOT at module load) so a missing integration cannot crash
 * API startup — or test loading — for callers who never select Anthropic.
 */
export function getAnthropic(): Anthropic {
  if (_client) return _client;
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new AnthropicIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new AnthropicIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }
  _client = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
  return _client;
}

/**
 * @deprecated Module-load construction can crash startup when env is unset.
 * Prefer `getAnthropic()` which lazily constructs the client on first use.
 * Kept as a Proxy for back-compat with existing callers.
 */
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getAnthropic() as object, prop, receiver);
  },
}) as Anthropic;
