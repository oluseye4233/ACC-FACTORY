import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF6Body, HarnessF6DraftStreamBody } from "@workspace/api-zod";
import type { LlmProvider } from "@workspace/db";
import { F6_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
} from "./shared";

const F6OutputSchema = z.object({
  cheatSheet: z.string(),
  execSummary: z.string(),
  worksheet: z.string(),
  implementation: z.string(),
});

type AtlasPdd = z.infer<typeof F6OutputSchema>;

class MissingSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Build the F6 user prompt from either a source SPC or a fresh brief. Throws
 * MissingSourceError (with a status) so both the JSON and SSE callers can map it
 * to the right response shape.
 */
async function buildF6Prompt(
  mode: string,
  sessionId: string,
  userId: string,
  sourceArtifactId: string | null | undefined,
  brief: string | null | undefined,
): Promise<string> {
  if (mode === "FROM_SPC") {
    if (!sourceArtifactId) {
      throw new MissingSourceError("sourceArtifactId required when mode=FROM_SPC", 400);
    }
    const source = await loadArtifact(sourceArtifactId, userId);
    if (!source || source.sessionId !== sessionId || source.artifactType !== "SPC") {
      throw new MissingSourceError("Source SPC not found in this session", 404);
    }
    return `Mode: FROM_SPC\n\nSource SPC:\n${JSON.stringify(source.artifactContent, null, 2)}`;
  }
  if (!brief) {
    throw new MissingSourceError("brief required when mode=FRESH", 400);
  }
  return `Mode: FRESH\n\nBrief:\n${brief}`;
}

async function synthesiseAtlasPdd(
  provider: LlmProvider,
  userPrompt: string,
  sessionId: string,
  userId: string,
): Promise<AtlasPdd> {
  return callLlmJson(provider, F6_SYSTEM, userPrompt, F6OutputSchema, {
    sessionId,
    userId,
    engineId: 6,
  });
}

async function persistAtlasPdd(
  out: AtlasPdd,
  sessionId: string,
  userId: string,
  provider: LlmProvider,
) {
  const artifact = await persistArtifact({
    sessionId,
    userId,
    featureId: 6,
    artifactType: "ATLAS_PDD",
    artifactContent: out,
    provider,
  });
  await advanceFeatureState(sessionId, 6);
  return artifact;
}

export async function handleF6(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF6Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, mode, sourceArtifactId, brief, provider: bodyProvider } = parsed.data;
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

  let userPrompt: string;
  try {
    userPrompt = await buildF6Prompt(mode, sessionId, guard.userId, sourceArtifactId, brief);
  } catch (err) {
    if (err instanceof MissingSourceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  let out: AtlasPdd;
  try {
    out = await synthesiseAtlasPdd(provider, userPrompt, sessionId, guard.userId);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F6 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const artifact = await persistAtlasPdd(out, sessionId, guard.userId, provider);
  res.json({ ...out, artifactId: artifact.id });
}

// Deterministic UI checkpoints streamed while the LLM drafts the 4-Part PDD.
const DRAFT_STEPS = [
  { id: "AUDIT", label: "AUDIT — read the source SPC / brief" },
  { id: "TRIANGULATE", label: "TRIANGULATE — reconcile the 4 ATLAS parts" },
  { id: "LAYOUT", label: "LAYOUT — structure cheat-sheet + exec + worksheet" },
  { id: "ASSEMBLE", label: "ASSEMBLE — write the implementation guide" },
  { id: "STAMP", label: "STAMP — seal the 4-Part ATLAS PDD" },
] as const;

/**
 * ATLAS PDD draft as an SSE stream. The 4-part draft is a heavy single LLM call;
 * streaming progress events flushes bytes immediately so the proxy doesn't abort
 * the request at its timeout (the 502 "couldn't reach this app" failure mode).
 */
export async function handleF6DraftStream(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF6DraftStreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, mode, sourceArtifactId, brief, provider: bodyProvider } = parsed.data;
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

  let userPrompt: string;
  try {
    userPrompt = await buildF6Prompt(mode, sessionId, guard.userId, sourceArtifactId, brief);
  } catch (err) {
    if (err instanceof MissingSourceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
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

  // Kick off the LLM draft while progress checkpoints stream in parallel.
  const llmPromise = synthesiseAtlasPdd(provider, userPrompt, sessionId, guard.userId);

  send("start", { totalSteps: DRAFT_STEPS.length });
  for (let i = 0; i < DRAFT_STEPS.length; i++) {
    if (clientClosed) break;
    const s = DRAFT_STEPS[i]!;
    send("step", { index: i, id: s.id, label: s.label, status: "RUNNING" });
    await new Promise((r) => setTimeout(r, 300));
    if (clientClosed) break;
    send("step", { index: i, id: s.id, label: s.label, status: "DONE" });
  }

  let out: AtlasPdd;
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
    req.log.error({ err, code }, "F6 draft stream failed");
    send("error", { error: code, code, provider: errProvider, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // Persist regardless of client connection — the work is done and paid for.
  const artifact = await persistAtlasPdd(out, sessionId, guard.userId, provider);

  if (clientClosed) return;
  send("complete", { ...out, artifactId: artifact.id });
  res.end();
}
