import { z } from "zod/v4";
import type { Request, Response } from "express";
import { HarnessF7StreamBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { db, harnessSessionsTable } from "@workspace/db";
import { sendCertIssued } from "@workspace/email";
import { F7_SYSTEM } from "./prompts";
import {
  advanceFeatureState,
  callLlmJson,
  generateCertId,
  loadArtifact,
  ownedSessionOr404,
  persistArtifact,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
} from "./shared";
import {
  computeMathmonScore,
  computeForgeVerified,
  FORGE_VERIFIED_DISCLAIMER,
} from "../lib/mathmon";
import { loadLatestMap, sessionBestJcseScorecards, sessionMaxJcse } from "../lib/mathmon-store";
import { buildMathmonScorecard, type Scorecard } from "../lib/scorecards";

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
  const { sessionId, pddArtifactId, provider: bodyProvider } = parsed.data;
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
    return callLlmJson(provider, F7_SYSTEM, userPrompt, F7OutputSchema, {
      sessionId,
      userId: guard.userId,
      engineId: 7,
    });
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
    req.log.error({ err, code }, "F7 engine call failed");
    send("error", { error: code, code, provider, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // ─── MM-FV · FORGE VERIFIED gate (D26) ──────────────────────────────────
  // Recompute the composite MATHMON score server-side from the session's MAP
  // sub-scores (never the model's self-report), read the session JCSE, and apply
  // the absolute gate: forgeVerified = (jcse ≥ 45 AND mathmon ≥ 70). Written
  // once, here, onto the certified MVP PDD.
  const [map, sessionJcse, sourceScorecards] = await Promise.all([
    loadLatestMap(sessionId, guard.userId),
    sessionMaxJcse(sessionId),
    sessionBestJcseScorecards(sessionId),
  ]);
  const mathmonScore = map
    ? computeMathmonScore({
        mathCoherence: map.mathCoherence,
        applicability: map.applicability,
        predictiveReliability: map.predictiveReliability,
      })
    : null;
  const forgeVerified = computeForgeVerified(sessionJcse, mathmonScore);
  const jcseScorecards = (sourceScorecards as Scorecard[]).filter((card) => card.kind === "JCSE");
  const mathmonScorecards = map
    ? [
        (map.scorecard as Scorecard | null) ??
          buildMathmonScorecard({
            scores: {
              mathCoherence: map.mathCoherence,
              applicability: map.applicability,
              predictiveReliability: map.predictiveReliability,
            },
            score: mathmonScore ?? 0,
          }),
      ]
    : [];
  const scorecards = [...jcseScorecards, ...mathmonScorecards];

  const cert = {
    certId: generateCertId(),
    class: out.class,
    crP: out.crP,
    issuedAt: new Date().toISOString(),
    forgeVerified,
    mathmonScore,
    jcse: sessionJcse,
    ...(forgeVerified ? { disclaimer: FORGE_VERIFIED_DISCLAIMER } : {}),
  };
  // Persist regardless of client connection — work is done, cert is paid for.
  const artifact = await persistArtifact({
    sessionId,
    userId: guard.userId,
    featureId: 7,
    artifactType: "MVP_PDD",
    artifactContent: { sections: out.sections, donut: out.donut },
    scorecards,
    jcseScore: sessionJcse,
    spartanCert: cert,
    mathmonScore,
    forgeVerified,
    provider,
  });
  await advanceFeatureState(sessionId, 7);

  // Fire-and-await email — failure must not interrupt the SSE response.
  if (req.localUser?.email) {
    const sessRows = await db
      .select({ name: harnessSessionsTable.sessionName })
      .from(harnessSessionsTable)
      .where(eq(harnessSessionsTable.id, sessionId))
      .limit(1);
    const sessionName = sessRows[0]?.name ?? "Untitled session";
    const verifyBase = process.env.PUBLIC_BASE_URL ?? "";
    const verifyUrl = `${verifyBase}/verify?certId=${encodeURIComponent(cert.certId)}`;
    sendCertIssued({
      to: req.localUser.email,
      certId: cert.certId,
      certClass: cert.class,
      sessionName,
      verifyUrl,
    })
      .then((r) => {
        if (!r.ok) req.log.warn({ error: r.error }, "sendCertIssued failed");
      })
      .catch((err) => req.log.warn({ err }, "sendCertIssued failed"));
  }

  if (clientClosed) return;
  send("complete", {
    sections: out.sections,
    donut: out.donut,
    cert,
    forgeVerified,
    mathmonScore,
    scorecards,
    disclaimer: forgeVerified ? FORGE_VERIFIED_DISCLAIMER : null,
    artifactId: artifact.id,
  });
  res.end();
}
