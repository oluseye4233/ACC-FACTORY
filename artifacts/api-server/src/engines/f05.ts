import { z } from "zod/v4";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, harnessArtifactsTable, mathmonIntakesTable } from "@workspace/db";
import { F05_MATHMON_SYSTEM } from "./prompts";
import {
  callLlmJson,
  ownedSessionOr404,
  PROVIDER_MODELS,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const F05OutputSchema = z.object({
  measurableVariables: z.array(
    z.object({
      name: z.string(),
      unit: z.string(),
      description: z.string(),
    }),
  ),
  constraintCategories: z.array(
    z.object({ category: z.string(), detail: z.string() }),
  ),
  optimisationTargets: z.array(
    z.object({
      target: z.string(),
      direction: z.enum(["MAXIMISE", "MINIMISE"]),
      metric: z.string(),
    }),
  ),
  summary: z.string(),
});

const Body = z.object({
  sessionId: z.string().uuid(),
  brief: z.string().nullish(),
  provider: z.enum(["claude", "openai", "gemini"]).optional(),
});

/**
 * F0.5 — the MATHMON Applicability Layer. Profiles a session's concept for
 * mathematical applicability and persists a MATHMON Intake Report. The prompt is
 * built from the caller's optional brief and, when available, the session's most
 * recent artifact so the intake reflects the concept as the session has shaped
 * it so far. Non-streaming JSON — the report is small.
 */
export async function handleF05(req: Request, res: Response): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const { sessionId, brief, provider: bodyProvider } = parsed.data;

  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, bodyProvider, guard.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  // Seed the intake from whatever the session already knows: the caller's brief
  // and the latest persisted artifact (SPC, ATLAS PDD, atomic prompt, etc.).
  const latest = await db
    .select({
      artifactType: harnessArtifactsTable.artifactType,
      artifactContent: harnessArtifactsTable.artifactContent,
    })
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.sessionId, sessionId),
        eq(harnessArtifactsTable.userId, guard.userId),
      ),
    )
    .orderBy(desc(harnessArtifactsTable.createdAt))
    .limit(1);

  const trimmedBrief = brief?.trim();
  const source = latest[0];
  if (!trimmedBrief && !source) {
    res.status(409).json({
      error: "NO_CONCEPT_TO_PROFILE",
      detail:
        "Provide a brief or run an earlier HARNESS engine first — F0.5 needs a concept to profile.",
    });
    return;
  }

  const userPrompt = [
    "Profile this concept for mathematical applicability. Produce a MATHMON Intake Report.",
    ...(trimmedBrief ? ["", "=== BRIEF ===", trimmedBrief] : []),
    ...(source
      ? [
          "",
          `=== LATEST SESSION ARTIFACT (${source.artifactType}) ===`,
          JSON.stringify(source.artifactContent, null, 2),
        ]
      : []),
  ].join("\n");

  let out: z.infer<typeof F05OutputSchema>;
  try {
    out = await callLlmJson(provider, F05_MATHMON_SYSTEM, userPrompt, F05OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 10,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F0.5 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  const [row] = await db
    .insert(mathmonIntakesTable)
    .values({
      sessionId,
      userId: guard.userId,
      report: out,
      provider,
      modelId: PROVIDER_MODELS[provider] ?? null,
    })
    .returning();

  res.json({
    id: row!.id,
    sessionId: row!.sessionId,
    report: out,
    provider: row!.provider,
    modelId: row!.modelId,
    createdAt: row!.createdAt,
  });
}
