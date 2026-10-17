import { probeDatabaseConnection } from "@workspace/db";

export function hasConfiguredAi(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY ||
    (env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) ||
    (env.AI_INTEGRATIONS_OPENAI_API_KEY && env.AI_INTEGRATIONS_OPENAI_BASE_URL) ||
    (env.AI_INTEGRATIONS_GEMINI_API_KEY && env.AI_INTEGRATIONS_GEMINI_BASE_URL));
}

export function createReadinessProbe(
  query: () => Promise<unknown> = probeDatabaseConnection,
  now = () => Date.now(),
) {
  let cached: { database: "available" | "unavailable"; checkedAt: string } | undefined;
  let expires = 0;
  let pending: Promise<NonNullable<typeof cached>> | undefined;
  return async () => {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      let database: "available" | "unavailable" = "available";
      try { await query(); } catch { database = "unavailable"; }
      cached = { database, checkedAt: new Date(now()).toISOString() };
      expires = now() + 5000;
      return cached;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

export const probeDatabase = createReadinessProbe();
export async function getLaunchReadiness() {
  const result = await probeDatabase();
  const ai = hasConfiguredAi() ? "configured" : "not_configured";
  return {
    ...result, ai, buildReady: result.database === "available" && ai === "configured",
    message: result.database === "unavailable"
      ? "Database unavailable. Saved work and sign-in may be unavailable. An operator must restore database access; do not replace the database or connection string to bypass this."
      : ai === "not_configured"
        ? "Database reachable. No supported AI provider is configured for generation."
        : "Database reachable and an AI provider is configured. This is not proof of provider availability, migrations, every feature, or independent certification.",
    deferred: [
      "Class B follow-on: Azure Key Vault migration and rotation — not an MVP launch requirement; existing secret controls remain in use",
      "Full XVL/VTE verification and F12 operation remain incomplete; advisory Track E JSON contract checks and VTE failure intake are available",
      "SHORT SPRINTS and IMPRIMA — required verification and governance gates incomplete",
    ],
  };
}
