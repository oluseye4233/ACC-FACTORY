import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF4Body } from "@workspace/api-zod";
import { F4_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callClaudeJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
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
  const { sessionId, sourceArtifactId, targetVibe } = parsed.data;
  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const source = await loadArtifact(sourceArtifactId, guard.userId);
  if (!source || source.sessionId !== sessionId) {
    res.status(404).json({ error: "Source artifact not found in this session" });
    return;
  }
  const userPrompt = `Source artifact (${source.artifactType}):\n${JSON.stringify(source.artifactContent, null, 2)}\n\nTarget VIBE: ${targetVibe}`;
  let out: z.infer<typeof F4OutputSchema>;
  try {
    out = await callClaudeJson(F4_SYSTEM, userPrompt, F4OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 4,
    });
  } catch (err) {
    req.log.error({ err }, "F4 engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 4,
    artifactType: "MICRO_PDD",
    artifactContent: out,
  });
  await advanceFeatureState(sessionId, 4);
  res.json({ ...out, artifactId: artifact.id });
}
