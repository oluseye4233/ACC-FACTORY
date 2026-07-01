import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  mathmonMapsTable,
  type HarnessArtifact,
  type Subscriber,
  type User,
} from "@workspace/db";

import { handleF7Stream } from "../src/engines/f7";
import { F7_SYSTEM } from "../src/engines/prompts";
import { PROVIDER_MODELS, loadArtifact } from "../src/engines/shared";
import {
  clampScore,
  computeMathmonScore,
  computeForgeVerified,
  FORGE_VERIFIED_DISCLAIMER,
  JCSE_PASS_THRESHOLD,
  MATHMON_PASS_THRESHOLD,
} from "../src/lib/mathmon";
import { hashKey, writeFixture } from "./llm-cache";

// ─────────────────────────────────────────────────────────────────────────────
// MATHMON — F0→F9 logic-validation system.
//
// MATHMON is a cross-cutting mathematical-verification layer that manifests at
// three points of the HARNESS pipeline and is carried forward by the rest:
//   • F0.5 (intake)  — profiles the concept, writes mathmon_intakes.
//   • MAP  (scoring) — recomputes the three sub-scores, writes mathmon_maps,
//                      stamps the mandatory disclaimer on economic projections.
//   • F7   (gate)    — the CONVERGENCE POINT: recomputes the composite from the
//                      session's latest MAP, reads the session's max JCSE, and
//                      applies the ABSOLUTE FORGE VERIFIED gate
//                      (jcse ≥ 45 AND mathmon ≥ 70) onto the certified MVP PDD.
//
// F1–F6/F8/F9 do not themselves touch MATHMON tables, so "MATHMON manifests
// along the whole pipeline" is proven where it can regress: at the F7 gate that
// consumes the upstream signals and at the arithmetic that decides the badge.
// The F0.5→MAP half of the chain is covered by mathmon-flow.test.ts; this suite
// covers the MAP→F7 convergence end-to-end plus the gate arithmetic backstop.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Test-app plumbing (mirrors mathmon-flow.test.ts) ───────────────────────
function attachContext(localUser: User, subscriber: Subscriber): RequestHandler {
  return (req, _res, next) => {
    req.localUser = localUser;
    req.subscriber = subscriber;
    const noop = (): void => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      trace: noop,
      fatal: noop,
      child: () => (req as unknown as { log: unknown }).log,
    };
    next();
  };
}

function buildApp(
  localUser: User,
  subscriber: Subscriber,
  path: string,
  ...handlers: RequestHandler[]
): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachContext(localUser, subscriber));
  app.post(path, ...handlers);
  return app;
}

async function startServer(
  app: Express,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
}

async function seedFixtures(): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_mmpipe_${stamp}`,
      email: `mathmon-pipeline-${stamp}@example.test`,
      displayName: "MATHMON Pipeline Test",
    })
    .returning();
  if (!user) throw new Error("seed: user insert failed");

  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: user.id, tier: "ARCHITECT", status: "active" })
    .returning();
  if (!subscriber) throw new Error("seed: subscriber insert failed");

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: user.id,
      sessionName: `mathmon-pipeline ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  return { user, subscriber, sessionId: session.id };
}

async function cleanup(userId: string): Promise<void> {
  // Cascades through subscribers, sessions, artifacts, maps, engine_runs.
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

// ─── LLM fixture helpers (mirror mathmon-flow.test.ts) ──────────────────────
const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "llm",
  "claude",
);

function writeClaudeFixture(
  systemPrompt: string,
  userPrompt: string,
  output: unknown,
): string {
  const payload = {
    model: PROVIDER_MODELS.claude,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };
  const key = hashKey("claude", payload);
  writeFixture("claude", key, {
    model: PROVIDER_MODELS.claude,
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 210, output_tokens: 420 },
  });
  return key;
}

function removeFixture(key: string): void {
  const p = join(FIXTURE_DIR, `${key}.json`);
  if (existsSync(p)) unlinkSync(p);
}

function parseSseEvent(body: string, event: string): unknown | null {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === `event: ${event}`) {
      const dataLine = lines[i + 1] ?? "";
      const json = dataLine.replace(/^data:\s*/, "");
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ─── MATHMON pipeline seed helpers ──────────────────────────────────────────
interface SubScores {
  mathCoherence: number;
  applicability: number;
  predictiveReliability: number;
}

// Seed a MAP row directly (the F7 gate only reads it via loadLatestMap). An
// explicit createdAt lets a test control which MAP is "latest".
async function seedMap(
  fx: Fixtures,
  sub: SubScores,
  createdAt?: Date,
): Promise<void> {
  await db.insert(mathmonMapsTable).values({
    sessionId: fx.sessionId,
    userId: fx.user.id,
    intakeId: null,
    map: {
      sections: [
        {
          key: "economic_projections",
          title: "Economic projections",
          body: `Revenue modelled at $10k–$40k/mo (range only). ${FORGE_VERIFIED_DISCLAIMER}`,
        },
      ],
    },
    mathCoherence: sub.mathCoherence,
    applicability: sub.applicability,
    predictiveReliability: sub.predictiveReliability,
    disclaimer: FORGE_VERIFIED_DISCLAIMER,
    provider: "claude",
    modelId: PROVIDER_MODELS.claude,
    ...(createdAt ? { createdAt } : {}),
  });
}

// Seed a JCSE-scored artifact. sessionMaxJcse takes max(jcseScore) across all
// of the session's artifacts, so this is what the F7 gate reads for the JCSE arm.
async function seedJcseArtifact(fx: Fixtures, jcseScore: number): Promise<void> {
  await db.insert(harnessArtifactsTable).values({
    sessionId: fx.sessionId,
    userId: fx.user.id,
    featureId: 1,
    artifactType: "PROMPT_DIAGNOSTIC",
    artifactContent: {},
    jcseScore,
  });
}

interface F7Cert {
  certId: string;
  class: "A" | "B" | "C";
  crP: number;
  forgeVerified: boolean;
  mathmonScore: number | null;
  jcse: number | null;
  disclaimer?: string;
}

interface F7Complete {
  cert: F7Cert;
  forgeVerified: boolean;
  mathmonScore: number | null;
  disclaimer: string | null;
  artifactId: string;
}

// A minimal, schema-valid F7 (SPARTAN) output. Varied per test only so each
// hashes to a distinct LLM-fixture key (the key is derived from the ATLAS PDD
// content, which we mark per test).
function f7Output(): unknown {
  return {
    sections: [
      {
        key: "executive_summary",
        title: "Executive summary",
        body: "Compressed MVP PDD.",
      },
    ],
    donut: { a: 0.6, b: 0.3, c: 0.1 },
    crP: 0.72,
    class: "A",
  };
}

// Insert an ATLAS PDD (F7's required input), wire the matching F7 fixture, drive
// the F7 SSE handler once, and return the parsed `complete` event plus the
// persisted MVP PDD row. Marker uniquifies the fixture key per call.
async function runF7(
  fx: Fixtures,
  marker: string,
): Promise<{ complete: F7Complete; artifact: HarnessArtifact }> {
  const atlasContent = {
    cheatSheet: `MATHMON pipeline probe — ${marker}.`,
    execSummary: "Deliver a certified MVP PDD from a 4-part ATLAS PDD.",
    worksheet: "Inputs: sections. Outputs: compressed sections + cert.",
    implementation: "Compress via the 7-step SPARTAN SCM.",
  };
  const [pddRow] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: fx.sessionId,
      userId: fx.user.id,
      featureId: 6,
      artifactType: "ATLAS_PDD",
      artifactContent: atlasContent,
    })
    .returning();
  if (!pddRow) throw new Error("runF7: ATLAS PDD insert failed");

  // Rebuild the prompt from the DB-round-tripped content (jsonb may reorder
  // keys) so the hash matches exactly what the F7 handler will request.
  const pdd = await loadArtifact(pddRow.id, fx.user.id);
  if (!pdd) throw new Error("runF7: ATLAS PDD read-back failed");
  const userPrompt = `Compress this ATLAS PDD via the 7-step SPARTAN SCM:\n${JSON.stringify(pdd.artifactContent, null, 2)}`;
  const key = writeClaudeFixture(F7_SYSTEM, userPrompt, f7Output());

  const app = buildApp(fx.user, fx.subscriber, "/api/harness/f7", handleF7Stream);
  const srv = await startServer(app);
  try {
    const res = await fetch(`${srv.url}/api/harness/f7`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        sessionId: fx.sessionId,
        pddArtifactId: pddRow.id,
        provider: "claude",
      }),
    });
    const body = await res.text();
    expect(
      parseSseEvent(body, "error"),
      `unexpected SSE error: ${body.slice(0, 400)}`,
    ).toBeNull();
    const complete = parseSseEvent(body, "complete") as F7Complete | null;
    expect(complete, `no complete event: ${body.slice(0, 400)}`).not.toBeNull();

    const rows = await db
      .select()
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.sessionId, fx.sessionId),
          eq(harnessArtifactsTable.artifactType, "MVP_PDD"),
        ),
      )
      .orderBy(desc(harnessArtifactsTable.createdAt))
      .limit(1);
    expect(rows.length, "F7 did not persist an MVP PDD").toBe(1);
    return { complete: complete!, artifact: rows[0]! };
  } finally {
    removeFixture(key);
    await srv.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe("MATHMON manifests across F0→F9 — convergence at the F7 FORGE VERIFIED gate", () => {
  test("green pipeline (MAP ≥ 70 AND JCSE ≥ 45) certifies FORGE VERIFIED and carries the disclaimer to the cert", async () => {
    const fx = await seedFixtures();
    try {
      const sub = { mathCoherence: 90, applicability: 80, predictiveReliability: 70 };
      const expected = computeMathmonScore(sub); // 82
      expect(expected).toBeGreaterThanOrEqual(MATHMON_PASS_THRESHOLD);
      await seedMap(fx, sub);
      await seedJcseArtifact(fx, 46);

      const { complete, artifact } = await runF7(fx, "green");

      // Complete event: gate passed, disclaimer surfaced.
      expect(complete.forgeVerified).toBe(true);
      expect(complete.mathmonScore).toBe(expected);
      expect(complete.disclaimer).toBe(FORGE_VERIFIED_DISCLAIMER);

      // Cert carries the score, the JCSE arm, and the disclaimer.
      expect(complete.cert.forgeVerified).toBe(true);
      expect(complete.cert.mathmonScore).toBe(expected);
      expect(complete.cert.jcse).toBe(46);
      expect(complete.cert.disclaimer).toBe(FORGE_VERIFIED_DISCLAIMER);

      // Persisted MVP PDD mirrors the gate result — the badge survives to the
      // artifact the downstream F8/F9 handoff reads.
      expect(artifact.forgeVerified).toBe(true);
      expect(artifact.mathmonScore).toBe(expected);
      const cert = artifact.spartanCert as { disclaimer?: string } | null;
      expect(cert?.disclaimer).toBe(FORGE_VERIFIED_DISCLAIMER);
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("MATHMON below threshold blocks certification even when JCSE passes (no disclaimer leaks)", async () => {
    const fx = await seedFixtures();
    try {
      const sub = { mathCoherence: 60, applicability: 60, predictiveReliability: 60 };
      const expected = computeMathmonScore(sub); // 60
      expect(expected).toBeLessThan(MATHMON_PASS_THRESHOLD);
      await seedMap(fx, sub);
      await seedJcseArtifact(fx, 46);

      const { complete, artifact } = await runF7(fx, "low-mathmon");

      expect(complete.forgeVerified).toBe(false);
      expect(complete.mathmonScore).toBe(expected);
      // No disclaimer on an unverified cert / complete event.
      expect(complete.disclaimer).toBeNull();
      expect(complete.cert.disclaimer).toBeUndefined();

      expect(artifact.forgeVerified).toBe(false);
      const cert = artifact.spartanCert as { disclaimer?: string } | null;
      expect(cert?.disclaimer).toBeUndefined();
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("skipping the MATHMON stage (no MAP) can never certify — mathmonScore is null and the gate fails", async () => {
    const fx = await seedFixtures();
    try {
      // No MAP at all — the F0.5/MAP rungs were never run for this session.
      await seedJcseArtifact(fx, 46);

      const { complete, artifact } = await runF7(fx, "no-map");

      expect(complete.mathmonScore).toBeNull();
      expect(complete.forgeVerified).toBe(false);
      expect(complete.disclaimer).toBeNull();
      expect(artifact.forgeVerified).toBe(false);
      expect(artifact.mathmonScore).toBeNull();
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("JCSE below 45 blocks certification even with a strong MATHMON score (both arms are required)", async () => {
    const fx = await seedFixtures();
    try {
      const sub = { mathCoherence: 90, applicability: 80, predictiveReliability: 70 };
      const expected = computeMathmonScore(sub); // 82 — comfortably above 70
      await seedMap(fx, sub);
      await seedJcseArtifact(fx, 44); // one below the JCSE gate

      const { complete, artifact } = await runF7(fx, "low-jcse");

      // MATHMON is still computed and reported, but the AND gate fails on JCSE.
      expect(complete.mathmonScore).toBe(expected);
      expect(complete.cert.jcse).toBe(44);
      expect(complete.forgeVerified).toBe(false);
      expect(complete.disclaimer).toBeNull();
      expect(artifact.forgeVerified).toBe(false);
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("gate consumes the LATEST MAP and the session's MAX JCSE (not the best MAP or the first JCSE)", async () => {
    const fx = await seedFixtures();
    try {
      // An older MAP that WOULD pass, then a newer MAP that fails. The gate must
      // use the newer one (loadLatestMap orders by createdAt desc).
      const older = new Date(Date.now() - 60_000);
      const newer = new Date();
      await seedMap(fx, { mathCoherence: 90, applicability: 80, predictiveReliability: 70 }, older); // 82 pass
      await seedMap(fx, { mathCoherence: 50, applicability: 50, predictiveReliability: 50 }, newer); // 50 fail
      const latestExpected = computeMathmonScore({
        mathCoherence: 50,
        applicability: 50,
        predictiveReliability: 50,
      }); // 50

      // Two JCSE artifacts; the gate must use the MAX (46), not the first (30).
      await seedJcseArtifact(fx, 30);
      await seedJcseArtifact(fx, 46);

      const { complete } = await runF7(fx, "latest-and-max");

      // Latest (failing) MAP won — proves it is not the best-of MAP.
      expect(complete.mathmonScore).toBe(latestExpected);
      // Max JCSE won — proves it is not the first / min JCSE.
      expect(complete.cert.jcse).toBe(46);
      // Latest MAP fails MATHMON, so the overall gate fails despite a passing JCSE.
      expect(complete.forgeVerified).toBe(false);
    } finally {
      await cleanup(fx.user.id);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate arithmetic backstop — the pure-function logic the F7 convergence relies
// on. Complements mathmon-gate.test.ts (which covers clampScore + the direct
// computeForgeVerified boundaries); here we cover the gaps that decide whether
// an impossible or borderline MAP can ever reach FORGE VERIFIED.
describe("FORGE VERIFIED gate arithmetic — impossible & borderline sub-scores", () => {
  test("non-finite sub-scores (NaN / Infinity) clamp to 0 in the composite — they can never inflate the score", () => {
    // NaN → 0, +Infinity → 0; only predictiveReliability contributes.
    const score = computeMathmonScore({
      mathCoherence: Number.NaN,
      applicability: Number.POSITIVE_INFINITY,
      predictiveReliability: 100,
    });
    expect(clampScore(Number.NaN)).toBe(0);
    expect(score).toBe(25); // 0×0.40 + 0×0.35 + 100×0.25
    expect(computeForgeVerified(50, score)).toBe(false);
  });

  test("a composite that lands exactly on 70 passes; one point under fails", () => {
    const at = computeMathmonScore({
      mathCoherence: 70,
      applicability: 70,
      predictiveReliability: 70,
    });
    expect(at).toBe(70);
    expect(at).toBe(MATHMON_PASS_THRESHOLD);
    expect(computeForgeVerified(JCSE_PASS_THRESHOLD, at)).toBe(true);

    const under = computeMathmonScore({
      mathCoherence: 70,
      applicability: 70,
      predictiveReliability: 66,
    }); // 28 + 24.5 + 16.5 = 69
    expect(under).toBe(69);
    expect(computeForgeVerified(JCSE_PASS_THRESHOLD, under)).toBe(false);
  });

  test("a zero applicability cannot be rescued by maxed-out coherence and reliability", () => {
    // Applicability carries 0.35 weight; zeroing it caps the composite at 65.
    const score = computeMathmonScore({
      mathCoherence: 100,
      applicability: 0,
      predictiveReliability: 100,
    });
    expect(score).toBe(65); // 40 + 0 + 25
    expect(score).toBeLessThan(MATHMON_PASS_THRESHOLD);
    expect(computeForgeVerified(50, score)).toBe(false);
  });
});
