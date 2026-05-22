import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF6Body } from "@workspace/api-zod";
import { F6_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const F6OutputSchema = z.object({
  cheatSheet: z.string(),
  execSummary: z.string(),
  worksheet: z.string(),
  implementation: z.string(),
});

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
  let provider;
  try {
    provider = resolveProvider(req, bodyProvider, guard.preferredModelProvider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  let userPrompt: string;
  if (mode === "FROM_SPC") {
    if (!sourceArtifactId) {
      res.status(400).json({ error: "sourceArtifactId required when mode=FROM_SPC" });
      return;
    }
    const source = await loadArtifact(sourceArtifactId, guard.userId);
    if (
      !source ||
      source.sessionId !== sessionId ||
      source.artifactType !== "SPC"
    ) {
      res.status(404).json({ error: "Source SPC not found in this session" });
      return;
    }
    userPrompt = `Mode: FROM_SPC\n\nSource SPC:\n${JSON.stringify(source.artifactContent, null, 2)}`;
  } else {
    if (!brief) {
      res.status(400).json({ error: "brief required when mode=FRESH" });
      return;
    }
    userPrompt = `Mode: FRESH\n\nBrief:\n${brief}`;
  }

  let out: z.infer<typeof F6OutputSchema>;
  try {
    out = await callLlmJson(provider, F6_SYSTEM, userPrompt, F6OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 6,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F6 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 6,
    artifactType: "ATLAS_PDD",
    artifactContent: out,
    provider,
  });
  await advanceFeatureState(sessionId, 6);
  res.json({ ...out, artifactId: artifact.id });
}
