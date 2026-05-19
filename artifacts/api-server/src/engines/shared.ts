import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import {
  db,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessFeatureStateTable,
  harnessEscalationsTable,
  harnessEngineRunsTable,
  type ArtifactType,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Request } from "express";
import { computeCostUsd } from "../lib/pricing";
import { logger } from "../lib/logger";

// Sonnet 4 generation; per skill rules — max_tokens minimum 8192.
export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 8192;

export type CertTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "NONE";

/** Per-call telemetry context. Populating this triggers a `harness_engine_runs` row. */
export interface RunContext {
  sessionId: string;
  userId: string;
  engineId: number;
}

export function certTierForJcse(total: number): CertTier {
  // Canonical HIVE 14-D certification bands (per GENERAL_TECHNICAL_TERMS_REGISTRY
  // v1.0 §3 / MASTER_SPC_PLATFORM_REGISTRY v1.0). Hard deployment gate is 45+
  // (Ultra-Premium territory) but the tier labels themselves are the HIVE bands.
  if (total >= 48) return "PLATINUM";
  if (total >= 43) return "GOLD";
  if (total >= 36) return "SILVER";
  if (total >= 30) return "BRONZE";
  return "NONE";
}

export async function ownedSessionOr404(
  req: Request,
  sessionId: string,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const userId = req.localUser?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const rows = await db
    .select({ id: harnessSessionsTable.id })
    .from(harnessSessionsTable)
    .where(
      and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, userId)),
    )
    .limit(1);
  if (rows.length === 0) return { ok: false, status: 404, error: "Session not found" };
  return { ok: true, userId };
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
  artifactContent: Record<string, unknown>;
  jcseScore?: number | null;
  certTier?: string | null;
  groState?: string;
  spartanCert?: Record<string, unknown> | null;
}

export async function persistArtifact(
  input: PersistArtifactInput,
): Promise<typeof harnessArtifactsTable.$inferSelect> {
  const [row] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: input.sessionId,
      userId: input.userId,
      featureId: input.featureId,
      artifactType: input.artifactType,
      artifactContent: input.artifactContent,
      jcseScore: input.jcseScore ?? null,
      certTier: input.certTier ?? null,
      groState: input.groState ?? "SAFE_LIFE",
      spartanCert: input.spartanCert ?? null,
    })
    .returning();
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
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): Promise<void> {
  try {
    const cost = computeCostUsd(MODEL, inputTokens, outputTokens);
    await db.insert(harnessEngineRunsTable).values({
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      engineId: ctx.engineId,
      modelId: MODEL,
      inputTokens,
      outputTokens,
      costUsd: cost.toFixed(6),
      durationMs,
    });
  } catch (err) {
    // Telemetry must never break a request.
    logger.warn({ err }, "Failed to record harness_engine_runs row");
  }
}

/** Call Anthropic with a system+user prompt; return the raw assistant text. */
export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  ctx?: RunContext,
): Promise<string> {
  const start = Date.now();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  if (ctx) {
    await recordRun(
      ctx,
      message.usage?.input_tokens ?? 0,
      message.usage?.output_tokens ?? 0,
      Date.now() - start,
    );
  }
  const block = message.content[0];
  if (!block || block.type !== "text") return "";
  return block.text;
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

/** Call Claude and parse JSON, validated against the provided Zod schema. */
export async function callClaudeJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  ctx?: RunContext,
): Promise<T> {
  const raw = await callClaude(systemPrompt, userPrompt, ctx);
  const parsed = extractJson(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Engine output failed schema validation: ${result.error.message}. Raw head: ${raw.slice(0, 200)}`,
    );
  }
  return result.data;
}

/** Generate a SPARTAN cert ID. Format: SPARTAN-<YYYYMMDD>-<short-uuid>. */
export function generateCertId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const short = randomUUID().split("-")[0]!.toUpperCase();
  return `SPARTAN-${ymd}-${short}`;
}
