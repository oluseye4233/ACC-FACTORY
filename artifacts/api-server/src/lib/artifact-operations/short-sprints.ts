import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { shortSprintRunsTable, harnessArtifactsTable, harnessFeatureStateTable, vteVerificationFailuresTable, db } from "@workspace/db";
import { evaluateSprintEligibility, sprintEligibilityInputSchema } from "../short-sprint-eligibility";
import { withOperationsActor, operationEvent, OperationsError, type OperationsActor, type OperationsTx } from "./context";
import { savePrivate, readPrivate, fileHash } from "./private-storage";
import { savedPublicationSource, ownedOperationsSession } from "./sources";
import { hashContent, sourceSafety, publishRequest } from "./imprima-model";
import { verifiedSprintReceipt, type SprintReceipt } from "./sprint-evidence";

const createSchema = z.object({
  circuit: z.enum(["SC_ONE", "SC_TWO"]), target: z.enum(["SOFTWARE", "FIRMWARE"]), profile: z.enum(["PROTOTYPE_LIGHT", "STANDARD", "REGULATED"]),
  hostTarget: z.string().trim().min(2).max(300),
  manifest: z.object({
    name: z.string().min(1).max(120), mission: z.string().min(1).max(5000), systemPrompt: z.string().min(1).max(60000),
    inputContract: z.record(z.string(), z.unknown()), outputContract: z.record(z.string(), z.unknown()),
    tools: z.array(z.unknown()).max(40), constraints: z.array(z.string()).max(100),
    groRules: z.string().min(1).max(5000), failClosedRules: z.string().min(1).max(5000),
    deployment: z.string().min(1).max(5000), model: z.string().min(1).max(100), provider: z.string().min(1).max(100),
    dataHandling: z.string().min(1).max(5000), monitoring: z.string().min(1).max(5000), version: z.string().min(1).max(100), promotionNotes: z.string().max(5000),
    evalsetHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(20).default([]),
  }).passthrough(),
}).strict();
type Run = typeof shortSprintRunsTable.$inferSelect;
type Evidence = Awaited<ReturnType<typeof verifiedSprintReceipt>>;
const records = (value: unknown): Record<string, Evidence> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Evidence> : {};
export const sprintActions = (run: Run) => {
  if (["WITHDRAWN", "CONTINUED"].includes(run.state)) return ["EXPORT"];
  if (run.result.promotion) return ["IMPORT_EVIDENCE", "EXPORT"];
  if (run.state === "LIVE") return ["IMPORT_EVIDENCE", "PROMOTE", "EXPORT"];
  const actions = ["IMPORT_EVIDENCE", "EXPORT", "WITHDRAW"];
  if (["PROPOSED", "DEFERRED", "SOURCE_READY"].includes(run.state)) actions.push("YES", "NO", "DEFER");
  if (["ROUTED", "PACK_FAILED", "PACK_INCONCLUSIVE", "PACK_PASSED"].includes(run.state)) actions.push("RUN_PACK");
  if (run.state === "PACK_PASSED") actions.push("SEAL");
   if (["SEALED", "RELEASE_PENDING", "HANDOFF_PENDING", "MONITORING"].includes(run.state)) actions.push("RELEASE");
   if (run.state === "SEALED") actions.push("PROMOTE");
  return actions;
};
export async function sprintRun(tx: OperationsTx, actor: OperationsActor, id: string) {
  const [run] = await tx.select().from(shortSprintRunsTable).where(and(eq(shortSprintRunsTable.id, id), eq(shortSprintRunsTable.userId, actor.id)));
  if (!run) throw new OperationsError(404, "SHORT SPRINTS workflow not found.");
  return run;
}
/** Source preparation does not open a route, certify a source or touch guarded workflow tables. */
export async function prepareSprintSource(actor: OperationsActor, sessionId: string, sourceId: string | undefined, options: unknown, id: string) {
  const config = createSchema.parse(options);
  await ownedOperationsSession(actor.id, sessionId);
  const sourceType = config.circuit === "SC_ONE" ? "MICRO_PDD" : "SPC";
  const [artifact] = await db.select({ id: harnessArtifactsTable.id, parentArtifactId: harnessArtifactsTable.parentArtifactId, createdAt: harnessArtifactsTable.createdAt, provider: harnessArtifactsTable.provider }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.sessionId, sessionId), eq(harnessArtifactsTable.userId, actor.id), eq(harnessArtifactsTable.artifactType, sourceType), sourceId ? eq(harnessArtifactsTable.id, sourceId) : undefined)).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(1);
  if (!artifact) throw new OperationsError(404, `Save an owned ${sourceType} before creating this circuit.`);
  const source = await savedPublicationSource(actor.id, config.circuit === "SC_ONE" ? "F4_MICRO_PDD" : "F5_SPC", artifact.id);
  const scanConfig = publishRequest.parse({ title: config.manifest.name, project: sessionId, author: actor.displayName || "Accountable human", authorIsHuman: true, formats: ["HTML"] });
  if (sourceSafety({ source: source.raw, manifest: config.manifest }, scanConfig).secrets) throw new OperationsError(409, "Remove possible secrets before preparing a release package.");
  let birthPackage: unknown = null;
  if (config.circuit === "SC_ONE") {
    const [birth] = await db.select({ id: harnessArtifactsTable.id, raw: sql<unknown>`case when octet_length(${harnessArtifactsTable.artifactContent}::text) <= 524288 then ${harnessArtifactsTable.artifactContent} else null end` }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, actor.id), eq(harnessArtifactsTable.sessionId, sessionId), eq(harnessArtifactsTable.artifactType, "MA_BIRTH_PACKAGE"), artifact.parentArtifactId ? eq(harnessArtifactsTable.id, artifact.parentArtifactId) : sql`${harnessArtifactsTable.createdAt} <= ${artifact.createdAt}`)).orderBy(desc(harnessArtifactsTable.createdAt), desc(harnessArtifactsTable.id)).limit(1);
    if (!birth) throw new OperationsError(409, "SC ONE requires the saved CELL birth package as well as its Micro PDD.");
    if (!birth.raw) throw new OperationsError(413, "The birth package exceeds the 512 KB source limit.");
    if (sourceSafety(birth.raw, scanConfig).secrets) throw new OperationsError(409, "Remove possible secrets from the CELL birth package.");
    birthPackage = { id: birth.id, hash: hashContent(birth.raw), content: birth.raw };
  }
  const sass = config.circuit === "SC_TWO" ? {
    identity: { name: config.manifest.name, version: config.manifest.version, owner: actor.id, circuit: config.circuit },
    mission: config.manifest.mission, prompts: config.manifest.systemPrompt,
    contracts: { input: config.manifest.inputContract, output: config.manifest.outputContract },
    tools: config.manifest.tools, constraints: config.manifest.constraints, gro: config.manifest.groRules,
    failClosed: config.manifest.failClosedRules,
    evaluation: { evalsetHashes: config.manifest.evalsetHashes, packResultReference: id },
    deployment: { host: config.hostTarget, configuration: config.manifest.deployment },
    model: { model: config.manifest.model, provider: config.manifest.provider },
    dataHandling: config.manifest.dataHandling, monitoring: config.manifest.monitoring,
    version: config.manifest.version, promotionNotes: config.manifest.promotionNotes,
  } : null;
  const describeFile = (name: string, value: unknown) => { const content = JSON.stringify(value, null, 2); return { name, sha256: fileHash(content), content }; };
  const releaseFiles = [
    describeFile("source.json", source.raw),
    describeFile("agent-configuration.json", config.manifest),
    ...(birthPackage ? [describeFile("cell-birth-package.json", birthPackage)] : []),
    ...(sass ? [describeFile("standalone-agent-spec-sheet.json", sass)] : []),
  ];
  const shippedFiles = releaseFiles.map(({ name, sha256, content }) => ({ name, sha256, size: Buffer.byteLength(content) }));
  const manifestHash = hashContent({ sourceHash: source.hash, circuit: config.circuit, target: config.target, profile: config.profile, hostTarget: config.hostTarget, shippedFiles });
  return { config, artifact, source, birthPackage, sass, releaseFiles, shippedFiles, manifestHash };
}
export async function createSprint(actor: OperationsActor, sessionId: string, sourceId: string | undefined, options: unknown) {
  const id = randomUUID(), key = `short-sprints/${actor.id}/${id}/source`;
  const { config, artifact, source, birthPackage, sass, releaseFiles, shippedFiles, manifestHash } = await prepareSprintSource(actor, sessionId, sourceId, options, id);
  // JSONB reorders object keys. Keep the exact original UTF-8 strings rather
  // than regenerating byte-bound files from the database representation.
  await savePrivate(key, JSON.stringify({ source: source.raw, birthPackage, releaseFiles }));
  await withOperationsActor(actor, async tx => {
    await tx.insert(shortSprintRunsTable).values({ id, userId: actor.id, sessionId, sourceArtifactId: artifact.id, sourceHash: source.hash, sourceObjectKey: key, circuit: config.circuit, target: config.target, profile: config.profile, config, result: { sourceCreatedAt: artifact.createdAt.toISOString(), producerFamily: artifact.provider, manifestHash, shippedFiles, sass, evidence: {}, missingRequirements: ["A trusted, signed source-stage certification and independent pack evidence are required. Legacy scores and model self-assessments are not certificates."] } });
    await operationEvent(tx, actor, actor.id, id, "short-sprints", "sc_proposal_created", 0, { sourceHash: source.hash, manifestHash, circuit: config.circuit });
  });
  return id;
}
async function currentEvidence(tx: OperationsTx, run: Run) {
  const verified: Record<string, Evidence> = {};
  for (const [key, evidence] of Object.entries(records(run.result.evidence))) {
    try {
      verified[key] = await verifiedSprintReceipt(tx, { payload: evidence.payload, signature: evidence.signature }, { id: run.id, sourceHash: run.sourceHash, sourceCreatedAt: String(run.result.sourceCreatedAt), producerFamily: typeof run.result.producerFamily === "string" ? run.result.producerFamily : null });
      if (evidence.payload.manifestHash !== run.result.manifestHash) delete verified[key];
    } catch { /* Expired/revoked evidence remains in history, never in the active gate. */ }
  }
  return verified;
}
function eligibility(run: Run, evidence: Record<string, Evidence>) {
  const cert = evidence.SOURCE_CERTIFICATION;
  const facts = cert?.payload.verdict === "PASS" ? cert.payload.facts : undefined;
  const missing = { value: null, evidenceHash: null };
  const unknownFacts = Object.fromEntries(Object.keys(sprintEligibilityInputSchema.shape.facts.shape).map(k => [k, missing]));
  return evaluateSprintEligibility(sprintEligibilityInputSchema.parse({
    circuit: run.circuit, target: run.target, profile: run.profile, sourceArtifactHash: run.sourceHash,
    facts: facts ?? unknownFacts,
  }));
}
export function assessSprintPack(run: Pick<Run, "circuit" | "profile" | "config" | "result">, evidence: Record<string, Evidence>) {
  const requirements: Record<string, string[]> = { E: ["UNIT_TRAJECTORY", "LYSOSOME_STRESS", "CONTRACT_CONFORMANCE", "FAIL_CLOSED"], R: ["INJECTION", "POISONED_PREMISE"], C: ["MANIFEST_CUSTODY"] };
  if (run.circuit === "SC_TWO") { requirements.J = ["CROSS_MODEL_QUALITY"]; requirements.S = ["SASS_MATCH"]; }
  if (run.profile === "REGULATED") requirements.H = ["HUMAN_REVIEW"];
  const hashes = (run.config.manifest as { evalsetHashes?: string[] } | undefined)?.evalsetHashes ?? [];
  const tracks = Object.entries(requirements).map(([track, checks]) => {
    const receipt = evidence[track];
    const missing = checks.filter(c => !receipt?.payload.checks.includes(c));
    if (track === "E" && run.circuit === "SC_TWO" && !hashes.includes(receipt?.payload.evalsetHash ?? "")) missing.push("SASS_EVALSET_BINDING");
    const status = receipt?.payload.verdict === "FAIL" ? "FAIL" : receipt?.payload.verdict === "PASS" && !missing.length ? "PASS" : "INCONCLUSIVE";
    return { id: track, track, status, reason: missing.length ? `Missing verified checks: ${missing.join(", ")}` : `Trusted ${receipt?.authorityName ?? "unavailable"} result`, independence: receipt?.independence ?? 0, receiptHash: receipt?.receiptHash ?? null };
  });
  const status = tracks.some(t => t.status === "FAIL") ? "FAIL" : tracks.every(t => t.status === "PASS") ? "PASS" : "INCONCLUSIVE";
  return { status, tracks, packHash: hashContent({ manifestHash: run.result.manifestHash, sourceCertificateHash: evidence.SOURCE_CERTIFICATION?.receiptHash ?? null, tracks }) };
}
function requireFreshPack(run: Run, evidence: Record<string, Evidence>) {
  const current = assessSprintPack(run, evidence);
  const recorded = run.result.pack as { status?: string; packHash?: string } | undefined;
  if (eligibility(run, evidence).state !== "ELIGIBLE" || current.status !== "PASS" || recorded?.status !== "PASS" || current.packHash !== recorded.packHash) throw new OperationsError(409, "The verification pack is stale, expired, revoked or changed. Validate current receipts again before sealing or releasing.");
  return current;
}
function sourceFiles(run: Run, snapshot: { source: unknown; birthPackage: unknown; releaseFiles?: unknown }) {
  const content: Record<string, unknown> = { "source.json": snapshot.source, "agent-configuration.json": run.config.manifest };
  if (snapshot.birthPackage) content["cell-birth-package.json"] = snapshot.birthPackage;
  if (run.result.sass) content["standalone-agent-spec-sheet.json"] = run.result.sass;
  const files = snapshot.releaseFiles === undefined
    ? Object.entries(content).map(([name, value]) => { const text = JSON.stringify(value, null, 2); return { name, sha256: fileHash(text), content: text }; })
    : z.array(z.object({ name: z.string(), sha256: z.string(), content: z.string() }).strict()).parse(snapshot.releaseFiles);
  const declared = z.array(z.object({ name: z.string(), sha256: z.string(), size: z.number() })).parse(run.result.shippedFiles);
  if (files.length !== declared.length || files.some((f, i) => f.name !== declared[i]!.name || f.sha256 !== declared[i]!.sha256 || fileHash(f.content) !== f.sha256 || Buffer.byteLength(f.content) !== declared[i]!.size)) {
    throw new OperationsError(409, "Original file bytes do not match this proposal's manifest. Create a new proposal; the old manifest will not be rewritten.");
  }
  return files;
}
export async function sprintCommand(actor: OperationsActor, id: string, revision: number, action: string, options: Record<string, unknown>) {
  return withOperationsActor(actor, async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`short-sprints:${id}`}))`);
    const run = await sprintRun(tx, actor, id);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`short-sprints-session:${run.sessionId}`}))`);
    if (run.revision !== revision) throw new OperationsError(409, "This workflow changed. Refresh before acting.");
    if (!sprintActions(run).includes(action)) throw new OperationsError(409, "Action unavailable in this workflow state.");
    if (["SEAL", "RELEASE", "PROMOTE"].includes(action)) {
      const [unresolved] = await tx.select({ id: vteVerificationFailuresTable.id }).from(vteVerificationFailuresTable).where(and(eq(vteVerificationFailuresTable.ownerUserId, actor.id), eq(vteVerificationFailuresTable.sprintRunId, run.id), eq(vteVerificationFailuresTable.state, "OPEN"))).limit(1);
      if (unresolved) throw new OperationsError(409, "Resolve the open VTE failure case with a named review bound to the current passing pack before custody, release or promotion.");
    }
    const [source] = await tx.select({ raw: sql<unknown>`case when octet_length(${harnessArtifactsTable.artifactContent}::text) <= 524288 then ${harnessArtifactsTable.artifactContent} else null end` }).from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, run.sourceArtifactId), eq(harnessArtifactsTable.userId, actor.id)));
    if ((!source || hashContent(source.raw) !== run.sourceHash) && !["WITHDRAW", "NO", "DEFER", "IMPORT_EVIDENCE"].includes(action)) throw new OperationsError(409, "The source artifact changed or disappeared. Create a new proposal; stale evidence cannot be reused. Withdrawal and rollback evidence remain available.");
    const evidence = await currentEvidence(tx, run);
    let state = run.state, activeRoute = run.activeRoute;
    let result: Record<string, unknown> = { ...run.result };
    let eventAction = `sc_${action.toLowerCase()}`;
    if (action === "IMPORT_EVIDENCE") {
      const receipt = await verifiedSprintReceipt(tx, options.receipt, { id: run.id, sourceHash: run.sourceHash, sourceCreatedAt: String(run.result.sourceCreatedAt), producerFamily: typeof run.result.producerFamily === "string" ? run.result.producerFamily : null });
      if (receipt.payload.manifestHash !== run.result.manifestHash) throw new OperationsError(409, "Evidence does not bind the current shipped-file manifest.");
      const isPromotion = receipt.payload.scope === "H" && receipt.payload.checks.includes("SPHINX_PROMOTION_APPROVED");
      const isResolution = receipt.payload.scope === "H" && receipt.payload.checks.includes("VTE_RESOLUTION_APPROVED");
      const sealed = ["SEALED", "RELEASE_PENDING", "HANDOFF_PENDING", "MONITORING", "LIVE", "ROLLBACK_REQUIRED", "ROLLED_BACK"].includes(run.state);
      if (sealed && !["P", "F95", "F10", "F11", "F12"].includes(receipt.payload.scope) && !isPromotion && !isResolution) throw new OperationsError(409, "A sealed package's source and test evidence are immutable. Withdraw and prepare a new version instead.");
      const key = receipt.payload.scope === "F12" ? receipt.payload.checks.includes("ROLLBACK_EXECUTED") ? "F12_ROLLBACK" : `F12_${receipt.payload.stage}` : isPromotion ? "H_PROMOTION" : isResolution ? `H_CASE_${receipt.payload.caseId}` : receipt.payload.scope;
      if (["P", "F95", "F10", "F11", "F12"].includes(receipt.payload.scope)) {
        const bundle = result.package as { manifestHash?: string } | undefined;
        const pack = result.pack as { packHash?: string; checkedAt?: string } | undefined;
        if (!bundle || receipt.payload.sealedManifestHash !== bundle.manifestHash || receipt.payload.packHash !== pack?.packHash || Date.parse(receipt.payload.issuedAt) < Date.parse(pack?.checkedAt ?? "")) throw new OperationsError(409, "Downstream evidence must bind the complete, already-created release package and pack hash.");
      }
      if (isResolution) {
        const pack = requireFreshPack(run, evidence);
        if (!receipt.payload.caseId || receipt.payload.packHash !== pack.packHash || receipt.payload.verdict !== "PASS") throw new OperationsError(409, "VTE resolution requires a named review bound to a passing current pack and the exact case.");
        const [closed] = await tx.update(vteVerificationFailuresTable).set({ state: "CLOSED" }).where(and(eq(vteVerificationFailuresTable.id, receipt.payload.caseId), eq(vteVerificationFailuresTable.ownerUserId, actor.id), eq(vteVerificationFailuresTable.sprintRunId, run.id))).returning();
        if (!closed) throw new OperationsError(404, "The reviewed failure case does not belong to this workflow.");
        result.failureCase = { ...(result.failureCase as Record<string, unknown> ?? {}), state: "CLOSED", approvedBy: receipt.authorityName, resolutionReceiptHash: receipt.receiptHash };
      }
      const old = records(result.evidence)[key];
      if (old && Date.parse(old.payload.issuedAt) >= Date.parse(receipt.payload.issuedAt)) throw new OperationsError(409, "This evidence is duplicate or older than the current receipt.");
      evidence[key] = receipt;
      result.evidence = { ...records(result.evidence), [key]: receipt };
      if (receipt.payload.scope === "F12" && receipt.payload.verdict !== "PASS") {
        state = "ROLLBACK_REQUIRED";
        result.release = { ...(result.release as Record<string, unknown> ?? {}), status: state, healthy: false, incidentReceiptHash: receipt.receiptHash, rollbackExecuted: false };
      } else if (key === "F12_ROLLBACK" && receipt.payload.verdict === "PASS") {
        const lastHealth = Math.max(0, ...["F12_5", "F12_25", "F12_100"].map(k => Date.parse(evidence[k]?.payload.issuedAt ?? "") || 0));
        if (Date.parse(receipt.payload.issuedAt) <= lastHealth) throw new OperationsError(409, "Rollback confirmation must be newer than every reported traffic or health window.");
        state = "ROLLED_BACK";
        result.release = { ...(result.release as Record<string, unknown> ?? {}), status: state, rollbackExecuted: true, rollbackReceiptHash: receipt.receiptHash, provenance: "Authenticated provider-reported rollback; not an assumed traffic change" };
      }
      result.eligibility = eligibility(run, evidence);
      if (state === "PROPOSED" && eligibility(run, evidence).state === "ELIGIBLE") state = "SOURCE_READY";
      result.missingRequirements = eligibility(run, evidence).results.filter(r => r.status !== "PASS").map(r => r.reason);
      if (state === "ROLLBACK_REQUIRED") result.missingRequirements = ["A current provider ROLLBACK_EXECUTED receipt is required. No external traffic stop has been assumed."];
      if (state === "ROLLED_BACK") result.missingRequirements = ["Provider reports rollback complete. Withdraw this route to restore its saved full-path state."];
    } else if (["YES", "NO", "DEFER", "WITHDRAW"].includes(action)) {
      const reason = z.string().trim().min(3).max(2000).parse(options.reason);
      const assessment = eligibility(run, evidence);
      result.eligibility = assessment;
      result.gateDecision = { decision: action === "YES" ? "YES" : action === "NO" ? "NO" : action === "DEFER" ? "DEFERRED" : "WITHDRAWN", owner: actor.id, timestamp: new Date().toISOString(), reason, eligibilityHash: assessment.eligibilityHash, manifestHash: result.manifestHash };
      eventAction = "sc_gate_decision";
      if (action === "YES") {
        if (assessment.state !== "ELIGIBLE") throw new OperationsError(409, "The gate cannot accept Yes until every eligibility rule has trusted evidence.");
        if (run.target === "FIRMWARE") throw new OperationsError(409, "Firmware must continue on the full path until MECHA short-route compatibility is resolved. F9 cannot be skipped.");
        if (run.circuit === "SC_ONE" && ((run.config.manifest as { tools?: unknown[] }).tools?.length ?? 0) > 1) throw new OperationsError(409, "SC ONE permits at most one tool in the actual shipped manifest.");
        const [active] = await tx.select({ id: shortSprintRunsTable.id }).from(shortSprintRunsTable).where(and(eq(shortSprintRunsTable.sessionId, run.sessionId), eq(shortSprintRunsTable.activeRoute, 1)));
        if (active && active.id !== run.id) throw new OperationsError(409, "Another short route is active. Withdraw or promote it before selecting a new one.");
        state = "ROUTED"; activeRoute = 1;
        const skipped = run.circuit === "SC_ONE" ? [5, 6, 7, 8, 9] : [6, 7, 8, 9];
        const previous = await tx.select().from(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, run.sessionId));
        result.previousStages = previous.filter(p => skipped.includes(p.featureId)).map(p => ({ featureId: p.featureId, status: p.status }));
        for (const featureId of skipped) {
          if (previous.some(p => p.featureId === featureId && p.status === "COMPLETE")) continue;
          await tx.insert(harnessFeatureStateTable).values({ sessionId: run.sessionId, featureId, status: "SKIPPED_BY_SC" }).onConflictDoUpdate({ target: [harnessFeatureStateTable.sessionId, harnessFeatureStateTable.featureId], set: { status: "SKIPPED_BY_SC", updatedAt: new Date() } });
        }
        result.route = { circuit: run.circuit, skippedStages: skipped.map(n => `F${n}`), requiredStages: ["PACK", "F9.5", "F10", "F11", "F12"], sourceHash: run.sourceHash };
        result.missingRequirements = ["Complete the independent verification pack."];
      } else if (action === "DEFER") state = "DEFERRED";
      else {
        if (["RELEASE_PENDING", "HANDOFF_PENDING", "MONITORING", "ROLLBACK_REQUIRED", "ROLLED_BACK"].includes(run.state)) {
          const rollback = evidence.F12_ROLLBACK;
          const pack = run.result.pack as { packHash?: string };
          if (!rollback || rollback.payload.verdict !== "PASS" || rollback.payload.packHash !== pack.packHash || rollback.payload.sealedManifestHash !== (run.result.package as { manifestHash?: string })?.manifestHash) throw new OperationsError(409, "An authenticated provider ROLLBACK_EXECUTED receipt is required before withdrawing a dispatched rollout. This platform does not pretend to stop external traffic.");
        }
        state = action === "NO" ? "CONTINUED" : "WITHDRAWN"; activeRoute = 0;
        const previous = z.array(z.object({ featureId: z.number(), status: z.enum(["LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETE", "SKIPPED_BY_SC"]) })).parse(result.previousStages ?? []);
        if (run.activeRoute === 1) for (let featureId = run.circuit === "SC_ONE" ? 5 : 6; featureId <= 9; featureId++) await tx.update(harnessFeatureStateTable).set({ status: previous.find(p => p.featureId === featureId)?.status ?? (featureId === (run.circuit === "SC_ONE" ? 5 : 6) ? "AVAILABLE" : "LOCKED"), updatedAt: new Date() }).where(and(eq(harnessFeatureStateTable.sessionId, run.sessionId), eq(harnessFeatureStateTable.featureId, featureId), eq(harnessFeatureStateTable.status, "SKIPPED_BY_SC")));
      }
    } else if (action === "RUN_PACK") {
      if (eligibility(run, evidence).state !== "ELIGIBLE") throw new OperationsError(409, "Source eligibility is no longer current.");
      const { status, tracks, packHash } = assessSprintPack(run, evidence);
      result.pack = { status, tracks, packHash, checkedAt: new Date().toISOString(), execution: "Authenticated external verification evidence; this action does not fabricate or run an external tool" };
      state = status === "PASS" ? "PACK_PASSED" : status === "FAIL" ? "PACK_FAILED" : "PACK_INCONCLUSIVE";
      if (status !== "PASS") { delete result.package; delete result.sealedManifestHash; }
      if (status === "FAIL") {
        const [inserted] = await tx.insert(vteVerificationFailuresTable).values({ ownerUserId: actor.id, sessionId: run.sessionId, sprintRunId: run.id, sourceEvidenceHash: packHash, stage: run.circuit === "SC_ONE" ? "F4" : "F5", state: "OPEN" }).onConflictDoNothing().returning();
        const [existing] = inserted ? [inserted] : await tx.select().from(vteVerificationFailuresTable).where(and(eq(vteVerificationFailuresTable.sprintRunId, run.id), eq(vteVerificationFailuresTable.sourceEvidenceHash, packHash)));
        result.failureCase = { id: existing!.id, sourceHash: run.sourceHash, state: existing!.state, kind: "SHORT_SPRINT_PACK_FAILURE", failingTracks: tracks.filter(t => t.status === "FAIL").map(t => t.track), remediationStage: existing!.stage, createdAt: existing!.createdAt.toISOString(), packHash };
      }
      if (status === "PASS") {
        const snapshot = JSON.parse((await readPrivate(run.sourceObjectKey)).toString());
        if (hashContent(snapshot.source) !== run.sourceHash) throw new OperationsError(409, "Source snapshot integrity failed.");
        const rawReceipts = Object.fromEntries(["SOURCE_CERTIFICATION", ...tracks.map(t => t.track)].map(k => [k, { payload: evidence[k]!.payload, signature: evidence[k]!.signature }]));
        const files = [...sourceFiles(run, snapshot), ...Object.entries({ "verification-pack.json": result.pack, "verification-receipts.json": rawReceipts }).map(([name, value]) => { const content = JSON.stringify(value, null, 2); return { name, sha256: fileHash(content), content }; })];
        const manifest = files.map(({ name, sha256 }) => ({ name, sha256 }));
        const manifestHash = hashContent({ protocol: "ATANDA-SS-PACKAGE-1", files: manifest });
        const objectKey = `short-sprints/${actor.id}/${run.id}/packages/${run.revision}-${packHash}`;
        await savePrivate(objectKey, JSON.stringify({ protocol: "ATANDA-SS-PACKAGE-1", manifestHash, files }));
        result.package = { objectKey, manifestHash, files: files.map(f => ({ name: f.name, sha256: f.sha256, size: Buffer.byteLength(f.content) })), packHash };
        result.sealedManifestHash = manifestHash;
      }
      result.missingRequirements = status === "PASS" ? ["OSIRIS F9.5 custody seal is required."] : tracks.filter(t => t.status !== "PASS").map(t => `${t.track}: ${t.reason}`);
      eventAction = "sc_pack_result";
    } else if (action === "SEAL") {
      const pack = requireFreshPack(run, evidence);
      const custody = evidence.F95;
      if (!custody || custody.payload.verdict !== "PASS" || custody.payload.packHash !== pack.packHash || custody.payload.sealedManifestHash !== (result.package as { manifestHash?: string } | undefined)?.manifestHash) throw new OperationsError(409, "A current independent pack and OSIRIS F9.5 receipt bound to every shipped file are required.");
      result.custody = { manifestHash: result.manifestHash, packHash: pack.packHash, receiptHash: custody.receiptHash, authority: custody.authorityName, sealedAt: new Date().toISOString() };
      state = "SEALED"; result.missingRequirements = ["Verified F10 release receipt and provider-terms check."];
    } else if (action === "RELEASE") {
      const pack = requireFreshPack(run, evidence);
      if (!evidence.F95 || evidence.F95.payload.verdict !== "PASS" || evidence.F95.payload.packHash !== pack?.packHash) throw new OperationsError(409, "Custody is expired, revoked or does not match the current pack.");
      const lastStage = (result.release as { lastStage?: string } | undefined)?.lastStage;
      const required = state === "SEALED" ? ["P", "F10"] : state === "RELEASE_PENDING" ? ["P", "F10", "F11"] : state === "HANDOFF_PENDING" ? ["P", "F10", "F11", "F12_5"] : lastStage === "25" ? ["P", "F10", "F11", "F12_5", "F12_25", "F12_100"] : ["P", "F10", "F11", "F12_5", "F12_25"];
      for (const key of required) {
        const receipt = evidence[key];
        if (!receipt || receipt.payload.verdict !== "PASS" || receipt.payload.packHash !== pack.packHash || receipt.payload.sealedManifestHash !== (result.package as { manifestHash?: string }).manifestHash) throw new OperationsError(409, `A valid ${key} receipt bound to the complete sealed package is required.`);
        if (key.startsWith("F12_") && (!receipt.payload.healthUrl || !receipt.payload.rollbackReference || !["HEALTH_WINDOW_PASS", "ROLLBACK_READY", "ERROR_BUDGET_PASS"].every(c => receipt.payload.checks.includes(c)))) throw new OperationsError(409, "F12 needs real health-window, error-budget and rollback evidence.");
      }
      const checks: Record<string, string[]> = { P: ["PROVIDER_TERMS_CURRENT"], F10: ["PROVIDER_READY", "REGRESSION_BASELINE_PASS"], F11: ["HANDOFF_COMPLETE", "NAMED_RELEASE_SIGNOFF"] };
      for (const key of required) if ((checks[key] ?? []).some(check => !evidence[key]!.payload.checks.includes(check))) throw new OperationsError(409, `The ${key} receipt is missing mandatory readiness or sign-off checks.`);
      const order = ["F95", "F10", "F11", "F12_5", "F12_25", "F12_100"].filter(k => k === "F95" || required.includes(k));
      for (let i = 1; i < order.length; i++) if (Date.parse(evidence[order[i]!]!.payload.issuedAt) <= Date.parse(evidence[order[i - 1]!]!.payload.issuedAt)) throw new OperationsError(409, "Custody, release, named handoff and 5/25/100 health windows must be evidenced in chronological order.");
      const previousState = state;
      state = state === "SEALED" ? "RELEASE_PENDING" : state === "RELEASE_PENDING" ? "HANDOFF_PENDING" : state === "HANDOFF_PENDING" || lastStage !== "25" ? "MONITORING" : "LIVE";
      result.release = { status: state, lastStage: state === "LIVE" ? "100" : previousState === "HANDOFF_PENDING" ? "5" : previousState === "MONITORING" ? "25" : null, receiptScopes: Object.keys(evidence).filter(k => k.startsWith("F1")), updatedAt: new Date().toISOString(), provenance: "Trusted provider receipts; no deployment or traffic change is inferred from a button press" };
      result.missingRequirements = state === "LIVE" ? [] : [`Complete ${previousState === "SEALED" ? "F11" : previousState === "RELEASE_PENDING" ? "5% F12 rollout" : "25% and 100% F12 rollout"} evidence.`];
    } else if (action === "PROMOTE") {
      const reason = z.string().trim().min(10).max(2000).parse(options.reason);
      if (!["LIVE", "SEALED"].includes(state)) throw new OperationsError(409, "Promotion requires a sealed or live short-route version.");
      const next = run.circuit === "SC_ONE" ? 5 : 6;
      // Platform curator approval must arrive as a named human scope H receipt.
      const approval = evidence.H_PROMOTION;
      if (!approval || approval.payload.verdict !== "PASS" || approval.payload.packHash !== requireFreshPack(run, evidence).packHash || !approval.payload.checks.includes("SPHINX_PROMOTION_APPROVED")) throw new OperationsError(409, "A named independent SPHINX promotion approval bound to this exact pack is required; ordinary Track H review is not promotion approval.");
      for (let featureId = next; featureId <= 9; featureId++) await tx.update(harnessFeatureStateTable).set({ status: featureId === next ? "AVAILABLE" : "LOCKED", updatedAt: new Date() }).where(and(eq(harnessFeatureStateTable.sessionId, run.sessionId), eq(harnessFeatureStateTable.featureId, featureId), eq(harnessFeatureStateTable.status, "SKIPPED_BY_SC")));
      result.promotion = { parentTraceId: run.id, reenterAt: `F${next}`, reason, approvedBy: approval.authorityName, at: new Date().toISOString(), liveVersionRetained: state === "LIVE" };
      activeRoute = 0; eventAction = "sc_promotion";
    } else throw new OperationsError(400, "Unsupported SHORT SPRINTS action.");
    const [updated] = await tx.update(shortSprintRunsTable).set({ state, activeRoute, result, revision: revision + 1, updatedAt: new Date() }).where(and(eq(shortSprintRunsTable.id, id), eq(shortSprintRunsTable.userId, actor.id), eq(shortSprintRunsTable.revision, revision))).returning();
    if (!updated) throw new OperationsError(409, "Workflow revision conflict.");
    await operationEvent(tx, actor, actor.id, id, "short-sprints", eventAction, updated.revision, { sourceHash: run.sourceHash, manifestHash: result.manifestHash, packHash: (result.pack as { packHash?: string } | undefined)?.packHash ?? null, sealedManifestHash: result.sealedManifestHash ?? null, state, action, resultHash: hashContent(result) });
    return id;
  });
}
export async function sprintExport(actor: OperationsActor, id: string) {
  const run = await withOperationsActor(actor, tx => sprintRun(tx, actor, id));
  const source = JSON.parse((await readPrivate(run.sourceObjectKey)).toString());
  if (hashContent(source.source) !== run.sourceHash) throw new OperationsError(409, "Release package integrity failed.");
  const stored = run.result.package as { objectKey?: string; manifestHash?: string } | undefined;
  const bundle = stored?.objectKey ? JSON.parse((await readPrivate(stored.objectKey)).toString()) as { files: { name: string; sha256: string; content: string }[]; manifestHash: string } : null;
  if (bundle && (bundle.files.some(f => fileHash(f.content) !== f.sha256) || hashContent({ protocol: "ATANDA-SS-PACKAGE-1", files: bundle.files.map(({ name, sha256 }) => ({ name, sha256 })) }) !== stored?.manifestHash)) throw new OperationsError(409, "Sealed release files failed their integrity check.");
  const { package: _privatePackage, ...evidence } = run.result;
  return { kind: "SHORT_SPRINT_RELEASE_PACKAGE", releaseAllowed: false, recordedReleaseState: run.state, workflowId: id, circuit: run.circuit, sourceHash: run.sourceHash, source, configuration: run.config, evidence, files: bundle?.files ?? sourceFiles(run, source), sealedManifestHash: stored?.manifestHash ?? null, advisory: "EXPORT IS NOT A RELEASE AUTHORIZATION. Provider-reported receipts retain their provenance; freshness and authority must be revalidated before any new release." };
}
