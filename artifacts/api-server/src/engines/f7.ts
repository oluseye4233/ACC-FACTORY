import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF7StreamBody } from "@workspace/api-zod";
import { F7_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callClaudeJson,
  generateCertId,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
} from "./shared";

const SPARTAN_STEPS = [
  { id: "SCAN", label: "SCAN — enumerate sections, count tokens" },
  { id: "PROFILE", label: "PROFILE — classify A/B/C" },
  { id: "ASSESS", label: "ASSESS — semantic density scoring" },
  { id: "REDUCE", label: "REDUCE — eliminate C, compress B, preserve A" },
  { id: "TRANSFORM", label: "TRANSFORM — atomic rewrite" },
  { id: "ZPOS_5", label: "ZPOS+5 — risk gate" },
  { id: "PACKAGE", label: "PACKAGE — issue MVP PDD + cert" },
] as const;

const F7OutputSchema = z.object({
  sections: z.array(
    z.object({ key: z.string(), title: z.string(), body: z.string() }),
  ),
  donut: z.object({ a: z.number(), b: z.number(), c: z.number() }),
  crP: z.number(),
  class: z.enum(["A", "B", "C"]),
});

export async function handleF7Stream(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF7StreamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, pddArtifactId } = parsed.data;
  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const pdd = await loadArtifact(pddArtifactId, guard.userId);
  if (!pdd || pdd.sessionId !== sessionId || pdd.artifactType !== "ATLAS_PDD") {
    res.status(404).json({ error: "ATLAS PDD artifact not found in this session" });
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
    const userPrompt = `Compress this ATLAS PDD via the 7-step SPARTAN SCM:\n${JSON.stringify(pdd.artifactContent, null, 2)}`;
    return callClaudeJson(F7_SYSTEM, userPrompt, F7OutputSchema);
  })();

  send("start", { totalSteps: SPARTAN_STEPS.length });
  for (let i = 0; i < SPARTAN_STEPS.length; i++) {
    if (clientClosed) break;
    const s = SPARTAN_STEPS[i]!;
    send("step", { index: i, id: s.id, label: s.label, status: "RUNNING" });
    await new Promise((r) => setTimeout(r, 300));
    if (clientClosed) break;
    send("step", { index: i, id: s.id, label: s.label, status: "DONE" });
  }

  let out: z.infer<typeof F7OutputSchema>;
  try {
    out = await llmPromise;
  } catch (err) {
    req.log.error({ err }, "F7 engine call failed");
    send("error", { error: "Engine call failed", detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  const cert = {
    certId: generateCertId(),
    class: out.class,
    crP: out.crP,
    issuedAt: new Date().toISOString(),
  };
  // Persist regardless of client connection — work is done, cert is paid for.
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 7,
    artifactType: "MVP_PDD",
    artifactContent: { sections: out.sections, donut: out.donut },
    spartanCert: cert,
  });
  await advanceFeatureState(sessionId, 7);

  if (clientClosed) return;
  send("complete", {
    sections: out.sections,
    donut: out.donut,
    cert,
    artifactId: artifact.id,
  });
  res.end();
}
