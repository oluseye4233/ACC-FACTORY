import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF8Body } from "@workspace/api-zod";
import { F8_CODE_DJ_SYSTEM } from "./prompts";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const PLATFORMS = [
  "nextjs-vercel",
  "react-vite-static",
  "express-replit",
  "expo-mobile",
  "pnpm-monorepo",
] as const;

const CodebaseOutputSchema = z.object({
  platform: z.enum(PLATFORMS),
  framework: z.string().min(1),
  language: z.enum(["typescript", "javascript"]),
  files: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .max(200)
          .refine((p) => !p.startsWith("/") && !p.includes(".."), {
            message: "path must be relative and free of '..' traversal",
          }),
        language: z.string().min(1).max(40),
        content: z.string().max(40_000),
      }),
    )
    .min(1)
    .max(12),
  manifest: z.object({
    framework: z.string().min(1),
    language: z.string().min(1),
    entrypoint: z.string().min(1),
    installCommand: z.string().min(1),
    runCommand: z.string().min(1),
    buildCommand: z.string().nullable(),
    deployTarget: z.string().min(1),
  }),
  notes: z.string().max(800).default(""),
});

export async function handleF8CodeDj(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = HarnessF8Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sessionId, mvpPddArtifactId, platform, notes, provider: bodyProvider } = parsed.data;

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

  const mvp = await loadArtifact(mvpPddArtifactId, guard.userId);
  if (!mvp || mvp.sessionId !== sessionId || mvp.artifactType !== "MVP_PDD") {
    res
      .status(404)
      .json({ error: "Certified MVP PDD artifact not found in this session" });
    return;
  }
  // Defensive: only generate from artefacts that actually passed SPARTAN.
  if (!mvp.spartanCert) {
    res.status(409).json({
      error: "Source MVP PDD is not SPARTAN-certified",
      detail: "Code DJ refuses to scaffold from an uncertified bundle.",
    });
    return;
  }

  const userPrompt = [
    `TARGET PLATFORM: ${platform}`,
    notes ? `OPERATOR NOTES: ${notes}` : null,
    "",
    "CERTIFIED MVP PDD (source contract):",
    JSON.stringify(mvp.artifactContent, null, 2),
  ]
    .filter(Boolean)
    .join("\n");

  let out: z.infer<typeof CodebaseOutputSchema>;
  try {
    out = await callLlmJson(
      provider,
      F8_CODE_DJ_SYSTEM,
      userPrompt,
      CodebaseOutputSchema,
      // engineId=9 keeps F8 telemetry separable from DE-SPC (engineId=8). The
      // rate-limit FEATURE_COL still uses key 8 because that maps to the
      // f8_today column; the two numbers are deliberately different concerns.
      { sessionId, userId: guard.userId, engineId: 9 },
    );
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F8 Code DJ engine call failed");
    res.status(502).json({
      error: "Engine call failed",
      detail: (err as Error).message,
    });
    return;
  }

  if (out.platform !== platform) {
    req.log.warn(
      { requested: platform, returned: out.platform },
      "F8 returned a different platform than requested — pinning to request",
    );
    out.platform = platform;
  }

  // Persist the bundle as a CODEBASE_BUNDLE artifact (no SPARTAN cert — it is
  // downstream of one; the source MVP PDD's cert is the lineage anchor).
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 8,
    artifactType: "CODEBASE_BUNDLE",
    artifactContent: {
      platform: out.platform,
      manifest: out.manifest,
      files: out.files,
      notes: out.notes,
      sourceMvpPddArtifactId: mvpPddArtifactId,
      sourceCertId:
        (mvp.spartanCert as { certId?: string } | null)?.certId ?? null,
    },
  });

  res.json({
    artifactId: artifact.id,
    platform: out.platform,
    manifest: out.manifest,
    files: out.files,
    notes: out.notes,
  });
}
