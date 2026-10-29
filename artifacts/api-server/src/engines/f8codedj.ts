import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF8Body } from "@workspace/api-zod";
import { F8_CODE_DJ_SYSTEM } from "./prompts";
import { ColonizationTargetSchema, colonizationContext } from "./colonization-target";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";
import { latestPfpForMvp } from "./pfp";
import { getHardwareConfig } from "./hardware-configs";
import { F8_LANGUAGES, F8_LANGUAGE_INSTRUCTION, validateF8LanguageBundle } from "./f8-language-policy";

const PLATFORMS = [
  "nextjs-vercel",
  "react-vite-static",
  "express-replit",
  "expo-mobile",
  "pnpm-monorepo",
  "portable-source",
] as const;

const GENERATED_NOTES_MAX = 800;
const DEFAULT_HOST: Record<typeof PLATFORMS[number], string> = {
  "nextjs-vercel": "vercel",
  "react-vite-static": "cloudflare-pages",
  "express-replit": "replit-deployments",
  "expo-mobile": "expo-eas",
  "pnpm-monorepo": "replit-deployments",
  "portable-source": "replit-deployments",
};

export function validateImplementationBundle(bundle: z.infer<typeof CodebaseOutputSchema>, host?: string): string | null {
  const paths = bundle.files.map(f => f.path);
  if (new Set(paths).size !== paths.length) return "Generated file paths must be unique";
  if (!paths.includes(bundle.manifest.entrypoint)) return "Generated entrypoint must exist in the file bundle";
  const languageError = validateF8LanguageBundle(bundle);
  if (languageError) return languageError;
  if (bundle.collaboration) {
    const { oracle, dj } = bundle.collaboration;
    const requirements = oracle.map(finding => finding.requirement);
    if (new Set(requirements).size !== requirements.length) return "CODE ORACLE requirements must be unique in the review";
    const djRequirements = dj.map(change => change.requirement);
    if (new Set(djRequirements).size !== djRequirements.length) return "CODE DJ changes must not duplicate a requirement";
    for (const finding of oracle) {
      if (finding.resolution === "NEEDS_SOURCE_DECISION") continue;
      const change = dj.find(item => item.requirement === finding.requirement);
      if (!change || !change.files.length || !change.files.every(path => paths.includes(path))) {
        return `CODE DJ must link the CODE ORACLE finding "${finding.requirement}" to generated files`;
      }
    }
    if (dj.some(change => !change.files.length || change.files.some(path => !paths.includes(path)))) {
      return "CODE DJ referenced a file not present in the generated bundle";
    }
    if (dj.some(change => !oracle.some(finding =>
      finding.requirement === change.requirement && finding.resolution === "CODE_CHANGE"))) {
      return "CODE DJ changes must correspond to a CODE ORACLE finding";
    }
  }
  if (host && bundle.manifest.deployTarget !== host) return "Generated deployment manifest must follow the source-bound HOST DJ recommendation";
  if (host === "expo-eas" && bundle.platform !== "expo-mobile") return "Expo EAS requires an Expo implementation";
  if (bundle.platform === "expo-mobile" && host && host !== "expo-eas") return "Expo implementation requires an Expo-compatible hosting plan";
  if (["cloudflare-pages", "netlify"].includes(host ?? "") &&
    !["react-vite-static", "nextjs-vercel"].includes(bundle.platform)) return "The recommended static host is incompatible with this server implementation";
  return null;
}

export const CodebaseOutputSchema = z.object({
  platform: z.enum(PLATFORMS),
  implementationPath: z.object({
    rationale: z.string().min(1).max(1200),
    recommendedIde: z.string().min(1).max(120),
    recommendedVibe: z.string().min(1).max(240),
    hostingRationale: z.string().min(1).max(600),
    requirementTrace: z.array(z.string().max(250)).min(1).max(12),
  }).optional(),
  collaboration: z.object({
    oracle: z.array(z.object({
      requirement: z.string().min(1).max(240),
      gap: z.string().min(1).max(500),
      resolution: z.enum(["CODE_CHANGE", "NEEDS_SOURCE_DECISION"]),
    })).max(12),
    dj: z.array(z.object({
      requirement: z.string().min(1).max(240),
      change: z.string().min(1).max(500),
      files: z.array(z.string().min(1).max(200)).min(1).max(12),
    })).max(12),
  }).optional(),
  framework: z.string().min(1),
  language: z.enum(F8_LANGUAGES),
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
  // Models occasionally ignore the prompt's shorter notes limit. Notes are
  // supplementary metadata, so bound them at the schema boundary instead of
  // turning an otherwise valid scaffold into a 502.
  notes: z.preprocess(
    (value) => (typeof value === "string" ? value.slice(0, GENERATED_NOTES_MAX) : value),
    z.string().max(GENERATED_NOTES_MAX).default(""),
  ),
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
  const {
    sessionId,
    mvpPddArtifactId,
    platform,
    language = "javascript",
    microPddArtifactId,
    hostingPlanArtifactId,
    artifactClass,
    hardwareConfigId,
    notes,
    provider: bodyProvider,
  } = parsed.data;
  if (language !== "javascript" && platform && platform !== "portable-source") {
    res.status(400).json({ error: "Select portable-source or automatic implementation for Python, SQL and C-family output.", code: "F8_LANGUAGE_PLATFORM_MISMATCH" });
    return;
  }
  const hardwareConfig = hardwareConfigId ? getHardwareConfig(hardwareConfigId) : undefined;
  if (artifactClass === "FIRMWARE" && !hardwareConfig) {
    res.status(400).json({
      error: "Firmware artifacts require a hardware configuration",
      code: "HARDWARE_CONFIG_REQUIRED",
    });
    return;
  }
  const acknowledgeDrift =
    (req.body as { acknowledgeDrift?: boolean })?.acknowledgeDrift === true;

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
      detail: "Code ORACLE refuses to scaffold from an uncertified bundle.",
    });
    return;
  }
  const micro = microPddArtifactId ? await loadArtifact(microPddArtifactId, guard.userId) : null;
  if (microPddArtifactId && (!micro || micro.sessionId !== sessionId || micro.artifactType !== "MICRO_PDD")) {
    res.status(404).json({ error: "Micro PDD source not found in this session" });
    return;
  }
  const mvpContent = mvp.artifactContent as Record<string, unknown>;
  const sourcePddId = mvpContent.sourcePddArtifactId;
  const pdd = typeof sourcePddId === "string" ? await loadArtifact(sourcePddId, guard.userId) : null;
  const colonizationTarget = ColonizationTargetSchema.safeParse(mvpContent.colonizationTarget);
  const hosting = hostingPlanArtifactId ? await loadArtifact(hostingPlanArtifactId, guard.userId) : null;
  const hostingContent = hosting?.artifactContent as {
    sourceMvpPddArtifactId?: string;
    primary?: { platform?: string };
  } | undefined;
  if (hostingPlanArtifactId && (!hosting || hosting.sessionId !== sessionId ||
    hosting.artifactType !== "HOSTING_PLAN" || hostingContent?.sourceMvpPddArtifactId !== mvp.id)) {
    res.status(409).json({ error: "Hosting recommendation does not belong to this MVP PDD", code: "HOST_PLAN_SOURCE_MISMATCH" });
    return;
  }
  if (language !== "javascript" && hostingContent?.primary?.platform &&
    !["replit-deployments", "fly-io", "render", "railway"].includes(hostingContent.primary.platform)) {
    res.status(409).json({ error: "This language requires a general-purpose source/build target. Re-run HOST DJ with the selected language instead of reusing a static or mobile hosting plan.", code: "F8_LANGUAGE_HOST_MISMATCH" });
    return;
  }
  if (artifactClass === "SOFTWARE" && !hostingPlanArtifactId) {
    res.status(409).json({ error: "Create or select the source-bound HOST DJ recommendation before code generation", code: "HOST_PLAN_REQUIRED" });
    return;
  }

  // BUGMXT Layer 4 drift gate: if a PFP report exists for this MVP PDD and
  // it found critical drift, refuse to scaffold further until the operator
  // explicitly acknowledges by retrying with { acknowledgeDrift: true }.
  if (!acknowledgeDrift) {
    const pfp = await latestPfpForMvp(sessionId, guard.userId, mvpPddArtifactId);
    if (pfp && pfp.counts.critical > 0) {
      res.status(409).json({
        error: "PFP drift gate: critical findings outstanding",
        code: "DRIFT_GATE",
        detail:
          `Most recent PFP report flagged ${pfp.counts.critical} critical finding(s) ` +
          `(FCI ${pfp.fci}/100, verdict ${pfp.verdict}). Re-run F8 with ` +
          `{ "acknowledgeDrift": true } once the drift is reviewed.`,
        pfp: {
          verdict: pfp.verdict,
          fci: pfp.fci,
          counts: pfp.counts,
        },
      });
      return;
    }
  }

  const userPrompt = [
    F8_LANGUAGE_INSTRUCTION,
    `REQUIRED PRIMARY LANGUAGE: ${language}. Both language and manifest.language MUST exactly equal "${language}". ${language !== "javascript" ? "platform MUST equal portable-source." : ""}`,
    platform ? `OPERATOR-REQUESTED PLATFORM: ${platform} (must use this compatible platform)` :
      `Recommend the best implementation platform from: ${PLATFORMS.join(", ")}. Select it in the platform field.`,
    hardwareConfig
      ? `FIRMWARE HARDWARE CONFIGURATION:\n${JSON.stringify(hardwareConfig, null, 2)}`
      : null,
    notes ? `OPERATOR NOTES: ${notes}` : null,
    hosting ? `HOST DJ SOURCE-BOUND RECOMMENDATION (server-ranked primary and fallback; do not replace with a different host). manifest.deployTarget MUST exactly equal "${hostingContent?.primary?.platform}". The platform, manifest and generated files must be compatible with that host:\n${JSON.stringify(hosting.artifactContent, null, 2)}` : null,
    colonizationContext(colonizationTarget.success ? colonizationTarget.data : "UNDECIDED"),
    "",
    pdd?.sessionId === sessionId && pdd.artifactType === "ATLAS_PDD"
      ? `ORIGINAL ATLAS PDD (requirements context):\n${JSON.stringify(pdd.artifactContent, null, 2)}` : null,
    micro ? `MICRO PDD (additional source contract):\n${JSON.stringify(micro.artifactContent, null, 2)}` : null,
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
    req.log.error({ err }, "F8 CODE ONE + engine call failed");
    res.status(502).json({
      error: "Engine call failed",
      detail: (err as Error).message,
    });
    return;
  }

  if (platform && out.platform !== platform) {
    req.log.warn(
      { requested: platform, returned: out.platform },
      "F8 returned a different platform than requested",
    );
    res.status(502).json({ error: "Generated platform does not match the requested platform", code: "IMPLEMENTATION_PATH_MISMATCH" });
    return;
  }
  if (!out.implementationPath) {
    res.status(502).json({ error: "CODE ONE + did not return a traceable implementation recommendation" });
    return;
  }
  const languageError = validateF8LanguageBundle(out, language);
  if (languageError) {
    res.status(502).json({ error: languageError, code: "IMPLEMENTATION_PATH_MISMATCH" });
    return;
  }
  const unresolved = out.collaboration?.oracle.filter(item => item.resolution === "NEEDS_SOURCE_DECISION") ?? [];
  if (unresolved.length) {
    res.status(409).json({
      error: `CODE ORACLE requires source decisions before code can be saved: ${unresolved.map(item => `${item.requirement}: ${item.gap}`).join("; ")}`,
      code: "CODE_ORACLE_SOURCE_DECISION_REQUIRED",
      gaps: unresolved.map(item => ({ requirement: item.requirement, gap: item.gap })),
    });
    return;
  }
  const bundleError = validateImplementationBundle(out, hostingContent?.primary?.platform);
  if (bundleError) {
    res.status(502).json({ error: bundleError, code: "IMPLEMENTATION_PATH_MISMATCH" });
    return;
  }
  const implementationPath = {
    ...out.implementationPath,
    platform: out.platform,
    recommendedHost: hostingContent?.primary?.platform ?? DEFAULT_HOST[out.platform],
    advisoryOnly: true,
  };

  // Persist the bundle as a CODEBASE_BUNDLE artifact (no SPARTAN cert — it is
  // downstream of one; the source MVP PDD's cert is the lineage anchor).
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 8,
    artifactType: "CODEBASE_BUNDLE",
    artifactContent: {
      platform: out.platform,
      language: out.language,
      artifactClass,
      ...(hardwareConfig ? { hardwareConfigId: hardwareConfig.id } : {}),
      manifest: out.manifest,
      files: out.files,
      notes: out.notes,
      implementationPath,
      collaboration: out.collaboration
        ? { ...out.collaboration, reviewStatus: "MODEL_REVIEW_NOT_INDEPENDENT" }
        : { oracle: [], dj: [], reviewStatus: "NOT_RECORDED" },
      conversionProtocol: {
        agent: "CODE ONE +", sourceVersion: "v0.2-DRAFT",
        instructionLayerOnly: true, independentCertification: false,
        humanReviewRequired: artifactClass === "FIRMWARE",
        limitations: [
          "Single conversion with CODE ORACLE gap review and CODE DJ code decisions when recorded, VIBE DJ instructions and a source-bound HOST DJ plan. Model self-review is not independent verification.",
          "Independent ATHENA, CODON, MATHMON and BUGMXT executions are not attested by this bundle.",
          "PFP, CI/IDE evidence, F9 where applicable and F10/F11 remain separate gates.",
        ],
      },
      colonizationTarget: colonizationTarget.success ? colonizationTarget.data : "UNDECIDED",
      ...(micro ? { sourceMicroPddArtifactId: micro.id } : {}),
      ...(hosting ? { sourceHostingPlanArtifactId: hosting.id } : {}),
      ...(pdd?.sessionId === sessionId ? { sourcePddArtifactId: pdd.id } : {}),
      sourceMvpPddArtifactId: mvpPddArtifactId,
      sourceCertId:
        (mvp.spartanCert as { certId?: string } | null)?.certId ?? null,
    },
    provider,
  });

  res.json({
    artifactId: artifact.id,
    platform: out.platform,
    language: out.language,
    artifactClass,
    ...(hardwareConfig ? { hardwareConfigId: hardwareConfig.id } : {}),
    manifest: out.manifest,
    files: out.files,
    notes: out.notes,
    implementationPath,
    collaboration: out.collaboration
      ? { ...out.collaboration, reviewStatus: "MODEL_REVIEW_NOT_INDEPENDENT" }
      : { oracle: [], dj: [], reviewStatus: "NOT_RECORDED" },
  });
}
