import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF8HdjBody } from "@workspace/api-zod";
import { F8_HDJ_SYSTEM } from "./prompts";
import {
  callLlmJson,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
} from "./shared";

const HOST_PLATFORMS = [
  "replit-deployments",
  "vercel",
  "fly-io",
  "render",
  "railway",
  "cloudflare-pages",
  "netlify",
  "aws-amplify",
  "expo-eas",
] as const;

// Fixed Host-Selection-Engine criterion weights (sum 100). The model never
// supplies these and never computes the weighted total — ranking is recomputed
// server-side from the model's per-criterion scores so a contradictory or
// gamed self-ranking cannot pick the winner (same discipline as PFP, gotcha #5).
const HSE_WEIGHTS = {
  stackCompat: 25,
  cost: 20,
  deploySimplicity: 15,
  dbFit: 15,
  cicd: 10,
  compliance: 10,
  scalability: 3,
  lockin: 2,
} as const;

type Criterion = keyof typeof HSE_WEIGHTS;
const CRITERIA = Object.keys(HSE_WEIGHTS) as Criterion[];

const score0to10 = z.number().min(0).max(10);

const HseScoresSchema = z.object({
  stackCompat: score0to10,
  cost: score0to10,
  deploySimplicity: score0to10,
  dbFit: score0to10,
  cicd: score0to10,
  compliance: score0to10,
  scalability: score0to10,
  lockin: score0to10,
});

const HdjOutputSchema = z.object({
  hrp: z.object({
    runtime: z.string(),
    deployTarget: z.string(),
    database: z.string(),
    regions: z.array(z.string()).default([]),
    compliance: z.array(z.string()).default([]),
    scaleProfile: z.enum(["prototype", "low", "medium", "high"]),
    summary: z.string(),
  }),
  hse: z
    .array(
      z.object({
        platform: z.enum(HOST_PLATFORMS),
        scores: HseScoresSchema,
      }),
    )
    .min(2)
    .max(HOST_PLATFORMS.length),
  journey: z.object({
    tier: z.string(),
    phases: z
      .array(z.object({ name: z.string(), detail: z.string() }))
      .min(1)
      .max(8),
  }),
  sdf: z.object({
    envTemplate: z
      .array(
        z.object({
          key: z.string().min(1).max(120),
          description: z.string().max(300).default(""),
          required: z.boolean().default(true),
        }),
      )
      .max(40),
    ciYaml: z.string().max(8000).default(""),
    healthCheck: z.string().max(1000).default(""),
    rollback: z.string().max(1000).default(""),
  }),
  notes: z.string().max(800).default(""),
});

// Host ORACLE is advisory: its persisted/returned env template must carry NAMES ONLY.
// A model can still smuggle a value into the `key` ("DATABASE_URL=postgres://…")
// or `description` ("token: sk-…"), so both are sanitised server-side before the
// HOSTING_PLAN is persisted/returned.
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]{0,119}$/;

export function sanitizeEnvKey(raw: string): string | null {
  // Keep only the name portion before any assignment; normalise to UPPER_SNAKE.
  const name = raw
    .split("=")[0]!
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  return ENV_KEY_RE.test(name) ? name : null;
}

export function redactValueLike(text: string): string {
  return text
    // KEY=value assignments → KEY=<redacted>
    .replace(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\S+/g, "$1=<redacted>")
    // URLs / connection strings
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<redacted-url>")
    // long opaque tokens (api keys, base64/hex secrets)
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "<redacted>")
    .slice(0, 300);
}

function weightedTotal(scores: Record<Criterion, number>): number {
  // Each criterion contributes (score/10) * weight; weights sum to 100, so the
  // total is already on a 0..100 scale. Round to 1 dp for stable display.
  const raw = CRITERIA.reduce(
    (sum, c) => sum + (scores[c] / 10) * HSE_WEIGHTS[c],
    0,
  );
  return Math.round(raw * 10) / 10;
}

export async function handleF8Hdj(req: Request, res: Response): Promise<void> {
  const parsed = HarnessF8HdjBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const {
    sessionId,
    mvpPddArtifactId,
    codebaseBundleArtifactId,
    notes,
    provider: bodyProvider,
  } = parsed.data;

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
  // Host ORACLE only plans hosting for artefacts that actually passed SPARTAN — it
  // is the last gate before a certified PDD is published.
  if (!mvp.spartanCert) {
    res.status(409).json({
      error: "Source MVP PDD is not SPARTAN-certified",
      detail: "Host ORACLE refuses to plan hosting for an uncertified bundle.",
    });
    return;
  }

  // Optional codebase bundle sharpens the hosting requirements profile.
  let bundleContent: unknown = null;
  if (codebaseBundleArtifactId) {
    const bundle = await loadArtifact(codebaseBundleArtifactId, guard.userId);
    if (
      !bundle ||
      bundle.sessionId !== sessionId ||
      bundle.artifactType !== "CODEBASE_BUNDLE"
    ) {
      res
        .status(404)
        .json({ error: "Codebase bundle artifact not found in this session" });
      return;
    }
    bundleContent = bundle.artifactContent;
  }

  const userPrompt = [
    notes ? `OPERATOR NOTES: ${notes}` : null,
    "",
    "CERTIFIED MVP PDD (source contract):",
    JSON.stringify(mvp.artifactContent, null, 2),
    bundleContent
      ? `\nF8 CODEBASE BUNDLE (for stack/runtime signal):\n${JSON.stringify(bundleContent, null, 2)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  let out: z.infer<typeof HdjOutputSchema>;
  try {
    out = await callLlmJson(
      provider,
      F8_HDJ_SYSTEM,
      userPrompt,
      HdjOutputSchema,
      // engineId=12 keeps Host ORACLE telemetry separable (F8 Code ORACLE=9, ATLAS J=10,
      // PFP=11). Host ORACLE is a post-F8 advisory side-step; it is not rate-limited
      // per-day (tier + cost gated only), matching f6-vdj / pfp.
      { sessionId, userId: guard.userId, engineId: 12 },
    );
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F8 Host ORACLE engine call failed");
    res.status(502).json({
      error: "Engine call failed",
      detail: (err as Error).message,
    });
    return;
  }

  // ── Server-side ranking (do not trust the model's ordering) ──────────────
  // De-dupe platforms (keep first), compute weighted totals, sort desc.
  const seen = new Set<string>();
  const ranked = out.hse
    .filter((row) => (seen.has(row.platform) ? false : (seen.add(row.platform), true)))
    .map((row) => ({
      platform: row.platform,
      scores: row.scores,
      weightedTotal: weightedTotal(row.scores),
    }))
    .sort((a, b) => b.weightedTotal - a.weightedTotal);

  const primaryRow = ranked[0]!;
  const fallbackRow = ranked[1] ?? ranked[0]!;
  const jcse = Math.round(primaryRow.weightedTotal);

  // Defensive: strip any value-bearing content a model might smuggle into the env
  // template — Host ORACLE is advisory and must never echo a secret value. Entries
  // whose key cannot be normalised to a bare NAME are dropped entirely.
  const envTemplate = out.sdf.envTemplate
    .map((e) => {
      const key = sanitizeEnvKey(e.key);
      if (!key) return null;
      return { key, description: redactValueLike(e.description), required: e.required };
    })
    .filter(
      (e): e is { key: string; description: string; required: boolean } =>
        e !== null,
    );

  const plan = {
    hrp: out.hrp,
    weights: HSE_WEIGHTS,
    hse: ranked,
    primary: {
      platform: primaryRow.platform,
      score: primaryRow.weightedTotal,
      rationale: out.notes,
    },
    fallback: {
      platform: fallbackRow.platform,
      score: fallbackRow.weightedTotal,
      rationale: out.notes,
    },
    journey: out.journey,
    sdf: { ...out.sdf, envTemplate },
    jcse,
    notes: out.notes,
  };

  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 8,
    artifactType: "HOSTING_PLAN",
    artifactContent: {
      ...plan,
      sourceMvpPddArtifactId: mvpPddArtifactId,
      sourceCodebaseBundleArtifactId: codebaseBundleArtifactId ?? null,
      sourceCertId:
        (mvp.spartanCert as { certId?: string } | null)?.certId ?? null,
    },
    provider,
  });

  res.json({ artifactId: artifact.id, ...plan });
}
