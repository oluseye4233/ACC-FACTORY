import { z } from "zod/v4";
import type { Request, Response } from "express";
import { db, mathmonMapsTable } from "@workspace/db";
import { MAP_SYSTEM } from "./prompts";
import {
  callLlmJson,
  ownedSessionOr404,
  PROVIDER_MODELS,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
} from "./shared";
import {
  clampScore,
  computeMathmonScore,
  FORGE_VERIFIED_DISCLAIMER,
} from "../lib/mathmon";
import { loadLatestIntake } from "../lib/mathmon-store";

const MAP_STEPS = [
  { id: "GOVERNING", label: "GOVERNING EQUATIONS — formalise the variables" },
  { id: "SIMULATE", label: "SIMULATIONS — model design" },
  { id: "OPTIMISE", label: "OPTIMISATION GOALS — objective + constraints" },
  { id: "RISK", label: "RISK MODELS — downside + sensitivity" },
  { id: "ECONOMICS", label: "ECONOMIC PROJECTIONS — modelled ranges" },
  { id: "METRICS", label: "PERFORMANCE METRICS — proof of concept" },
  { id: "SCORE", label: "SCORE — MATHMON sub-scores" },
] as const;

const ECONOMIC_SECTION_KEY = "economic_projections";

const MapOutputSchema = z.object({
  sections: z.array(
    z.object({ key: z.string(), title: z.string(), body: z.string() }),
  ),
  mathCoherence: z.number(),
  applicability: z.number(),
  predictiveReliability: z.number(),
});

const Body = z.object({
  sessionId: z.string().uuid(),
  provider: z.enum(["claude", "openai", "gemini", "deepseek", "kimi", "qwen", "glm"]).optional(),
});

/**
 * MAP engine — the Mathematical Applicability Profile builder. Consumes the
 * session's latest MATHMON Intake Report and produces the six-section profile
 * plus three 0–100 sub-scores. Streams progress over SSE (heavy single-shot
 * finalize would breach the 120s proxy ceiling).
 *
 * PFP discipline: the composite MATHMON score is recomputed server-side from
 * the three sub-scores — never trusts a model-reported composite. Each sub-score
 * is clamped to 0–100. The mandatory FORGE VERIFIED disclaimer is appended to
 * the RANGE-ONLY economic projections section and persisted on the row.
 */
export async function handleMapStream(req: Request, res: Response): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, provider: bodyProvider } = parsed.data;
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

  const intake = await loadLatestIntake(sessionId, guard.userId);
  if (!intake) {
    res.status(409).json({
      error: "NO_MATHMON_INTAKE",
      detail: "Run F0.5 (MATHMON Intake) before building the MAP.",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
  });
  const send = (event: string, data: unknown): boolean => {
    if (clientClosed) return false;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  };

  const llmPromise = (async () => {
    const userPrompt = `Build the Mathematical Applicability Profile from this MATHMON Intake Report:\n${JSON.stringify(intake.report, null, 2)}`;
    return callLlmJson(provider, MAP_SYSTEM, userPrompt, MapOutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 11,
    });
  })();

  send("start", { totalSteps: MAP_STEPS.length });
  for (let i = 0; i < MAP_STEPS.length; i++) {
    if (clientClosed) break;
    const s = MAP_STEPS[i]!;
    send("step", { index: i, id: s.id, label: s.label, status: "RUNNING" });
    await new Promise((r) => setTimeout(r, 300));
    if (clientClosed) break;
    send("step", { index: i, id: s.id, label: s.label, status: "DONE" });
  }

  let out: z.infer<typeof MapOutputSchema>;
  try {
    out = await llmPromise;
  } catch (err) {
    const code =
      err instanceof ProviderRequiresTierError
        ? "PROVIDER_REQUIRES_TIER"
        : err instanceof ProviderNotConfiguredError
          ? "PROVIDER_NOT_CONFIGURED"
          : "ENGINE_CALL_FAILED";
    const errProvider =
      err instanceof ProviderRequiresTierError || err instanceof ProviderNotConfiguredError
        ? err.provider
        : undefined;
    req.log.error({ err, code }, "MAP engine call failed");
    send("error", { error: code, code, provider: errProvider, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // PFP discipline: clamp each sub-score, recompute the composite server-side.
  const mathCoherence = clampScore(out.mathCoherence);
  const applicability = clampScore(out.applicability);
  const predictiveReliability = clampScore(out.predictiveReliability);
  const mathmonScore = computeMathmonScore({
    mathCoherence,
    applicability,
    predictiveReliability,
  });

  // Append the mandatory FORGE VERIFIED disclaimer to the RANGE-ONLY economic
  // projections section (defence-in-depth — the prompt already demands ranges).
  const sections = out.sections.map((s) =>
    s.key === ECONOMIC_SECTION_KEY
      ? { ...s, body: `${s.body}\n\n${FORGE_VERIFIED_DISCLAIMER}` }
      : s,
  );

  const [row] = await db
    .insert(mathmonMapsTable)
    .values({
      sessionId,
      userId: guard.userId,
      intakeId: intake.id,
      map: { sections },
      mathCoherence,
      applicability,
      predictiveReliability,
      disclaimer: FORGE_VERIFIED_DISCLAIMER,
      provider,
      modelId: PROVIDER_MODELS[provider] ?? null,
    })
    .returning();

  if (clientClosed) return;
  send("complete", {
    id: row!.id,
    sessionId,
    sections,
    mathCoherence,
    applicability,
    predictiveReliability,
    mathmonScore,
    disclaimer: FORGE_VERIFIED_DISCLAIMER,
    createdAt: row!.createdAt,
  });
  res.end();
}
