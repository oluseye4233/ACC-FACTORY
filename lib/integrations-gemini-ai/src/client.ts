import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export class GeminiIntegrationNotConfiguredError extends Error {
  readonly code = "GEMINI_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Lazy accessor for the Gemini client. Throws a typed error at first call
 * time (NOT at module load) so a missing integration cannot crash API
 * startup for users who never select Gemini.
 */
export function getGemini(): GoogleGenAI {
  if (_client) return _client;
  if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    throw new GeminiIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    throw new GeminiIntegrationNotConfiguredError(
      "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
    );
  }
  _client = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      // The Replit AI Integrations Gemini proxy serves
      // `/models/<model>:generateContent` directly under its base URL — it
      // does NOT route the `/v1beta` (or `/v1`) API-version prefix that
      // @google/genai appends by default. Setting an explicit empty
      // apiVersion suppresses that prefix so requests resolve to a
      // proxy-supported endpoint instead of failing with INVALID_ENDPOINT.
      apiVersion: "",
    },
  });
  return _client;
}

/**
 * @deprecated Module-load construction can crash startup when env is unset.
 * Prefer `getGemini()` which lazily constructs the client on first use.
 * Kept as a proxy for back-compat with existing callers.
 */
export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getGemini() as object, prop, receiver);
  },
}) as GoogleGenAI;
