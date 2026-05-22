import OpenAI from "openai";

let _client: OpenAI | null = null;

export class OpenAiIntegrationNotConfiguredError extends Error {
  readonly code = "OPENAI_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Lazy accessor for the OpenAI client. Throws a typed error at first call
 * time (NOT at module load) so a missing integration cannot crash API
 * startup for users who never select OpenAI.
 */
export function getOpenAi(): OpenAI {
  if (_client) return _client;
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new OpenAiIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new OpenAiIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  _client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _client;
}

/**
 * @deprecated Module-load construction can crash startup when env is unset.
 * Prefer `getOpenAi()` which lazily constructs the client on first use.
 * Kept as a proxy for back-compat with existing callers.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAi() as object, prop, receiver);
  },
}) as OpenAI;
