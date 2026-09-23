import { createHmac, createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod/v4";
import { db, f9MechaRunsTable, harnessArtifactsTable } from "@workspace/db";
import { ownedSessionOr404 } from "./shared";
import { getHardwareConfig } from "./hardware-configs";

const PhaseSchema = z.object({
  phase: z.number().int().min(1).max(7),
  evidence: z.record(z.string(), z.unknown()),
});

/** Legacy bundles without an explicit class remain eligible for F9. */
export function artifactRequiresF9(content: unknown): boolean {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return true;
  }
  return (content as { artifactClass?: unknown }).artifactClass !== "SOFTWARE";
}

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  sourceArtifactId: z.string().uuid(),
  deviceClass: z.string().trim().min(1).max(200),
  hardwareConfigId: z.enum(["INDUSTRIAL_MCU", "ROBOTICS_RTCL", "APPLIANCE_FLEET"]),
  artifactVersion: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
  phases: z.array(PhaseSchema).length(7),
});

const refusal = (runId: string, phase: number, constraint: string, invariant: string, cause: string, required: string, mode: "HUMAN_IN_LOOP" | "CONTAINMENT" | "KILLZONE") => ({
  verdict: "REFUSED" as const,
  mecha_run_id: runId,
  phase_halted: phase,
  constraint_cited: constraint,
  invariant_cited: invariant,
  cause,
  required_to_proceed: required,
  gro_mode: mode,
});

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to sign F9 artifacts");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
    : v));
}

export function deriveF9Identity(
  sourceArtifactId: string,
  artifactVersion: string,
  phases: z.infer<typeof PhaseSchema>[],
  hardwareConfigId = "",
) {
  const evidenceHash = createHash("sha256").update(canonical(phases)).digest("hex");
  const idempotencyKey = createHash("sha256")
    .update(canonical({ sourceArtifactId, artifactVersion, evidenceHash, hardwareConfigId }))
    .digest("hex");
  return { evidenceHash, idempotencyKey };
}

export function evaluate(runId: string, phases: z.infer<typeof PhaseSchema>[]) {
  const ordered = phases.every((p, i) => p.phase === i + 1);
  if (!ordered) return refusal(runId, 1, "C-MECHA-12", "SPARTAN #23", "MECHA phases were not supplied in strict order.", "Supply exactly phases 1 through 7 in order.", "KILLZONE");
  const data = Object.fromEntries(phases.map((p) => [p.phase, p.evidence])) as Record<number, Record<string, unknown>>;
  const p1 = data[1], p2 = data[2], p3 = data[3], p4 = data[4], p5 = data[5], p6 = data[6], p7 = data[7];
  const profile = p1.target_profile;
  if (!["FIRMWARE_MCU", "ROBOTICS_RTCL", "APPLIANCE_FLEET"].includes(String(profile))) return refusal(runId, 1, "C-MECHA-10", "SPARTAN #21", "Target profile is absent or unreadable.", "Provide a verified target profile and datasheet evidence.", "HUMAN_IN_LOOP");
  if (!Array.isArray(p1.regulatory_regimes_named) || !Array.isArray(p1.platform_allocation) || !["SINGLE", "FLEET"].includes(String(p1.cardinality)) || ![true, false, "UNKNOWN"].includes(p1.interlock_present as never)) return refusal(runId, 1, "C-MECHA-10", "SPARTAN #21", "Target Profile Record is incomplete.", "Provide cardinality, interlock status, named regimes, and a compatible Platform Allocation Matrix.", "HUMAN_IN_LOOP");
  if (!Array.isArray(p2.candidates)) return refusal(runId, 2, "C-MECHA-10", "SPARTAN #21", "Candidate Switch/Function evidence is missing.", "Provide an authenticated ATHENA candidate list.", "HUMAN_IN_LOOP");
  const hazard = p3.hazard_class;
  if (hazard === "SAFETY_RELATED") return refusal(runId, 3, "C-MECHA-02", "SPARTAN #21", "The hazard classification is SAFETY_RELATED.", "Record a named externally qualified functional-safety reviewer before continuing.", "HUMAN_IN_LOOP");
  if (hazard !== "NON_SAFETY_RELATED" || !["SWITCH", "SYSTEM"].includes(String(p3.lane))) return refusal(runId, 3, "C-MECHA-02", "SPARTAN #21", "Hazard classification or lane assignment is invalid.", "Provide the immutable BAHN HCS verdict and derived lane.", "HUMAN_IN_LOOP");
  if (typeof p4.fail_safe_default !== "string" || !p4.fail_safe_default || p4.architecture_complete !== true || p4.control_path_has_llm === true || !p4.icd || typeof p4.icd !== "object") return refusal(runId, 4, p4.control_path_has_llm === true ? "C-MECHA-06" : "C-MECHA-05", "SPARTAN #21", "Cultivation evidence does not establish a bounded, fail-safe control path.", "Provide architecture-before-code, an ICD, a fail-safe default, and an LLM-free control path.", "CONTAINMENT");
  const ares = p5.ares;
  const aresRecord = ares && typeof ares === "object" ? ares as Record<string, unknown> : {};
  if (p5.mm_verdict !== "MATH_VERIFIED" || ["a", "b", "c"].some((key) => aresRecord[key] !== "PASS") || p5.fail_safe_reached !== true) return refusal(runId, 5, "C-MECHA-05", "SPARTAN #21", "MM or ARES did not provide passing, fail-safe evidence.", "Provide immutable MATH_VERIFIED and three PASS ARES vectors with fail-safe reachability.", "CONTAINMENT");
  if (p6.hold_ip === true) return refusal(runId, 6, "C-MECHA-08", "SPARTAN #21", "ATHENA returned HOLD-IP.", "Resolve the IP clearance hold through the external reviewer.", "HUMAN_IN_LOOP");
  if (p6.hold_ip !== false) return refusal(runId, 6, "C-MECHA-10", "SPARTAN #21", "ATHENA IP clearance verdict is absent.", "Provide an authenticated Layer 8 clearance verdict.", "HUMAN_IN_LOOP");
  const ucg = p6.ucg;
  const score = ucg && typeof ucg === "object" ? Number((ucg as Record<string, unknown>).jcse_score) : 0;
  const threshold = p3.lane === "SWITCH" ? 38 : 45;
  if (!ucg || score < threshold || (ucg as Record<string, unknown>).self_adjudicated === true ||
      new Set(["author_id", "scorer_id", "adjudicator_id"].map((k) => (ucg as Record<string, unknown>)[k])).size !== 3) return refusal(runId, 6, "C-MECHA-07", "SPARTAN #22", "UCG evidence is missing, below threshold, or lacks separation of duties.", "Provide an external UCG certificate with three distinct identities and the applicable threshold.", "HUMAN_IN_LOOP");
  if (p3.lane === "SYSTEM" && p6.savant_verdict !== "FIT") return refusal(runId, 6, "C-MECHA-04", "SPARTAN #22", "System Lane requires a SAVANT FIT verdict.", "Provide the immutable SAVANT FIT verdict for the full F5–F8 lineage.", "CONTAINMENT");
  const pce = p7.pce;
  if (!pce || Number((pce as Record<string, unknown>).coverage_pct) < 99 || Number((pce as Record<string, unknown>).orphans) !== 0 || (pce as Record<string, unknown>).ares_scan !== "CLEAN") return refusal(runId, 7, "C-MECHA-15", "SPARTAN #22", "PCE fidelity validation did not pass.", "Provide at least 99% fidelity, zero orphans, and a clean ARES scan.", "CONTAINMENT");
  if (p7.osiris_custody !== true) return refusal(runId, 7, "C-MECHA-04", "SPARTAN #22", "OSIRIS custody was not registered.", "Register the artifact in OSIRIS custody before emission.", "CONTAINMENT");
  const spk = p7.spk && typeof p7.spk === "object" ? p7.spk as Record<string, unknown> : {};
  const requiredSpk = ["constraint_fingerprint", "gro_colonization_record", "mm_package", "ucg_certificate", "fail_safe_declaration", "icd", "traceability_map"];
  const reverificationDue = typeof p7.reverification_due === "string" ? new Date(p7.reverification_due) : null;
  if (requiredSpk.some((key) => !(key in spk)) || !reverificationDue || Number.isNaN(reverificationDue.getTime()) || reverificationDue <= new Date()) return refusal(runId, 7, "C-MECHA-04", "SPARTAN #22", "The SPK package or re-verification schedule is incomplete.", "Provide every mandatory SPK record and a real future re-verification date.", "CONTAINMENT");
  // UCG is an upstream prerequisite for F10.  Carry an explicit verdict in
  // the emitted certificate, but derive it from the accepted score and lane
  // threshold rather than accepting a caller-supplied verdict.
  const upstreamUcg = ucg as Record<string, unknown>;
  data[6] = {
    ...data[6],
    ucg: {
      ...upstreamUcg,
      threshold,
      verdict: score >= threshold ? "THRESHOLD_PASS" : "FAIL",
    },
  };
  return { verdict: "EMITTED" as const, phase_halted: 7, data };
}

export async function handleF9Mecha(req: Request, res: Response): Promise<void> {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const input = parsed.data;
  const hardwareConfig = getHardwareConfig(input.hardwareConfigId);
  if (!hardwareConfig) {
    res.status(400).json({ error: "Unknown hardware configuration" });
    return;
  }
  const guard = await ownedSessionOr404(req, input.sessionId);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.error }); return; }
  const [source] = await db.select().from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, input.sourceArtifactId), eq(harnessArtifactsTable.userId, guard.userId))).limit(1);
  if (!source || source.sessionId !== input.sessionId || source.artifactType !== "CODEBASE_BUNDLE") { res.status(404).json({ error: "F8 CODEBASE_BUNDLE source artifact not found in this session" }); return; }
  const sourceContent = source.artifactContent;
  const sourceHardwareConfigId =
    typeof sourceContent === "object" &&
    sourceContent !== null &&
    !Array.isArray(sourceContent) &&
    "hardwareConfigId" in sourceContent &&
    typeof sourceContent.hardwareConfigId === "string"
      ? sourceContent.hardwareConfigId
      : undefined;
  if (sourceHardwareConfigId && sourceHardwareConfigId !== input.hardwareConfigId) {
    res.status(409).json({
      error: "F9 hardware configuration does not match the F8 Firmware bundle",
      code: "HARDWARE_CONFIG_MISMATCH",
      detail: `F8 selected ${sourceHardwareConfigId}; continue with the same hardware profile or regenerate F8.`,
    });
    return;
  }
  if (!artifactRequiresF9(source.artifactContent)) {
    res.status(409).json({
      error: "F9 is not required for SOFTWARE artifacts",
      code: "F9_NOT_REQUIRED",
      detail: "Software code bundles continue directly from F8 to F10 and F11.",
    });
    return;
  }
  const lineage = source.artifactContent as { sourceMvpPddArtifactId?: string };
  if (!lineage.sourceMvpPddArtifactId) { res.status(409).json({ error: "F8 bundle has no certified MVP PDD lineage" }); return; }
  const [mvp] = await db.select().from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, lineage.sourceMvpPddArtifactId), eq(harnessArtifactsTable.userId, guard.userId))).limit(1);
  if (!mvp || mvp.sessionId !== input.sessionId || mvp.artifactType !== "MVP_PDD" || !mvp.spartanCert) { res.status(409).json({ error: "Upstream MVP PDD is not SPARTAN-certified" }); return; }
  const identity = deriveF9Identity(
    input.sourceArtifactId,
    input.artifactVersion,
    input.phases,
    input.hardwareConfigId,
  );
  const outcome = await db.transaction(async (tx) => {
    const runRowId = randomUUID();
    const mechaRunId = `MECHA-F9-${randomUUID()}`;
    const [inserted] = await tx.insert(f9MechaRunsTable).values({
      id: runRowId,
      mechaRunId,
      sessionId: input.sessionId,
      userId: guard.userId,
      sourceArtifactId: input.sourceArtifactId,
      deviceClass: input.deviceClass,
      artifactVersion: input.artifactVersion,
      ...identity,
    }).onConflictDoNothing({ target: f9MechaRunsTable.idempotencyKey }).returning();

    if (!inserted) {
      const [existing] = await tx.select().from(f9MechaRunsTable)
        .where(eq(f9MechaRunsTable.idempotencyKey, identity.idempotencyKey)).limit(1);
      if (!existing) throw new Error("F9 idempotent run disappeared after conflict");
      return { run: existing, created: false };
    }

    const configuredPhases = input.phases.map((phase) =>
      phase.phase === 1
        ? {
            ...phase,
            evidence: {
              ...phase.evidence,
              hardware_config_id: hardwareConfig.id,
              hardware_configuration: hardwareConfig,
            },
          }
        : phase,
    );
    const result = evaluate(mechaRunId, configuredPhases);
    if (result.verdict === "REFUSED") {
      const [run] = await tx.update(f9MechaRunsTable)
        .set({ status: "REFUSED", phase: result.phase_halted, evidence: configuredPhases, refusal: result, completedAt: new Date() })
        .where(eq(f9MechaRunsTable.mechaRunId, mechaRunId)).returning();
      return { run, created: true };
    }

    const payload = {
      // The public artifact identity is the persisted run identity.  Never
      // mint a second, unrelated identifier for the emitted artifact.
      machine_artifact_id: runRowId,
      mecha_run_id: mechaRunId,
      artifact_version: input.artifactVersion,
      source_artifact_id: input.sourceArtifactId,
      hardware_config_id: hardwareConfig.id,
      hardware_configuration: hardwareConfig,
      code_dj_customization: hardwareConfig.codeDjCustomization,
      spk_id: `SPK-F9-${randomUUID()}`,
      mm_verdict: result.data[5].mm_verdict,
      ucg_certificate: result.data[6].ucg,
      savant_verdict: result.data[6].savant_verdict ?? "N/A",
      osiris_custody: true,
      reverification_due: result.data[7].reverification_due,
      evidence: result.data,
      regulatory_conformity_asserted: false,
    };
    const payloadBytes = canonical(payload);
    const payloadHash = createHash("sha256").update(payloadBytes).digest("hex");
    const artifactSignature = sign(payloadBytes);
    const artifact = { ...payload, payload_hash: payloadHash, artifact_signature: artifactSignature };
    const [run] = await tx.update(f9MechaRunsTable)
      .set({ status: "EMITTED", phase: 7, evidence: configuredPhases, artifactContent: artifact, payloadHash, artifactSignature, osirisCustody: true, completedAt: new Date() })
      .where(eq(f9MechaRunsTable.mechaRunId, mechaRunId)).returning();
    return { run, created: true };
  });

  if (outcome.run.status === "REFUSED") {
    res.status(422).json(outcome.run.refusal);
    return;
  }
  if (outcome.run.status === "EMITTED") {
    res.status(outcome.created ? 201 : 200).json(outcome.run.artifactContent);
    return;
  }
  throw new Error(`F9 idempotent run ${outcome.run.mechaRunId} did not reach a terminal state`);
}

export async function handleF9Run(req: Request, res: Response): Promise<void> {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) { res.status(400).json({ error: "sessionId query param required" }); return; }
  if (!z.string().uuid().safeParse(sessionId).success) {
    res.status(400).json({ error: "sessionId query param must be a valid UUID" });
    return;
  }
  const guard = await ownedSessionOr404(req, sessionId);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.error }); return; }
  const rows = await db
    .select()
    .from(f9MechaRunsTable)
    .where(
      and(
        eq(f9MechaRunsTable.sessionId, sessionId),
        eq(f9MechaRunsTable.userId, guard.userId),
      ),
    )
    .orderBy(desc(f9MechaRunsTable.createdAt));
  res.json(rows);
}
