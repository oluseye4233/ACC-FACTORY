import { z } from "zod/v4";
import type { Request, Response } from "express";
import { ATLAS_CRYSTALLISE_SYSTEM } from "./prompts";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const PHASES = [
  "RED",
  "ORANGE",
  "YELLOW",
  "GREEN",
  "BLUE",
  "INDIGO",
  "VIOLET",
  "WHITE",
] as const;

export const AtlasJsonSchema = z.object({
  schemaVersion: z.literal("atlas-pdd-v1"),
  title: z.string().min(3),
  summary: z.string().max(400),
  prompts: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^P-(RED|ORANGE|YELLOW|GREEN|BLUE|INDIGO|VIOLET|WHITE)-\d{3}$/),
        phase: z.enum(PHASES),
        title: z.string().min(1),
        operation: z.string().min(1),
        classification: z.enum(["A", "B", "C"]),
        dependencies: z.array(z.string()),
        sourceSection: z.enum([
          "cheatSheet",
          "execSummary",
          "worksheet",
          "implementation",
        ]),
      }),
    )
    .min(1)
    .max(80),
  stack: z.array(z.string()),
  routes: z.array(z.string()),
  deployTarget: z.string(),
});

const Body = z.object({
  sessionId: z.string().uuid(),
  atlasPddArtifactId: z.string().uuid(),
  provider: z.enum(["claude", "openai", "gemini", "deepseek", "kimi", "qwen", "glm"]).optional(),
});

export async function handleAtlasCrystallise(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const { sessionId, atlasPddArtifactId, provider: bodyProvider } = parsed.data;

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

  const source = await loadArtifact(atlasPddArtifactId, guard.userId);
  if (
    !source ||
    source.sessionId !== sessionId ||
    source.artifactType !== "ATLAS_PDD"
  ) {
    res.status(404).json({ error: "Source ATLAS PDD not found in this session" });
    return;
  }

  const userPrompt = [
    "Crystallise this 4-Part ATLAS PDD into the typed JSON view. Use only what the source contains; do not invent.",
    "",
    "=== SOURCE ATLAS PDD ===",
    JSON.stringify(source.artifactContent, null, 2),
  ].join("\n");

  let out: z.infer<typeof AtlasJsonSchema>;
  try {
    out = await callLlmJson(provider, ATLAS_CRYSTALLISE_SYSTEM, userPrompt, AtlasJsonSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 10,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "Atlas crystallise call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 6,
    artifactType: "ATLAS_PDD_JSON",
    artifactContent: { ...out, sourceAtlasPddArtifactId: atlasPddArtifactId },
    provider,
  });

  res.json({ artifactId: artifact.id, ...out });
}
