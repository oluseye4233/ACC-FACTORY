import { z } from "zod/v4";
import type { Request, Response } from "express";
import type { LlmProvider } from "@workspace/db";
import { HarnessF5Body, HarnessF5FinalizeStreamBody } from "@workspace/api-zod";
import { F5_QUESTION_SYSTEM, F5_FINALIZE_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
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

type Spc = z.infer<typeof SpcOutputSchema>;

// FORGE.COMMIT synthesis is the heavy single LLM call of F5. It is delivered
// over SSE (see handleF5FinalizeStream) so the proxy sees bytes well within its
// request timeout instead of waiting for a multi-minute generation and aborting
// with a 502. The LLM call and persistence are split into the two helpers below
// so the streaming handler and the legacy JSON `finalize` branch share one code
// path.
function synthesiseSpc(
  provider: LlmProvider,
  accumulated: Record<string, unknown>,
  sessionId: string,
  userId: string,
): Promise<Spc> {
  return callLlmJson(
    provider,
    F5_FINALIZE_SYSTEM,
    `Accumulated FORGE 7-step answers:\n${JSON.stringify(accumulated, null, 2)}`,
    SpcOutputSchema,
    { sessionId, userId, engineId: 5 },
  );
}

async function persistSpc(
  spc: Spc,
  sessionId: string,
  userId: string,
  provider: LlmProvider,
  name?: string | null,
): Promise<{ id: string }> {
  const trimmed = name?.trim();
  const artifact = await persistArtifact({
    sessionId,
    userId,
    featureId: 5,
    artifactType: "SPC",
    name: trimmed ? trimmed : null,
    artifactContent: spc,
    groState: spc.gro,
    provider,
  });
  await advanceFeatureState(sessionId, 5);
  return artifact;
}

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
    // Legacy non-streaming finalize. The front-end now uses the SSE
    // handleF5FinalizeStream path so a multi-minute synthesis doesn't trip the
    // proxy's request timeout, but this branch stays for API completeness.
    let spc: Spc;
    try {
      spc = await synthesiseSpc(provider, accumulated, sessionId, guard.userId);
    } catch (err) {
      if (sendProviderTierError(res, err)) return;
      req.log.error({ err }, "F5 finalize failed");
      res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
      return;
    }
    const artifact = await persistSpc(spc, sessionId, guard.userId, provider);
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

// Deterministic UI checkpoints streamed while the LLM synthesises the SPC.
const COMMIT_STEPS = [
  { id: "ASSEMBLE", label: "ASSEMBLE — gather the 7 FORGE answers" },
  { id: "DRAFT", label: "DRAFT — compose the 15 SPC sections" },
  { id: "SCORE", label: "SCORE — compute IQS + Z-positions" },
  { id: "GATE", label: "GATE — resolve GRO risk verdict" },
  { id: "CERTIFY", label: "CERTIFY — seal the SPC artifact" },
] as const;

/**
 * FORGE.COMMIT synthesis as an SSE stream. The full SPC generation is the heavy
 * (potentially multi-minute) LLM call of F5; streaming progress events flushes
 * bytes to the client immediately so the proxy doesn't abort the request at its
 * timeout (the failure mode that surfaced as a 502 "couldn't reach this app").
 */
export async function handleF5FinalizeStream(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF5FinalizeStreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, answers, name, provider: bodyProvider } = parsed.data;
  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider: LlmProvider;
  try {
    provider = resolveProvider(req, bodyProvider, guard.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  const accumulated = (answers ?? {}) as Record<string, unknown>;

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

  // Kick off the LLM synthesis while progress checkpoints stream in parallel.
  const llmPromise = synthesiseSpc(provider, accumulated, sessionId, guard.userId);

  send("start", { totalSteps: COMMIT_STEPS.length });
  for (let i = 0; i < COMMIT_STEPS.length; i++) {
    if (clientClosed) break;
    const s = COMMIT_STEPS[i]!;
    send("step", { index: i, id: s.id, label: s.label, status: "RUNNING" });
    await new Promise((r) => setTimeout(r, 300));
    if (clientClosed) break;
    send("step", { index: i, id: s.id, label: s.label, status: "DONE" });
  }

  let spc: Spc;
  try {
    spc = await llmPromise;
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
    req.log.error({ err, code }, "F5 finalize stream failed");
    send("error", { error: code, code, provider: errProvider, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // Persist regardless of client connection — the work is done and paid for.
  const artifact = await persistSpc(spc, sessionId, guard.userId, provider, name);

  if (clientClosed) return;
  const persistedName = name?.trim() || null;
  send("complete", { ...spc, name: persistedName, artifactId: artifact.id });
  res.end();
}
