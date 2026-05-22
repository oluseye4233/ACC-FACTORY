import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF5Body } from "@workspace/api-zod";
import { F5_QUESTION_SYSTEM, F5_FINALIZE_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const TOTAL_STEPS = 7;

const QuestionOutputSchema = z.object({
  step: z.number().int().min(1).max(TOTAL_STEPS),
  question: z.string(),
});

const SpcOutputSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  iqs: z.number(),
  gro: z.enum(["SAFE_LIFE", "GREY", "RED"]),
  zpos: z.record(z.string(), z.number()),
});

/**
 * F5 is multi-turn. Client passes:
 *   step (1..7): the step currently being answered (omitted on first call)
 *   answers: accumulated step→answer map
 *   finalize: true when client has all 7 answers and wants the SPC
 *
 * Returns either { done:false, nextStep, nextQuestion } or
 *   { done:true, spc:Spc }.
 */
export async function handleF5(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF5Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, step, answers, finalize, provider: bodyProvider } = parsed.data;
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

  const accumulated = (answers ?? {}) as Record<string, unknown>;

  if (finalize) {
    let spc: z.infer<typeof SpcOutputSchema>;
    try {
      spc = await callLlmJson(
        provider,
        F5_FINALIZE_SYSTEM,
        `Accumulated FORGE 7-step answers:\n${JSON.stringify(accumulated, null, 2)}`,
        SpcOutputSchema,
        { sessionId, userId: guard.userId, engineId: 5 },
      );
    } catch (err) {
      if (sendProviderTierError(res, err)) return;
      req.log.error({ err }, "F5 finalize failed");
      res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
      return;
    }
    const artifact = await persistArtifact({
      sessionId,
      userId: guard.userId,
      featureId: 5,
      artifactType: "SPC",
      artifactContent: spc,
      groState: spc.gro,
      provider,
    });
    await advanceFeatureState(sessionId, 5);
    res.json({
      done: true,
      nextStep: null,
      nextQuestion: null,
      spc: { ...spc, artifactId: artifact.id },
    });
    return;
  }

  const nextStep = Math.max(1, Math.min(TOTAL_STEPS, (step ?? 0) + 1));
  let q: z.infer<typeof QuestionOutputSchema>;
  try {
    q = await callLlmJson(
      provider,
      F5_QUESTION_SYSTEM,
      `Current step: ${nextStep} of ${TOTAL_STEPS}.\nAnswers so far:\n${JSON.stringify(accumulated, null, 2)}`,
      QuestionOutputSchema,
      { sessionId, userId: guard.userId, engineId: 5 },
    );
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F5 question failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  res.json({
    done: false,
    nextStep: q.step,
    nextQuestion: q.question,
    spc: null,
  });
}
