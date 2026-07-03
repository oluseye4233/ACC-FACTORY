import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF3StreamBody } from "@workspace/api-zod";
import { F3_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  ownedSessionOr404,
  persistArtifact,
  recordEscalation,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
} from "./shared";

const ORGANELLES = [
  { id: "NUCLEUS", name: "Nucleus (intent core)" },
  { id: "MITOCHONDRION", name: "Mitochondrion (energy / motivation)" },
  { id: "RIBOSOME", name: "Ribosome (skill synthesis)" },
  { id: "ENDOPLASMIC_RETICULUM", name: "ER (knowledge transport)" },
  { id: "GOLGI_APPARATUS", name: "Golgi (output packaging)" },
  { id: "LYSOSOME", name: "Lysosome (failure cleanup)" },
  { id: "CYTOSKELETON", name: "Cytoskeleton (structural memory)" },
  { id: "MEMBRANE", name: "Membrane (boundary / interface)" },
] as const;

const F3OutputSchema = z.object({
  classification: z.object({
    phase: z.enum(["PHASE_1", "PHASE_2", "PHASE_3"]),
    kind: z.string(),
    confidence: z.number(),
    rationale: z.string(),
  }),
  organelles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      output: z.string().nullable().optional(),
    }),
  ),
  birthPackage: z.object({
    overview: z.string(),
    capability: z.string(),
    knowledge: z.string(),
    behaviour: z.string(),
    lifecycle: z.string(),
  }),
  escalated: z.boolean(),
});

export async function handleF3Stream(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF3StreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, atomicPrompt, intent, provider: bodyProvider } = parsed.data;
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

  // Stream organelle progress (deterministic UI events) while LLM builds the
  // package in parallel.
  const llmPromise = (async () => {
    const userPrompt = `Atomic Prompt:\n${JSON.stringify(atomicPrompt, null, 2)}\n\nIntent: ${intent ?? "(none provided)"}`;
    return callLlmJson(provider, F3_SYSTEM, userPrompt, F3OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 3,
    });
  })();

  send("start", { totalOrganelles: ORGANELLES.length });
  for (let i = 0; i < ORGANELLES.length; i++) {
    if (clientClosed) break;
    const o = ORGANELLES[i]!;
    send("organelle", { index: i, id: o.id, name: o.name, status: "CULTIVATING" });
    await new Promise((r) => setTimeout(r, 250));
    if (clientClosed) break;
    send("organelle", { index: i, id: o.id, name: o.name, status: "CULTIVATED" });
  }

  let out: z.infer<typeof F3OutputSchema>;
  try {
    out = await llmPromise;
  } catch (err) {
    const code =
      err instanceof ProviderRequiresTierError
        ? "PROVIDER_REQUIRES_TIER"
        : err instanceof ProviderNotConfiguredError
          ? "PROVIDER_NOT_CONFIGURED"
          : "ENGINE_CALL_FAILED";
    const provider =
      err instanceof ProviderRequiresTierError || err instanceof ProviderNotConfiguredError
        ? err.provider
        : undefined;
    req.log.error({ err, code }, "F3 engine call failed");
    send("error", { error: code, code, provider, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // Persist + escalation are durable side effects — do them even if client closed.
  if (out.escalated) {
    await recordEscalation(
      sessionId,
      3,
      5,
      `F3 classification ${out.classification.phase} (${out.classification.kind}) triggered escalation`,
    );
  }
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 3,
    artifactType: "MA_BIRTH_PACKAGE",
    artifactContent: out,
    provider,
  });
  await advanceFeatureState(sessionId, 3);

  // Fire-and-await email — a mid-stream disconnect must not drop the notification
  // (matches the F7 pattern: email before the clientClosed check).
  if (out.escalated && req.localUser?.email) {
    const { sendEscalationGranted } = await import("@workspace/email");
    const { db: _db, harnessSessionsTable: _t } = await import("@workspace/db");
    const { eq: _eq } = await import("drizzle-orm");
    const rows = await _db
      .select({ name: _t.sessionName })
      .from(_t)
      .where(_eq(_t.id, sessionId))
      .limit(1);
    sendEscalationGranted({
      to: req.localUser.email,
      engine: "F3 → F5",
      sessionName: rows[0]?.name ?? "Untitled session",
    }).catch((err) => req.log.warn({ err }, "sendEscalationGranted failed"));
  }

  if (clientClosed) return;
  send("classification", out.classification);
  if (out.escalated) {
    send("escalation", { from: 3, to: 5 });
  }
  send("complete", { ...out, artifactId: artifact.id });
  res.end();
}
