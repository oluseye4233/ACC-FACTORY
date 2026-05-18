import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import {
  db,
  harnessSessionsTable,
  harnessArtifactsTable,
  harnessFeatureStateTable,
  harnessEscalationsTable,
  type ArtifactType,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Request } from "express";

// Sonnet 4 generation; per skill rules — max_tokens minimum 8192.
export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 8192;

export type CertTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "NONE";

export function certTierForJcse(total: number): CertTier {
  if (total >= 45) return "PLATINUM";
  if (total >= 40) return "GOLD";
  if (total >= 35) return "SILVER";
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

/** Mark the current feature COMPLETE and unlock the next one (best-effort).
 *  Re-running a feature must never downgrade a later COMPLETE feature back to
 *  AVAILABLE — we only unlock the next feature when it is still LOCKED. */
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

/** Call Anthropic with a system+user prompt; return the raw assistant text. */
export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = message.content[0];
  if (!block || block.type !== "text") return "";
  return block.text;
}

/** Extract the first JSON object/array from a string (tolerates stray prose). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // strip markdown fences if any
  const noFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  // try direct parse first
  try {
    return JSON.parse(noFence);
  } catch {
    // fall through
  }
  // find first { ... } balanced
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
): Promise<T> {
  const raw = await callClaude(systemPrompt, userPrompt);
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
