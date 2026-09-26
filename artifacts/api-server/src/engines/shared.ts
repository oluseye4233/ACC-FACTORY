import { and, eq } from "drizzle-orm";
import { maybeAwardContextCraftBadges } from "../lib/badges";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import {
  db,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessFeatureStateTable,
  harnessEscalationsTable,
  harnessEngineRunsTable,
  costBudgetReservationsTable,
  LLM_PROVIDERS,
  type ArtifactType,
  type LlmProvider,
} from "@workspace/db";
import {
  getAnthropic,
  AnthropicIntegrationNotConfiguredError,
} from "@workspace/integrations-anthropic-ai";
import {
  getOpenAi,
  OpenAiIntegrationNotConfiguredError,
} from "@workspace/integrations-openai-ai";
import {
  getGemini,
  GeminiIntegrationNotConfiguredError,
} from "@workspace/integrations-gemini-ai";
import type { Request, Response } from "express";
import {
  computeCostUsd,
  computeWorstCaseReservationUsd,
} from "../lib/pricing";
import { logger } from "../lib/logger";
import type { Scorecard } from "../lib/scorecards";
import { maybeDispatchHighCostAlerts } from "../lib/notification-dispatch";
import { tryIssueSku } from "../lib/sku";
import {
  CostBudgetExceededError,
  releaseCostBudgetReservation,
  reserveCostBudget,
} from "../lib/cost-budget";
import { PROVIDER_MODELS } from "./provider-models";

export { PROVIDER_MODELS } from "./provider-models";
// Legacy export — Anthropic-only callers still reference MODEL.
export const MODEL = PROVIDER_MODELS.claude;
export const MAX_TOKENS = 16384;

export type CertTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "NONE";

/** Per-call telemetry context. Populating this triggers a `harness_engine_runs` row. */
export interface RunContext {
  // Nullable to support session-less LLM spend: ingestion and cartridge
  // normalisation call the model BEFORE any harness session exists. Engine runs
  // always pass a real session id; pre-session runs pass null so their cost is
  // still recorded and counted by the company-wide monthly cost cap.
  sessionId: string | null;
  userId: string;
  engineId: number;
}

export function certTierForJcse(total: number): CertTier {
  if (total >= 48) return "PLATINUM";
  if (total >= 43) return "GOLD";
  if (total >= 36) return "SILVER";
  if (total >= 30) return "BRONZE";
  return "NONE";
}

export async function ownedSessionOr404(
  req: Request,
  sessionId: string,
): Promise<
  | { ok: true; userId: string; preferredModelProvider: LlmProvider }
  | { ok: false; status: number; error: string }
> {
  const userId = req.localUser?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!z.string().uuid().safeParse(sessionId).success) {
    return { ok: false, status: 404, error: "Session not found" };
  }
  const rows = await db
    .select({
      id: harnessSessionsTable.id,
      preferredModelProvider: harnessSessionsTable.preferredModelProvider,
    })
    .from(harnessSessionsTable)
    .where(
      and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, userId)),
    )
    .limit(1);
  if (rows.length === 0) return { ok: false, status: 404, error: "Session not found" };
  return {
    ok: true,
    userId,
    preferredModelProvider: rows[0]!.preferredModelProvider as LlmProvider,
  };
}

export async function loadArtifact(
  artifactId: string,
  userId: string,
): Promise<typeof harnessArtifactsTable.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.id, artifactId),
        eq(harnessArtifactsTable.userId, userId),
      ),
    )
    .limit(1);
  return rows[0];
}

export interface PersistArtifactInput {
  sessionId: string;
  userId: string;
  featureId: number;
  artifactType: ArtifactType;
  name?: string | null;
  artifactContent: Record<string, unknown>;
  scorecards?: Scorecard[];
  jcseScore?: number | null;
  certTier?: string | null;
  groState?: string;
  spartanCert?: Record<string, unknown> | null;
  provider?: LlmProvider | null;
  modelId?: string | null;
  // MATHMON / FORGE VERIFIED gate (D26). Set only by the F7 certification path.
  mathmonScore?: number | null;
  forgeVerified?: boolean;
}

export async function persistArtifact(
  input: PersistArtifactInput,
): Promise<typeof harnessArtifactsTable.$inferSelect> {
  const provider = input.provider ?? null;
  const modelId =
    input.modelId ?? (provider ? PROVIDER_MODELS[provider] ?? null : null);
  // Universal SKU Catalog (D24 · SKU-002): mint a canonical SKU for publishable
  // artifact types (SPC, MVP_PDD) at persist time — this is the publish event.
  // Non-eligible intermediate artifacts get null. Best-effort so a transient
  // catalog error can never lose completed, paid-for engine work.
  const sku = await tryIssueSku(input.userId, input.artifactType);
  const [row] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: input.sessionId,
      userId: input.userId,
      featureId: input.featureId,
      artifactType: input.artifactType,
      name: input.name ?? null,
      artifactContent: input.artifactContent,
      scorecards: input.scorecards ?? [],
      sku,
      jcseScore: input.jcseScore ?? null,
      certTier: input.certTier ?? null,
      groState: input.groState ?? "SAFE_LIFE",
      spartanCert: input.spartanCert ?? null,
      mathmonScore: input.mathmonScore ?? null,
      forgeVerified: input.forgeVerified ?? false,
      provider,
      modelId,
    })
    .returning();
  maybeAwardContextCraftBadges(input.userId, row!.id, input.artifactContent).catch(
    () => {},
  );
  return row!;
}

export async function advanceFeatureState(
  sessionId: string,
  completedFeatureId: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(harnessFeatureStateTable)
    .set({ status: "COMPLETE" })
    .where(
      and(
        eq(harnessFeatureStateTable.sessionId, sessionId),
        eq(harnessFeatureStateTable.featureId, completedFeatureId),
      ),
    );
  const nextId = completedFeatureId + 1;
  if (nextId <= 7) {
    await db
      .update(harnessFeatureStateTable)
      .set({ status: "AVAILABLE", unlockedAt: now })
      .where(
        and(
          eq(harnessFeatureStateTable.sessionId, sessionId),
          eq(harnessFeatureStateTable.featureId, nextId),
          eq(harnessFeatureStateTable.status, "LOCKED"),
        ),
      );
  }
}

export async function recordEscalation(
  sessionId: string,
  fromFeature: number,
  toFeature: number,
  reason: string,
): Promise<void> {
  await db.insert(harnessEscalationsTable).values({
    sessionId,
    fromFeature,
    toFeature,
    reason,
  });
}

async function recordRun(
  ctx: RunContext,
  provider: LlmProvider,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  reservationId?: string | null,
  cachedInputTokens = 0,
): Promise<boolean> {
  try {
    const cost = computeCostUsd(
      modelId,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    );
    const values = {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      engineId: ctx.engineId,
      provider,
      modelId,
      inputTokens,
      outputTokens,
      costUsd: cost.toFixed(6),
      durationMs,
    };
    if (reservationId) {
      // Commit actual usage and remove its reservation together, so the
      // monthly-cap sum cannot observe a gap between the two representations.
      await db.transaction(async (tx) => {
        await tx.insert(harnessEngineRunsTable).values(values);
        await tx
          .delete(costBudgetReservationsTable)
          .where(eq(costBudgetReservationsTable.id, reservationId));
      });
    } else {
      await db.insert(harnessEngineRunsTable).values(values);
    }
    // Fire-and-forget: notify org owners/admins subscribed to high-cost
    // alerts. Crashes are swallowed inside the dispatcher so telemetry stays
    // best-effort. Skipped for session-less runs (ingestion / cartridge) — the
    // alert is anchored to a harness session, which those runs don't have.
    if (ctx.sessionId) {
      void maybeDispatchHighCostAlerts({
        sessionId: ctx.sessionId,
        userId: ctx.userId,
        engineId: ctx.engineId,
        costUsd: cost,
        occurredAt: new Date(),
      });
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to record harness_engine_runs row");
    // Keep the reservation until its TTL expires when recording fails; dropping
    // it here would let unaccounted provider spend slip through the cap.
    return false;
  }
}

// ─── Provider resolution + tier gate ──────────────────────────────────────

const PROVIDER_SET = new Set<string>(LLM_PROVIDERS);

export function isLlmProvider(v: unknown): v is LlmProvider {
  return typeof v === "string" && PROVIDER_SET.has(v);
}

export class ProviderRequiresTierError extends Error {
  readonly code = "PROVIDER_REQUIRES_TIER";
  constructor(public provider: LlmProvider) {
    super(`Provider '${provider}' requires PRACTITIONER tier or higher.`);
  }
}

/** Raised when the selected provider's integration env vars are missing. */
export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  constructor(public provider: LlmProvider, message: string) {
    super(message);
  }
}

/**
 * Resolve the LLM provider for a request:
 *   1. explicit body.provider (if valid)
 *   2. session.preferredModelProvider
 *   3. fallback to "claude"
 *
 * Then enforce tier: Explorer is hard-locked to Claude. Any non-claude
 * choice from an Explorer throws `ProviderRequiresTierError`.
 */
export function resolveProvider(
  req: Request,
  bodyProvider: unknown,
  sessionPreferred: LlmProvider,
): LlmProvider {
  const requested: LlmProvider = isLlmProvider(bodyProvider)
    ? bodyProvider
    : sessionPreferred;
  // Use effective tier (personal MAX active-org team membership) so a personal
  // Explorer who belongs to an active team org is treated as Institution for
  // provider-capability gating, matching the Stage 2 elevation rule.
  const tier =
    (req as Request & { effectiveTier?: string }).effectiveTier ??
    req.subscriber?.tier ??
    "EXPLORER";
  if (requested !== "claude" && tier === "EXPLORER") {
    throw new ProviderRequiresTierError(requested);
  }
  return requested;
}

/**
 * Send the typed 403 for ProviderRequiresTierError; returns true if handled.
 * Engines call this from their try/catch around resolveProvider.
 */
export function sendProviderTierError(res: Response, err: unknown): boolean {
  if (err instanceof CostBudgetExceededError) {
    res.status(err.denial.status).json(err.denial.body);
    return true;
  }
  if (err instanceof ProviderRequiresTierError) {
    res.status(403).json({
      error: "PROVIDER_REQUIRES_TIER",
      code: "PROVIDER_REQUIRES_TIER",
      detail: err.message,
      provider: err.provider,
    });
    return true;
  }
  if (err instanceof ProviderNotConfiguredError) {
    res.status(503).json({
      error: "PROVIDER_NOT_CONFIGURED",
      code: "PROVIDER_NOT_CONFIGURED",
      detail: err.message,
      provider: err.provider,
    });
    return true;
  }
  return false;
}

// ─── Generic LLM call layer ───────────────────────────────────────────────

type LlmCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  modelId: string;
};

class ProviderUsageUnavailableError extends Error {
  constructor(label: string) {
    super(`Provider response did not include a valid ${label} token count.`);
    this.name = "ProviderUsageUnavailableError";
  }
}

function requiredTokenCount(label: string, ...values: unknown[]): number {
  const value = values.find(
    (candidate) =>
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0,
  );
  if (typeof value !== "number") {
    throw new ProviderUsageUnavailableError(label);
  }
  return value;
}

function optionalTokenCount(...values: unknown[]): number {
  const value = values.find(
    (candidate) =>
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0,
  );
  return typeof value === "number" ? value : 0;
}

async function callClaudeImpl(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmCallResult> {
  const modelId = PROVIDER_MODELS.claude;
  let client;
  try {
    client = getAnthropic();
  } catch (err) {
    if (err instanceof AnthropicIntegrationNotConfiguredError) {
      throw new ProviderNotConfiguredError("claude", err.message);
    }
    throw err;
  }
  const message = await client.messages.create({
    model: modelId,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = message.content[0];
  const text = block && block.type === "text" ? block.text : "";
  return {
    text,
    inputTokens: requiredTokenCount("input", message.usage?.input_tokens),
    outputTokens: requiredTokenCount("output", message.usage?.output_tokens),
    modelId,
  };
}

async function callOpenAIImpl(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<LlmCallResult> {
  const modelId = PROVIDER_MODELS.openai;
  let client;
  try {
    client = getOpenAi();
  } catch (err) {
    if (err instanceof OpenAiIntegrationNotConfiguredError) {
      throw new ProviderNotConfiguredError("openai", err.message);
    }
    throw err;
  }
  const completion = await client.chat.completions.create({
    model: modelId,
    max_completion_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return {
    text,
    inputTokens: requiredTokenCount("input", completion.usage?.prompt_tokens),
    outputTokens: requiredTokenCount("output", completion.usage?.completion_tokens),
    cachedInputTokens: optionalTokenCount(
      completion.usage?.prompt_tokens_details?.cached_tokens,
    ),
    modelId,
  };
}

async function callGeminiImpl(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<LlmCallResult> {
  const modelId = PROVIDER_MODELS.gemini;
  let client;
  try {
    client = getGemini();
  } catch (err) {
    if (err instanceof GeminiIntegrationNotConfiguredError) {
      throw new ProviderNotConfiguredError("gemini", err.message);
    }
    throw err;
  }
  const response = await client.models.generateContent({
    model: modelId,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: MAX_TOKENS,
      // Gemini 2.5/3.x "thinking" models silently consume maxOutputTokens for
      // internal reasoning, which can leave zero budget for the actual JSON
      // body — observable as an empty response.text. We don't need that
      // reasoning budget for our deterministic structured outputs, so pin
      // it to zero. Safe no-op on non-thinking models.
      thinkingConfig: { thinkingBudget: 0 },
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
  // Some Gemini proxy responses leave the SDK's `response.text` getter empty
  // even though `candidates[0].content.parts[*].text` carries a valid body.
  // Fall back to concatenating the parts so we don't 502 with "Failed to
  // parse engine JSON response" on those payloads.
  let text = response.text ?? "";
  if (!text) {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
  }
  const usage = response.usageMetadata;
  return {
    text,
    inputTokens: requiredTokenCount("input", usage?.promptTokenCount),
    // Google bills thinking tokens at the output rate as well as candidate text.
    outputTokens:
      requiredTokenCount("candidate output", usage?.candidatesTokenCount) +
      optionalTokenCount(usage?.thoughtsTokenCount),
    modelId,
  };
}

type OpenAICompatibleProvider = "deepseek" | "kimi" | "qwen" | "glm";

const OPENAI_COMPATIBLE_PROVIDER_CONFIG: Record<
  OpenAICompatibleProvider,
  { apiKeyEnv: string; baseUrlEnv: string; defaultBaseUrl: string }
> = {
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com",
  },
  kimi: {
    apiKeyEnv: "MOONSHOT_API_KEY",
    baseUrlEnv: "MOONSHOT_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
  },
  qwen: {
    apiKeyEnv: "DASHSCOPE_API_KEY",
    baseUrlEnv: "DASHSCOPE_BASE_URL",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  glm: {
    apiKeyEnv: "ZHIPU_API_KEY",
    baseUrlEnv: "ZHIPU_BASE_URL",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
};

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
    prompt_cache_hit_tokens?: unknown;
    prompt_tokens_details?: { cached_tokens?: unknown };
  };
}

async function callOpenAICompatibleImpl(
  provider: OpenAICompatibleProvider,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
): Promise<LlmCallResult> {
  const config = OPENAI_COMPATIBLE_PROVIDER_CONFIG[provider];
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new ProviderNotConfiguredError(
      provider,
      `Provider '${provider}' requires the ${config.apiKeyEnv} secret to be configured.`,
    );
  }

  const modelId = PROVIDER_MODELS[provider];
  const baseUrl = (
    process.env[config.baseUrlEnv] || config.defaultBaseUrl
  ).replace(/\/+$/, "");
  const endpoint = new URL(`${baseUrl}/chat/completions`);
  if (endpoint.protocol !== "https:") {
    throw new Error(`${provider} API base URL must use HTTPS.`);
  }
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider} API request failed with HTTP ${response.status}.`);
  }

  let payload: OpenAICompatibleResponse;
  try {
    payload = (await response.json()) as OpenAICompatibleResponse;
  } catch {
    throw new Error(`${provider} API returned an invalid JSON response.`);
  }

  const content = payload.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              part &&
              typeof part === "object" &&
              "text" in part &&
              typeof part.text === "string"
                ? part.text
                : "",
            )
            .join("")
        : null;
  if (text === null) {
    throw new Error(`${provider} API response did not include message content.`);
  }

  const usage = payload.usage;
  return {
    text,
    inputTokens: requiredTokenCount(
      "input",
      usage?.prompt_tokens,
      usage?.input_tokens,
    ),
    outputTokens: requiredTokenCount(
      "output",
      usage?.completion_tokens,
      usage?.output_tokens,
    ),
    cachedInputTokens: optionalTokenCount(
      usage?.prompt_cache_hit_tokens,
      usage?.prompt_tokens_details?.cached_tokens,
    ),
    modelId,
  };
}

export async function callLlm(
  provider: LlmProvider,
  systemPrompt: string,
  userPrompt: string,
  ctx?: RunContext,
  opts?: { jsonMode?: boolean },
): Promise<string> {
  const start = Date.now();
  const jsonMode = opts?.jsonMode ?? false;

  // Inject CARTRIDGE CONTEXT (scope-first, protected) for cartridge sessions.
  // Lives at the TOP of the system prompt so every engine — F1 through F8,
  // F6-VDJ and DE-SPC — is bound by the same operator-defined scope.
  let finalSystem = systemPrompt;
  if (ctx?.sessionId) {
    const { loadCartridgeContext } = await import("../lib/cartridge-context");
    const block = await loadCartridgeContext(ctx.sessionId);
    if (block) finalSystem = `${block}\n\n${systemPrompt}`;
  }

  let reservationId: string | null = null;
  let result: LlmCallResult;
  try {
    if (ctx) {
      // One token cannot represent less than one UTF-8 byte. The extra margin
      // covers message framing and role separators; MAX_TOKENS covers every
      // provider's configured output ceiling. Always reserve uncached rates.
      const inputTokenUpperBound =
        Buffer.byteLength(finalSystem, "utf8") +
        Buffer.byteLength(userPrompt, "utf8") +
        256;
      const estimatedCostUsd = computeWorstCaseReservationUsd(
        PROVIDER_MODELS[provider],
        inputTokenUpperBound,
        MAX_TOKENS,
      );
      const reservation = await reserveCostBudget(estimatedCostUsd);
      if (!reservation.ok) throw new CostBudgetExceededError(reservation.denial);
      reservationId = reservation.reservationId;
    }

    try {
      switch (provider) {
        case "openai":
          result = await callOpenAIImpl(finalSystem, userPrompt, jsonMode);
          break;
        case "gemini":
          result = await callGeminiImpl(finalSystem, userPrompt, jsonMode);
          break;
        case "deepseek":
        case "kimi":
        case "qwen":
        case "glm":
          result = await callOpenAICompatibleImpl(
            provider,
            finalSystem,
            userPrompt,
            jsonMode,
          );
          break;
        case "claude":
        default:
          result = await callClaudeImpl(finalSystem, userPrompt);
          break;
      }
    } catch (err) {
      if (reservationId && err instanceof ProviderUsageUnavailableError) {
        // The provider returned a response but omitted billing usage. Keep the
        // maximum reservation rather than committing a zero-cost run.
        reservationId = null;
      }
      throw err;
    }
    if (ctx) {
      const recorded = await recordRun(
        ctx,
        provider,
        result.modelId,
        result.inputTokens,
        result.outputTokens,
        Date.now() - start,
        reservationId,
        result.cachedInputTokens ?? 0,
      );
      if (!recorded) {
        // Keep the reservation until its TTL expires so failed telemetry cannot
        // remove the only accounting for provider spend already incurred.
        reservationId = null;
        throw new Error(
          "Provider usage completed but could not be recorded; the cost reservation remains active until it expires.",
        );
      }
      // On successful ledger write the reservation was deleted atomically.
      reservationId = null;
    }
    return result.text;
  } finally {
    if (reservationId) {
      try {
        await releaseCostBudgetReservation(reservationId);
      } catch (err) {
        logger.warn({ err, reservationId }, "Failed to release model-call cost reservation");
      }
    }
  }
}

/** Extract the first JSON object/array from a string (tolerates stray prose). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const noFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(noFence);
  } catch {
    // fall through
  }
  const start = noFence.indexOf("{");
  const lastBrace = noFence.lastIndexOf("}");
  if (start !== -1 && lastBrace > start) {
    const slice = noFence.slice(start, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // fall through
    }
  }
  throw new Error(`Failed to parse engine JSON response. Raw head: ${raw.slice(0, 200)}`);
}

export async function callLlmJson<T>(
  provider: LlmProvider,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  ctx?: RunContext,
): Promise<T> {
  const raw = await callLlm(provider, systemPrompt, userPrompt, ctx, { jsonMode: true });
  const parsed = extractJson(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Engine output failed schema validation: ${result.error.message}. Raw head: ${raw.slice(0, 200)}`,
    );
  }
  return result.data;
}

// ─── Legacy wrappers (Anthropic-only callers) ─────────────────────────────

/** @deprecated Use callLlm(provider, …) instead. */
export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  ctx?: RunContext,
): Promise<string> {
  return callLlm("claude", systemPrompt, userPrompt, ctx);
}

/** @deprecated Use callLlmJson(provider, …) instead. */
export async function callClaudeJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  ctx?: RunContext,
): Promise<T> {
  return callLlmJson("claude", systemPrompt, userPrompt, schema, ctx);
}

/** Generate a SPARTAN cert ID. Format: SPARTAN-<YYYYMMDD>-<short-uuid>. */
export function generateCertId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const short = randomUUID().split("-")[0]!.toUpperCase();
  return `SPARTAN-${ymd}-${short}`;
}
