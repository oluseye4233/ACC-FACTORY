import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF4Body } from "@workspace/api-zod";
import { F4_SYSTEM } from "./prompts";
import { ColonizationTargetSchema, colonizationContext } from "./colonization-target";
import { assertGovernance } from "../lib/artifact-governance";
import {
  advanceFeatureState,
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const F4OutputSchema = z.object({
  cheatSheet: z.string(),
  worksheet: z.string(),
  buildLaunch: z.string(),
  interfaceContract: z.string(),
});

export async function handleF4(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF4Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, sourceArtifactId, provider: bodyProvider } = parsed.data;
  const targetResult = ColonizationTargetSchema.safeParse(parsed.data.colonizationTarget ?? "UNDECIDED");
  if (!targetResult.success) {
    res.status(400).json({ error: "Choose a colonization target from the F10 catalog" });
    return;
  }
  const target = targetResult.data;
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
  const source = await loadArtifact(sourceArtifactId, guard.userId);
  if (!source || source.sessionId !== sessionId) {
    res.status(404).json({ error: "Source artifact not found in this session" });
    return;
  }
  if (["MA_BIRTH_PACKAGE", "SPC"].includes(source.artifactType)) {
    try { assertGovernance(source.artifactContent); } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Governance review required", code: "GOVERNANCE_REQUIRED" });
      return;
    }
  }
  const userPrompt = `Source artifact (${source.artifactType}):\n${JSON.stringify(source.artifactContent, null, 2)}\n\n${colonizationContext(target)}\nDo not lock the implementation stack or IDE at F4.`;
  let out: z.infer<typeof F4OutputSchema>;
  try {
    out = await callLlmJson(provider, F4_SYSTEM, userPrompt, F4OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 4,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F4 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 4,
    artifactType: "MICRO_PDD",
    artifactContent: { ...out, colonizationTarget: target, sourceArtifactId },
    provider,
  });
  await advanceFeatureState(sessionId, 4);
  res.json({ ...out, artifactId: artifact.id });
}
