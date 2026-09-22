import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  f11HostEventsTable,
  f11HostRunsTable,
  harnessArtifactsTable,
  harnessSessionsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  buildUcgHostEvidence,
  checkF11ProviderAdapter,
  f11PromotionWriteHash,
  f11StageWriteHash,
  getF11ProviderAdapter,
  sha256,
  signHostReceipt,
  validateF11HumanAttestations,
  validateF11VaultHandle,
  F11_HOST_PROVIDERS,
} from "../lib/f11-host";

const router: IRouter = Router();

const consentSchema = z.object({
  consentId: z.uuid(),
  purpose: z.enum(["STAGE", "PROMOTION"]),
  deploymentSubject: z.string().trim().min(1).max(300),
  exactWriteHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
});
const vaultSchema = z.object({
  handle: z.string().regex(/^vault-handle:[A-Za-z0-9_-]{16,200}$/u),
  scope: z.enum(["F11_STAGE", "F11_PROMOTION"]),
  deploymentSubject: z.string().trim().min(1).max(300),
  expiresAt: z.iso.datetime(),
});
const stageBody = z.object({
  sessionId: z.uuid(),
  planArtifactId: z.uuid(),
  sourceArtifactId: z.uuid(),
  source: z.enum(["F8_BUNDLE", "F10_HANDOFF", "CHAT_ONLY"]),
  provider: z.string().trim().min(1).max(80),
  accountRef: z.string().trim().min(1).max(200),
  region: z.string().trim().min(1).max(120),
  exactContentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  costCeilingCents: z.number().int().positive().max(100_000_000),
  deploymentSubject: z.string().trim().min(1).max(300),
  consent: consentSchema,
  vaultHandle: vaultSchema,
  rollbackPlan: z.string().trim().min(1).max(2000),
  humanAttestations: z.array(z.unknown()).min(2).max(8),
});
const verifyBody = z.object({
  health: z.object({ passed: z.literal(true), evidenceRef: z.string().trim().min(1).max(500) }),
  smoke: z.object({ passed: z.literal(true), evidenceRef: z.string().trim().min(1).max(500) }),
  rollback: z.object({ passed: z.literal(true), evidenceRef: z.string().trim().min(1).max(500) }),
});
const certifyBody = z.object({
  authorId: z.string().trim().min(1).max(200),
  scorerId: z.string().trim().min(1).max(200),
  adjudicatorId: z.string().trim().min(1).max(200),
});
const promoteBody = z.object({
  promotionSubject: z.string().trim().min(1).max(300),
  consent: consentSchema,
  vaultHandle: vaultSchema,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function ownedSession(userId: string, sessionId: string) {
  const [session] = await db.select({ id: harnessSessionsTable.id })
    .from(harnessSessionsTable)
    .where(and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, userId)))
    .limit(1);
  return Boolean(session);
}

async function ownedRun(userId: string, id: string) {
  const [run] = await db.select().from(f11HostRunsTable)
    .where(and(eq(f11HostRunsTable.id, id), eq(f11HostRunsTable.tenantId, userId)))
    .limit(1);
  return run;
}

async function transition(
  run: typeof f11HostRunsTable.$inferSelect,
  toState: typeof f11HostRunsTable.$inferInsert["state"],
  eventType: string,
  evidence: unknown,
  actorId: string,
) {
  const [updated] = await db.update(f11HostRunsTable)
    .set({ state: toState, updatedAt: new Date() })
    .where(and(eq(f11HostRunsTable.id, run.id), eq(f11HostRunsTable.state, run.state)))
    .returning();
  if (!updated) return null;
  await db.insert(f11HostEventsTable).values({
    hostRunId: run.id,
    tenantId: run.tenantId,
    fromState: run.state,
    toState,
    eventType,
    evidence: isRecord(evidence) ? evidence : { value: evidence },
    actorId,
  } as never);
  return updated;
}

router.get("/f11/provider-adapters", requireAuth, (_req, res) => {
  res.json(F11_HOST_PROVIDERS.map((provider) => {
    const adapter = getF11ProviderAdapter(provider)!;
    const readiness = checkF11ProviderAdapter(adapter);
    return {
      provider,
      adapterId: adapter.adapterId,
      adapterVersion: adapter.adapterVersion,
      provenance: adapter.provenance,
      capabilities: adapter.capabilities,
      scopes: adapter.scopes,
      reversible: adapter.reversible,
      governance: adapter.governance,
      onboardingPassed: readiness.onboardingPassed,
      qualified: readiness.qualified,
      checks: readiness.checks,
    };
  }));
});

router.get("/f11/host-runs", requireAuth, async (req, res): Promise<void> => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const rows = await db.select().from(f11HostRunsTable).where(
    sessionId
      ? and(eq(f11HostRunsTable.tenantId, req.localUser!.id), eq(f11HostRunsTable.sessionId, sessionId))
      : eq(f11HostRunsTable.tenantId, req.localUser!.id),
  ).orderBy(desc(f11HostRunsTable.createdAt));
  res.json(rows);
});

router.get("/f11/host-runs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const run = await ownedRun(req.localUser!.id, id);
  if (!run) { res.status(404).json({ error: "F11 host run not found" }); return; }
  const events = await db.select().from(f11HostEventsTable)
    .where(eq(f11HostEventsTable.hostRunId, run.id))
    .orderBy(f11HostEventsTable.createdAt);
  res.json({ ...run, events });
});

router.post("/f11/host-runs", requireAuth, async (req, res): Promise<void> => {
  const parsed = stageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const input = parsed.data;
  if (!(await ownedSession(req.localUser!.id, input.sessionId))) {
    res.status(404).json({ error: "Session not found" }); return;
  }
  if (input.source !== "F8_BUNDLE") {
    res.status(409).json({
      error: "F11 accepts only an F8 code-bundle source",
      code: input.source === "CHAT_ONLY" ? "CHAT_ONLY_UNWIRED" : "F10_HANDOFF_UNWIRED",
    });
    return;
  }
  const [plan, source] = await Promise.all([
    db.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.id, input.planArtifactId),
      eq(harnessArtifactsTable.userId, req.localUser!.id),
      eq(harnessArtifactsTable.sessionId, input.sessionId),
      eq(harnessArtifactsTable.artifactType, "HOSTING_PLAN"),
    )).limit(1),
    db.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.id, input.sourceArtifactId),
      eq(harnessArtifactsTable.userId, req.localUser!.id),
      eq(harnessArtifactsTable.sessionId, input.sessionId),
      eq(harnessArtifactsTable.artifactType, "CODEBASE_BUNDLE"),
    )).limit(1),
  ]);
  if (!plan[0] || !source[0]) { res.status(404).json({ error: "F11 plan or F8 code bundle not found in this session" }); return; }
  const planContent = isRecord(plan[0].artifactContent) ? plan[0].artifactContent : {};
  if (planContent.sourceCodebaseBundleArtifactId !== input.sourceArtifactId) {
    res.status(409).json({ error: "F8 code bundle is not the bundle used to create this hosting plan", code: "SOURCE_LINEAGE_MISMATCH" });
    return;
  }
  const exactContentHash = sha256({ plan: plan[0].artifactContent, source: source[0].artifactContent });
  if (input.exactContentHash !== exactContentHash) {
    res.status(409).json({ error: "Exact source content hash does not match the server-loaded F8 bundle", code: "CONTENT_HASH_MISMATCH" });
    return;
  }
  const hrp = isRecord(planContent.hrp) ? planContent.hrp : {};
  const primary = isRecord(planContent.primary) ? planContent.primary : {};
  if (primary.platform !== input.provider || (Array.isArray(hrp.regions) && hrp.regions.length > 0 && !hrp.regions.includes(input.region))) {
    res.status(409).json({ error: "Provider or region is not the server-selected H3 plan", code: "PLAN_SCOPE_MISMATCH" });
    return;
  }
  const adapter = getF11ProviderAdapter(input.provider);
  const readiness = checkF11ProviderAdapter(adapter);
  if (!adapter || !readiness.qualified) {
    res.status(503).json({ error: "Provider adapter is not qualified for F11 execution", code: "F11_ADAPTER_UNQUALIFIED", checks: readiness.checks });
    return;
  }
  const qualifiedAdapter = adapter;
  const write = {
    source: input.source,
    planArtifactId: input.planArtifactId,
    sourceArtifactId: input.sourceArtifactId,
    provider: input.provider,
    accountRef: input.accountRef,
    region: input.region,
    exactContentHash,
    costCeilingCents: input.costCeilingCents,
    deploymentSubject: input.deploymentSubject,
    rollbackPlan: input.rollbackPlan,
  };
  if (input.consent.purpose !== "STAGE" || input.consent.deploymentSubject !== input.deploymentSubject ||
      input.consent.exactWriteHash !== f11StageWriteHash(write)) {
    res.status(409).json({ error: "Stage consent is not bound to this exact content, account, region, and cost ceiling", code: "STAGE_CONSENT_MISMATCH" });
    return;
  }
  const vault = validateF11VaultHandle(input.vaultHandle, "F11_STAGE", input.deploymentSubject);
  if (!vault.ok) { res.status(409).json({ error: vault.reason, code: "STAGE_VAULT_INVALID" }); return; }
  const attestations = validateF11HumanAttestations(input.humanAttestations);
  if (!attestations.ok) { res.status(409).json({ error: attestations.reason, code: "HUMAN_ATTESTATIONS_INVALID" }); return; }
  const [run] = await db.insert(f11HostRunsTable).values({
    tenantId: req.localUser!.id,
    sessionId: input.sessionId,
    planArtifactId: input.planArtifactId,
    sourceArtifactId: input.sourceArtifactId,
    source: input.source,
    provider: input.provider,
    adapterId: qualifiedAdapter.adapterId,
    adapterVersion: qualifiedAdapter.adapterVersion,
    accountRef: input.accountRef,
    region: input.region,
    exactContentHash,
    deploymentSubject: input.deploymentSubject,
    costCeilingCents: input.costCeilingCents,
    stageConsentId: input.consent.consentId,
    stageWriteHash: input.consent.exactWriteHash,
    stageVaultRef: vault.fingerprint,
    rollbackPlan: input.rollbackPlan,
    humanAttestations: input.humanAttestations,
    state: "H4_STAGED",
    providerOperationRef: `f11-stage-${randomUUID()}`,
    stageEvidence: { adapterId: qualifiedAdapter.adapterId, adapterVersion: qualifiedAdapter.adapterVersion, acceptedAt: new Date().toISOString() },
  }).returning();
  await db.insert(f11HostEventsTable).values({
    hostRunId: run!.id, tenantId: req.localUser!.id, fromState: "H4_STAGE_REQUESTED", toState: "H4_STAGED",
    eventType: "STAGE_ACCEPTED", evidence: { exactContentHash, accountRef: input.accountRef, region: input.region, costCeilingCents: input.costCeilingCents },
    actorId: req.localUser!.id,
  });
  res.status(201).json(run);
});

router.post("/f11/host-runs/:id/verify", requireAuth, async (req, res): Promise<void> => {
  const parsed = verifyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const run = await ownedRun(req.localUser!.id, id);
  if (!run) { res.status(404).json({ error: "F11 host run not found" }); return; }
  if (run.state !== "H4_STAGED") { res.status(409).json({ error: "H5 requires a staged H4 runtime", code: "INVALID_H5_STATE" }); return; }
  const updated = await transition(run, "H5_VERIFIED", "STAGE_VERIFIED", { ...parsed.data, verifiedAt: new Date().toISOString() }, req.localUser!.id);
  if (!updated) { res.status(409).json({ error: "F11 run changed; reload before retrying" }); return; }
  await db.update(f11HostRunsTable).set({ stageEvidence: { ...(isRecord(run.stageEvidence) ? run.stageEvidence : {}), ...parsed.data, verifiedAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(f11HostRunsTable.id, run.id));
  res.json(await ownedRun(req.localUser!.id, run.id));
});

router.post("/f11/host-runs/:id/certify", requireAuth, async (req, res): Promise<void> => {
  const parsed = certifyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const run = await ownedRun(req.localUser!.id, id);
  if (!run) { res.status(404).json({ error: "F11 host run not found" }); return; }
  if (run.state !== "H5_VERIFIED" || !run.stageEvidence) { res.status(409).json({ error: "H6 requires recorded health, smoke, and rollback evidence", code: "INVALID_H6_STATE" }); return; }
  let evidence;
  try {
    evidence = buildUcgHostEvidence({ hostRunId: run.id, exactContentHash: run.exactContentHash, stageEvidence: run.stageEvidence, ...parsed.data });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Invalid UCG-HOST identities", code: "UCG_HOST_IDENTITIES_INVALID" }); return;
  }
  const updated = await transition(run, "H6_CERTIFIED", "UCG_HOST_CERTIFIED", evidence, req.localUser!.id);
  if (!updated) { res.status(409).json({ error: "F11 run changed; reload before retrying" }); return; }
  await db.update(f11HostRunsTable).set({ ucgHostEvidence: evidence, updatedAt: new Date() }).where(eq(f11HostRunsTable.id, run.id));
  res.json(await ownedRun(req.localUser!.id, run.id));
});

router.post("/f11/host-runs/:id/promote", requireAuth, async (req, res): Promise<void> => {
  const parsed = promoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const run = await ownedRun(req.localUser!.id, id);
  if (!run) { res.status(404).json({ error: "F11 host run not found" }); return; }
  if (run.state !== "H6_CERTIFIED" || !run.ucgHostEvidence) { res.status(409).json({ error: "H7 requires a valid server-owned UCG-HOST certificate", code: "INVALID_H7_STATE" }); return; }
  const adapter = getF11ProviderAdapter(run.provider);
  if (!checkF11ProviderAdapter(adapter).qualified) { res.status(503).json({ error: "Provider adapter is no longer qualified; promotion fails closed", code: "F11_ADAPTER_UNQUALIFIED" }); return; }
  const writeHash = f11PromotionWriteHash({ hostRunId: run.id, exactContentHash: run.exactContentHash, provider: run.provider, accountRef: run.accountRef, region: run.region, deploymentSubject: parsed.data.promotionSubject });
  if (parsed.data.consent.purpose !== "PROMOTION" || parsed.data.consent.deploymentSubject !== parsed.data.promotionSubject || parsed.data.consent.exactWriteHash !== writeHash) {
    res.status(409).json({ error: "Promotion consent is not bound to this exact production write", code: "PROMOTION_CONSENT_MISMATCH" }); return;
  }
  const vault = validateF11VaultHandle(parsed.data.vaultHandle, "F11_PROMOTION", parsed.data.promotionSubject);
  if (!vault.ok) { res.status(409).json({ error: vault.reason, code: "PROMOTION_VAULT_INVALID" }); return; }
  const updated = await transition(run, "H7_PROMOTED", "PRODUCTION_PROMOTED", { promotionSubject: parsed.data.promotionSubject, writeHash }, req.localUser!.id);
  if (!updated) { res.status(409).json({ error: "F11 run changed; reload before retrying" }); return; }
  await db.update(f11HostRunsTable).set({ promotionConsentId: parsed.data.consent.consentId, promotionWriteHash: writeHash, promotionVaultRef: vault.fingerprint, promotionSubject: parsed.data.promotionSubject, updatedAt: new Date() }).where(eq(f11HostRunsTable.id, run.id));
  res.json(await ownedRun(req.localUser!.id, run.id));
});

router.post("/f11/host-runs/:id/hand-off", requireAuth, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const run = await ownedRun(req.localUser!.id, id);
  if (!run) { res.status(404).json({ error: "F11 host run not found" }); return; }
  if (run.state !== "H7_PROMOTED" || !run.ucgHostEvidence || !run.promotionWriteHash) { res.status(409).json({ error: "H8 requires H6 certification and separately consented H7 promotion", code: "INVALID_H8_STATE" }); return; }
  const adapter = getF11ProviderAdapter(run.provider);
  if (!checkF11ProviderAdapter(adapter).qualified) { res.status(503).json({ error: "Provider adapter is no longer qualified; handoff fails closed", code: "F11_ADAPTER_UNQUALIFIED" }); return; }
  const monitoringRef = `F9.5-HOST-${run.id}`;
  const receipt = {
    receiptType: "F9.5_HOST_RECEIPT",
    hostRunId: run.id,
    sourceArtifactId: run.sourceArtifactId,
    exactContentHash: run.exactContentHash,
    provider: run.provider,
    providerOperationRef: run.providerOperationRef,
    deploymentSubject: run.promotionSubject,
    monitoringRef,
    ucgHostCertificateRef: isRecord(run.ucgHostEvidence) ? run.ucgHostEvidence.certificateRef : null,
    issuedAt: new Date().toISOString(),
  };
  const signedReceipt = { ...receipt, receiptSignature: signHostReceipt(receipt, process.env.SESSION_SECRET ?? "") };
  const updated = await transition(run, "H8_HANDED_OFF", "F95_MONITORING_REGISTERED", signedReceipt, req.localUser!.id);
  if (!updated) { res.status(409).json({ error: "F11 run changed; reload before retrying" }); return; }
  await db.update(f11HostRunsTable).set({ monitoringRef, hostReceipt: signedReceipt, updatedAt: new Date() }).where(eq(f11HostRunsTable.id, run.id));
  res.json({ hostRun: await ownedRun(req.localUser!.id, run.id), hostReceipt: signedReceipt, handoffTarget: "F10" });
});

export default router;