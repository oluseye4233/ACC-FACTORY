import { Router, type IRouter } from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, f10DestinationsTable, f10ReleaseRequestsTable, f10ReleaseTransitionsTable, f10AttemptsTable, f10ReceiptsTable, f10DlqTable, f9MechaRunsTable, osirisCustodiesTable, harnessArtifactsTable, f10ProviderConnectionsTable, f10BundleDeploymentsTable, f10BundleDeploymentAuditTable, f10BundleDeploymentAttemptsTable, f10BundleDeploymentReceiptsTable, integrationCredentialsTable, f10GitHubPushesTable, f10ColonizationRunsTable, f10ColonizationConsentsTable, f11HostRunsTable } from "@workspace/db";
import { signHostReceipt } from "../lib/f11-host";
import { requireAuth } from "../lib/auth";
import { deterministicIdempotencyKey, retryDelay, validateHttpsDestination, verifyF9Hmac, verifyPrerequisites } from "../lib/f10";
import { createF10Adapters, createF10CustodyProvider, createF10ProductionStore, envSecretProvider } from "../lib/f10-production";
import { F10ReleaseService } from "../lib/f10-service";
import { buildExport, FAMILIES, OUTPUT_KINDS, SOURCE_TYPES, TARGETS, type ExportProfile, type OutputKind, type Family, type OwnedSource } from "../lib/f10-export";
import { assertQueuedBundleHash, authorizationKeyringFromEnv, AuthorizationKeyUnavailableError, targetConfigError, createProviderAdapter, openAuthorizationRef, providerBrokerTransport, sealAuthorizationRef, trustedProviderTargetConfig } from "../lib/f10-provider";
import { reconcileF10BundleDeployment } from "../lib/f10-reconciliation";
import { decryptApiKey } from "../lib/integration-crypto";
import { getGitHubClientFromToken } from "../lib/github";
import { requireTier } from "../lib/tier";
import { COLONIZATION_TARGET_CLASSES, evaluateColonization, evaluatePromotionGate, type ColonizationInput } from "../lib/f10-colonization";

const router: IRouter = Router();
const Body = z.object({
  machineArtifactId: z.string().min(1).max(200),
  destinationId: z.string().uuid(),
  releaseIntent: z.string().min(1).max(200),
  /** Required by the embedded F10 production-line stage; optional for legacy console links. */
  sessionId: z.string().uuid().optional(),
});
const DestinationBody = z.object({
  name: z.string().trim().min(1).max(120),
  adapterId: z.literal("https"),
  adapterVersion: z.literal("1"),
  endpoint: z.string().url(),
  secretRef: z.string().regex(/^F10_SECRET_[A-Z0-9_]+$/u),
  authorizationScopes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});
const ExportBody = z.object({
  sourceArtifactId: z.string().uuid(),
  outputKind: z.enum(OUTPUT_KINDS),
  family: z.enum(FAMILIES),
  target: z.string().trim().min(1).max(120),
  deliveryMode: z.enum(["EXPORT", "INTERNAL_HANDOFF"]).optional(),
});
const GitHubPushBody = ExportBody.extend({
  family: z.literal("GITHUB"),
  repository: z.string()
    .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u, "repository must be in owner/repo form")
    .refine(value => value.split("/").every(segment => segment !== "." && segment !== ".."), "invalid GitHub repository"),
  branch: z.string().trim().min(1).max(255).refine(branch =>
    !branch.startsWith("/") &&
    !branch.endsWith("/") &&
    !branch.includes("..") &&
    !branch.includes("//") &&
    !branch.includes("@{") &&
    !branch.includes("\\") &&
    !branch.endsWith(".lock") &&
    !/[\x00-\x20~^:?*\[]/u.test(branch),
  "invalid Git branch"),
});
const AuthorizeBody = z.object({ provider: z.enum(["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"]), returnTo: z.string().max(500).optional(), connectionId: z.string().uuid().optional() });
const DeploymentBody = z.object({
  sourceArtifactId: z.string().uuid(), provider: z.enum(["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"]),
  target: z.string().min(1).max(80), connectionRef: z.string().uuid(), outputKind: z.enum(OUTPUT_KINDS),
  targetConfig: z.record(z.string(), z.string()).default({}), releaseIntent: z.string().min(1).max(200),
});
const ColonizationBody = z.object({
  requestClass: z.enum(["RUN", "SENSE_ONLY", "RE_VERIFY", "ROLLBACK"]).default("RUN"),
  artifactRef: z.string().trim().min(1).max(500),
  artifactHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  artifactClass: z.enum(["SPC", "MA", "PDD", "MPDD"]),
  ucgCertificateRef: z.string().trim().min(1).max(500),
  target: z.string().trim().min(1).max(500),
  targetClass: z.enum(COLONIZATION_TARGET_CLASSES),
  connectorAdapter: z.string().trim().min(1).max(200),
  customizationSet: z.object({ packaging_fields_only: z.record(z.string(), z.string()).optional() }).optional(),
  f9AttestationRef: z.string().trim().max(500).nullable().optional(),
  consentChannel: z.string().trim().min(1).max(200),
  deploymentSubject: z.string().trim().min(1).max(500).optional(),
  ucgColCertificate: z.object({
    certificateRef: z.string().trim().min(1).max(500),
    artifactHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    deploymentSubject: z.string().trim().min(1).max(500),
    score: z.number().min(0).max(1),
    threshold: z.number().min(0).max(1),
    verdict: z.literal("PASS"),
    expiresAt: z.iso.datetime(),
  }).optional(),
  stageConsent: z.object({
    consentId: z.uuid(), purpose: z.literal("STAGE"), deploymentSubject: z.string().trim().min(1).max(500),
    exactWriteHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  }).optional(),
  promotionConsent: z.object({
    consentId: z.uuid(), purpose: z.literal("PROMOTION"), deploymentSubject: z.string().trim().min(1).max(500),
    exactWriteHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  }).optional(),
  vaultHandle: z.object({
    handle: z.string().regex(/^vault-handle:[A-Za-z0-9_-]{16,200}$/u),
    scope: z.enum(["F10_STAGE", "F10_PROMOTION"]),
    deploymentSubject: z.string().trim().min(1).max(500),
    expiresAt: z.iso.datetime(),
  }).optional(),
});
const PromotionBody = z.object({
  deploymentSubject: z.string().trim().min(1).max(500),
  ucgColCertificate: ColonizationBody.shape.ucgColCertificate.unwrap(),
  promotionConsent: ColonizationBody.shape.promotionConsent.unwrap(),
  vaultHandle: ColonizationBody.shape.vaultHandle.unwrap(),
});

router.get("/f10/colonization-runs", requireAuth, async (req, res): Promise<void> => {
  const runs = await db.select().from(f10ColonizationRunsTable).where(eq(f10ColonizationRunsTable.tenantId, req.localUser!.id)).orderBy(desc(f10ColonizationRunsTable.createdAt));
  res.json(runs);
});

router.get("/f10/colonization-runs/:id", requireAuth, async (req, res): Promise<void> => {
  const [run] = await db.select().from(f10ColonizationRunsTable).where(and(eq(f10ColonizationRunsTable.id, String(req.params.id)), eq(f10ColonizationRunsTable.tenantId, req.localUser!.id))).limit(1);
  if (!run) { res.status(404).json({ error: "Colonization run not found" }); return; }
  res.json(run);
});

router.post("/f10/colonization-runs", requireAuth, async (req, res): Promise<void> => {
  const parsed = ColonizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const raw = parsed.data;
  let f9AttestationRef = raw.f9AttestationRef ?? null;
  let f9AttestationValidated: boolean | undefined;
  if (["FIRMWARE", "ROBOTICS", "APPLIANCE_IOT"].includes(raw.targetClass) && f9AttestationRef) {
    const [attestation] = await db.select().from(f9MechaRunsTable).where(and(
      eq(f9MechaRunsTable.userId, req.localUser!.id),
      eq(f9MechaRunsTable.mechaRunId, f9AttestationRef),
      eq(f9MechaRunsTable.status, "EMITTED"),
      eq(f9MechaRunsTable.osirisCustody, true),
    )).limit(1);
    if (!attestation) {
      f9AttestationValidated = false;
    } else {
      const [custody] = await db.select().from(osirisCustodiesTable).where(and(
        eq(osirisCustodiesTable.machineArtifactId, attestation.id),
        eq(osirisCustodiesTable.ownerUserId, req.localUser!.id),
      )).limit(1);
      const content = attestation.artifactContent;
      const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
      const ucg = isRecord(content) && isRecord(content.ucg_certificate) ? content.ucg_certificate : null;
      const valid = isRecord(content) &&
        typeof attestation.payloadHash === "string" && typeof attestation.artifactSignature === "string" &&
        typeof content.machine_artifact_id === "string" && content.machine_artifact_id === attestation.id &&
        isRecord(ucg) && ["PASS", "THRESHOLD_PASS"].includes(String(ucg.verdict)) &&
        content.mm_verdict === "MATH_VERIFIED" && content.savant_verdict === "FIT" &&
        Boolean(custody && ["active", "recovered"].includes(custody.custodyState) && custody.expiresAt > new Date() &&
          custody.sourceHash === attestation.payloadHash && custody.sourceSignature === attestation.artifactSignature &&
          custody.artifactVersion === attestation.artifactVersion);
      f9AttestationValidated = valid;
    }
  }
  const input: ColonizationInput = { ...raw, f9AttestationRef, f9AttestationValidated };
  const evaluation = evaluateColonization(input);
  const [run] = await db.insert(f10ColonizationRunsTable).values({
    runId: evaluation.runId, tenantId: req.localUser!.id, actorId: req.localUser!.id,
    requestClass: input.requestClass, artifactRef: input.artifactRef, artifactHash: input.artifactHash,
    artifactClass: input.artifactClass, ucgCertificateRef: input.ucgCertificateRef, target: input.target,
    targetClass: input.targetClass, connectorAdapter: input.connectorAdapter,
    customizationSet: input.customizationSet ?? {}, f9AttestationRef: input.f9AttestationRef ?? null,
    consentChannel: input.consentChannel, deploymentSubject: input.deploymentSubject ?? null,
    ucgColCertificate: input.ucgColCertificate ?? null, stageConsent: input.stageConsent ?? null,
    promotionConsent: input.promotionConsent ?? null, vaultHandle: input.vaultHandle ?? null,
    state: "REFUSED", phase: evaluation.phase,
    maxReachablePhase: evaluation.maxReachablePhase, groMode: evaluation.groMode,
    phaseStatuses: evaluation.phaseStatuses, adapterReadiness: evaluation.adapterReadiness, refusal: evaluation.refusal,
    updatedAt: new Date(),
  }).returning();
  res.status(201).json(run);
});

router.post("/f10/colonization-runs/:id/promote", requireAuth, async (req, res): Promise<void> => {
  const parsed = PromotionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [run] = await db.select().from(f10ColonizationRunsTable).where(and(
    eq(f10ColonizationRunsTable.id, String(req.params.id)),
    eq(f10ColonizationRunsTable.tenantId, req.localUser!.id),
  )).limit(1);
  if (!run) { res.status(404).json({ error: "Colonization run not found" }); return; }
  if (run.state !== "STAGED_ONLY") {
    res.status(409).json({ code: "NOT_STAGED", error: "Promotion is unavailable until this exact run has completed staging with consent #1." });
    return;
  }

  const consumed = await db.select({ consentId: f10ColonizationConsentsTable.consentId })
    .from(f10ColonizationConsentsTable)
    .where(eq(f10ColonizationConsentsTable.consentId, parsed.data.promotionConsent.consentId))
    .limit(1);
  const gate = evaluatePromotionGate({
    artifactHash: run.artifactHash,
    deploymentSubject: parsed.data.deploymentSubject,
    certificate: parsed.data.ucgColCertificate,
    // Certificate payloads are assertions, not proof. The server-owned
    // authority adapter must validate one before this gate can open.
    certificateAuthorityAvailable: false,
    consent: parsed.data.promotionConsent,
    consumedConsentIds: new Set(consumed.map(row => row.consentId)),
    // No Vault adapter exists yet. A caller-provided handle can never assert
    // availability by itself; the server must obtain readiness from Vault.
    vaultAvailable: false,
    vaultHandle: parsed.data.vaultHandle,
  });
  if (!gate.ok) { res.status(409).json({ code: gate.code, error: gate.reason }); return; }

  // This transaction is intentionally unreachable until the server-owned
  // Vault adapter supplies readiness. The unique consent fence remains the
  // final concurrent-replay defense when that adapter is connected.
  try {
    const promoted = await db.transaction(async tx => {
      await tx.insert(f10ColonizationConsentsTable).values({
        consentId: parsed.data.promotionConsent.consentId,
        runId: run.id,
        tenantId: req.localUser!.id,
        purpose: "PROMOTION",
        deploymentSubject: parsed.data.deploymentSubject,
        exactWriteHash: parsed.data.promotionConsent.exactWriteHash,
      });
      const [updated] = await tx.update(f10ColonizationRunsTable).set({
        state: "PROMOTED", phase: "C8", promotionConsent: parsed.data.promotionConsent,
        ucgColCertificate: parsed.data.ucgColCertificate, vaultHandle: parsed.data.vaultHandle,
        updatedAt: new Date(),
      }).where(and(eq(f10ColonizationRunsTable.id, run.id), eq(f10ColonizationRunsTable.state, "STAGED_ONLY"))).returning();
      if (!updated) throw new Error("promotion state changed");
      return updated;
    });
    res.json(promoted);
  } catch {
    res.status(409).json({ code: "CONSENT_REPLAY", error: "Promotion consent has already been consumed or the run is no longer staged." });
  }
});

router.get("/f10/catalog", requireAuth, (_req, res): void => {
  let providerEncryptionConfigured = true;
  try { authorizationKeyringFromEnv(); } catch { providerEncryptionConfigured = false; }
  const providerBrokerConfigured = Boolean(process.env.F10_PROVIDER_BROKER_URL && process.env.F10_PROVIDER_BROKER_TOKEN && providerEncryptionConfigured);
  res.json({
    sourceTypes: SOURCE_TYPES,
    outputKinds: OUTPUT_KINDS,
    families: FAMILIES.map(family => ({
      family,
       liveMode: ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS", "GITHUB"].includes(family) ? "USER_AUTHORIZED" : family === "F0" || family === "SPC_PLAYER" ? "INTERNAL_HANDOFF" : "EXPORT",
       fallbackMode: ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS", "GITHUB"].includes(family) ? "EXPORT" : null,
       deployed: ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"].includes(family) && providerBrokerConfigured,
       configuration: ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS", "GITHUB"].includes(family) ? "requires authorization through the user's own provider account; credential values are never requested or returned" : "deterministic file export only",
       targets: family === "AWS" ? TARGETS.AWS : family === "AZURE" ? TARGETS.AZURE : family === "OPENAI_AGENTS" ? TARGETS.OPENAI_AGENTS : family === "GEMINI_AGENTS" ? TARGETS.GEMINI_AGENTS : family === "IDE" ? TARGETS.IDE : family === "VIBE_APP" ? TARGETS.VIBE_APP : family === "PROGRAMMING_ENVIRONMENT" ? TARGETS.PROGRAMMING_ENVIRONMENT : [family],
      supportedOutputs: family === "PROGRAMMING_ENVIRONMENT" ? ["CODE_DJ"] : OUTPUT_KINDS,
    })),
    httpsRelease: { separate: true, live: true, mode: "SIGNED_F9_OSIRIS_HTTPS" },
  });
});

router.get("/f10/sources", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select({ id: harnessArtifactsTable.id, type: harnessArtifactsTable.artifactType, name: harnessArtifactsTable.name, createdAt: harnessArtifactsTable.createdAt })
    .from(harnessArtifactsTable).where(eq(harnessArtifactsTable.userId, req.localUser!.id));
  const kind = (type: string) => type === "SPC" ? "SPC" : type === "MA_BIRTH_PACKAGE" ? "MA" : type === "MICRO_PDD" ? "MPDD" : ["ATLAS_PDD", "ATLAS_PDD_JSON", "MVP_PDD"].includes(type) ? "PDD" : "CODE_DJ";
  res.json(rows.filter(row => (SOURCE_TYPES as readonly string[]).includes(row.type)).map(row => ({ ...row, artifactType: row.type, outputKind: kind(row.type) })));
});

async function resolveExportSource(userId: string, id: string): Promise<OwnedSource | null> {
  const [row] = await db.select().from(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.id, id), eq(harnessArtifactsTable.userId, userId))).limit(1);
  if (!row || !(SOURCE_TYPES as readonly string[]).includes(row.artifactType)) return null;
  return { id: row.id, type: row.artifactType as OwnedSource["type"], name: row.name, content: row.artifactContent, createdAt: row.createdAt };
}
async function makeExport(userId: string, body: unknown) {
  const parsed = ExportBody.safeParse(body);
  if (!parsed.success) throw new Error("invalid export request");
  const source = await resolveExportSource(userId, parsed.data.sourceArtifactId);
  if (!source) throw new Error("source artifact not found");
  return buildExport(source, parsed.data as ExportProfile);
}
router.post("/f10/exports/manifest", requireAuth, async (req, res): Promise<void> => {
  try { const result = await makeExport(req.localUser!.id, req.body); res.json(result.manifest); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "export failed" }); }
});
router.post("/f10/exports/download", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await makeExport(req.localUser!.id, req.body);
    const sourceId = String((req.body as Record<string, unknown>)?.sourceArtifactId ?? "source");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="f10-${sourceId}.zip"`);
    res.setHeader("Content-Length", result.bundle.length);
    res.send(result.bundle);
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "export failed" }); }
});
router.post("/f10/exports/github", requireAuth, requireTier("ARCHITECT"), async (req, res): Promise<void> => {
  const parsed = GitHubPushBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const userId = req.localUser!.id;
  const source = await resolveExportSource(userId, parsed.data.sourceArtifactId);
  if (!source) { res.status(404).json({ error: "Source artifact not found" }); return; }

  const sourceContent = (source.content ?? {}) as Record<string, unknown>;
  const { f10GitHubPushes: _storedPushes, ...exportableContent } = sourceContent;
  let exported;
  try { exported = buildExport({ ...source, content: exportableContent }, parsed.data); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "export failed" }); return; }

  const idempotencyKey = `${exported.manifest.bundleSha256}:${parsed.data.repository}:${parsed.data.branch}`;
  const [insertedClaim] = await db.insert(f10GitHubPushesTable).values({
    userId, sourceArtifactId: source.id, idempotencyKey,
  }).onConflictDoNothing({
    target: [f10GitHubPushesTable.userId, f10GitHubPushesTable.idempotencyKey],
  }).returning();
  let claim = insertedClaim;
  if (!claim) {
    const [existingClaim] = await db.select().from(f10GitHubPushesTable).where(and(
      eq(f10GitHubPushesTable.userId, userId),
      eq(f10GitHubPushesTable.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (existingClaim?.status === "COMPLETED" && existingClaim.result) {
      res.json({ ...(existingClaim.result as Record<string, unknown>), idempotent: true });
      return;
    }
    if (existingClaim?.status === "FAILED") {
      const [reclaimed] = await db.update(f10GitHubPushesTable).set({
        status: "IN_PROGRESS", errorCode: null, updatedAt: new Date(),
      }).where(and(
        eq(f10GitHubPushesTable.id, existingClaim.id),
        eq(f10GitHubPushesTable.status, "FAILED"),
      )).returning();
      claim = reclaimed;
    }
    if (!claim) {
      res.status(409).json({ error: "This F10 handoff is already being pushed. Wait a moment, then retry.", code: "GITHUB_PUSH_IN_PROGRESS" });
      return;
    }
  }

  const [credential] = await db.select().from(integrationCredentialsTable).where(and(
    eq(integrationCredentialsTable.userId, userId),
    eq(integrationCredentialsTable.provider, "github"),
  )).limit(1);
  if (!credential) {
    await db.update(f10GitHubPushesTable).set({ status: "FAILED", errorCode: "GITHUB_NOT_CONNECTED", updatedAt: new Date() }).where(eq(f10GitHubPushesTable.id, claim.id));
    res.status(503).json({ error: "GitHub is not connected. Connect GitHub, then retry.", code: "GITHUB_NOT_CONNECTED" });
    return;
  }

  const [owner, repo] = parsed.data.repository.split("/");
  try {
    const gh = getGitHubClientFromToken(decryptApiKey(credential.keyEncrypted));
    const repoInfo = await gh.rest.repos.get({ owner: owner!, repo: repo! });
    if (repoInfo.data.permissions?.push !== true) {
      await db.update(f10GitHubPushesTable).set({ status: "FAILED", errorCode: "GITHUB_REPO_NOT_AUTHORIZED", updatedAt: new Date() }).where(eq(f10GitHubPushesTable.id, claim.id));
      res.status(403).json({ error: `Your GitHub connection cannot push to "${parsed.data.repository}". Grant Contents: Read and write, then retry.`, code: "GITHUB_REPO_NOT_AUTHORIZED" });
      return;
    }
    let headSha: string;
    try {
      const ref = await gh.rest.git.getRef({ owner: owner!, repo: repo!, ref: `heads/${parsed.data.branch}` });
      headSha = ref.data.object.sha;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        await db.update(f10GitHubPushesTable).set({ status: "FAILED", errorCode: "GITHUB_BRANCH_NOT_FOUND", updatedAt: new Date() }).where(eq(f10GitHubPushesTable.id, claim.id));
        res.status(404).json({ error: `Branch "${parsed.data.branch}" was not found in "${parsed.data.repository}".`, code: "GITHUB_BRANCH_NOT_FOUND" });
        return;
      }
      throw error;
    }
    const headCommit = await gh.rest.git.getCommit({ owner: owner!, repo: repo!, commit_sha: headSha });
    const tree = await gh.rest.git.createTree({
      owner: owner!, repo: repo!,
      base_tree: headCommit.data.tree.sha,
      tree: exported.files.map(file => ({ path: file.path, mode: "100644" as const, type: "blob" as const, content: file.content.toString("utf8") })),
    });
    const commit = await gh.rest.git.createCommit({
      owner: owner!, repo: repo!, message: `F10 ${parsed.data.outputKind} handoff`, tree: tree.data.sha, parents: [headSha],
    });
    await gh.rest.git.updateRef({ owner: owner!, repo: repo!, ref: `heads/${parsed.data.branch}`, sha: commit.data.sha });
    const result = {
      ok: true, idempotent: false, idempotencyKey, repository: repoInfo.data.full_name,
      branch: parsed.data.branch, commitSha: commit.data.sha,
      commitUrl: `${repoInfo.data.html_url}/commit/${commit.data.sha}`,
      bundleSha256: exported.manifest.bundleSha256, pushedAt: new Date().toISOString(),
    };
    await db.update(f10GitHubPushesTable).set({
      status: "COMPLETED", result, errorCode: null, updatedAt: new Date(),
    }).where(eq(f10GitHubPushesTable.id, claim.id));
    await db.update(integrationCredentialsTable).set({ lastUsedAt: sql`now()` }).where(eq(integrationCredentialsTable.id, credential.id));
    res.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const code = status === 401 ? "GITHUB_BAD_TOKEN" : status === 403 ? "GITHUB_REPO_NOT_AUTHORIZED" : status === 404 ? "GITHUB_REPO_NOT_FOUND" : "GITHUB_PUSH_FAILED";
    await db.update(f10GitHubPushesTable).set({ status: "FAILED", errorCode: code, updatedAt: new Date() }).where(eq(f10GitHubPushesTable.id, claim.id));
    if (status === 401) { res.status(401).json({ error: "Your GitHub authorization is no longer valid. Reconnect GitHub, then retry.", code }); return; }
    if (status === 403) { res.status(403).json({ error: `Your GitHub connection cannot push to "${parsed.data.repository}". Grant Contents: Read and write, then retry.`, code }); return; }
    if (status === 404) { res.status(404).json({ error: `Repository "${parsed.data.repository}" was not found or is not visible to your GitHub connection.`, code }); return; }
    req.log.warn({ err: error }, "F10 GitHub push failed");
    res.status(502).json({ error: "GitHub could not accept the F10 handoff. Retry or download the bundle.", code: "GITHUB_PUSH_FAILED" });
  }
});

router.get("/f10/destinations", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(f10DestinationsTable)
    .where(eq(f10DestinationsTable.tenantId, req.localUser!.id))
    .orderBy(desc(f10DestinationsTable.createdAt));
  res.json(rows.map(({ secretRef: _secretRef, ...safe }) => safe));
});

// Native provider lane. Authorization references are opaque and are never
// resolved or returned as credential values.
router.get("/f10/connections", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(f10ProviderConnectionsTable).where(eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id)).orderBy(desc(f10ProviderConnectionsTable.createdAt));
  res.json(rows.map(({ authorizationRef: _ref, ...safe }) => safe));
});
router.post("/f10/connections/authorize", requireAuth, async (req, res): Promise<void> => {
  const parsed = AuthorizeBody.safeParse(req.body);
  const broker = process.env.F10_PROVIDER_BROKER_URL;
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let keyring;
  try { keyring = authorizationKeyringFromEnv(); } catch { res.status(409).json({ configured: false, fallback: "EXPORT", error: "provider authorization encryption is not configured" }); return; }
  if (!broker || !process.env.F10_PROVIDER_BROKER_TOKEN) { res.status(409).json({ configured: false, fallback: "EXPORT", error: "provider authorization flow is not configured" }); return; }
  if (parsed.data.connectionId) {
    const [existing] = await db.select({ id: f10ProviderConnectionsTable.id })
      .from(f10ProviderConnectionsTable)
      .where(and(
        eq(f10ProviderConnectionsTable.id, parsed.data.connectionId),
        eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id),
        eq(f10ProviderConnectionsTable.provider, parsed.data.provider),
      ))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Provider connection not found" }); return; }
  }
  const requestedReturnTo = parsed.data.returnTo ?? "/f10";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/f10";
  const payload = Buffer.from(JSON.stringify({ userId: req.localUser!.id, provider: parsed.data.provider, connectionId: parsed.data.connectionId, nonce: randomUUID(), exp: Date.now() + 5 * 60_000, returnTo })).toString("base64url");
  const sig = createHmac("sha256", process.env.SESSION_SECRET ?? "").update(payload).digest("base64url");
  const callbackUrl = new URL("/api/f10/connections/callback", `${req.protocol}://${req.get("host")}`).toString();
  const authorize = new URL("/v1/authorize", broker);
  authorize.searchParams.set("provider", parsed.data.provider);
  authorize.searchParams.set("state", `${payload}.${sig}`);
  authorize.searchParams.set("redirect_uri", callbackUrl);
  res.json({ configured: true, provider: parsed.data.provider, authorizeUrl: authorize.toString() });
});
router.get("/f10/connections/callback", async (req, res): Promise<void> => {
  const raw = String(req.query.state ?? ""); const [payload, signature] = raw.split(".");
  if (!payload || !signature || !process.env.SESSION_SECRET) { res.status(400).send("Invalid authorization state"); return; }
  const expected = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) { res.status(400).send("Invalid authorization state"); return; }
  let state: { userId: string; provider: "AWS"|"AZURE"|"OPENAI_AGENTS"|"GEMINI_AGENTS"; connectionId?: string; exp: number; returnTo: string };
  try { state = JSON.parse(Buffer.from(payload, "base64url").toString()) as typeof state; } catch { res.status(400).send("Invalid authorization state"); return; }
  if (state.exp < Date.now() || String(req.query.code ?? "").length < 1) { res.status(400).send("Authorization state expired"); return; }
  const code = String(req.query.code);
  const broker = process.env.F10_PROVIDER_BROKER_URL; const token = process.env.F10_PROVIDER_BROKER_TOKEN;
  if (!broker || !token) { res.status(503).send("Provider authorization flow is not configured"); return; }
  const exchange = await fetch(new URL("/v1/authorize/exchange", broker), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ provider: state.provider, code }),
  });
  if (!exchange.ok) { res.status(502).send("Provider authorization exchange failed"); return; }
  const granted = await exchange.json() as { authorization_ref?: string; account_name?: string; scopes?: string[] };
  if (!granted.authorization_ref) { res.status(502).send("Provider authorization exchange returned no reference"); return; }
  let keyring;
  try { keyring = authorizationKeyringFromEnv(); } catch { res.status(503).send("Provider authorization encryption is not configured"); return; }
  const authorizationRef = sealAuthorizationRef(granted.authorization_ref, keyring);
  const name = `${(granted.account_name || `${state.provider} account`).slice(0, 90)} ${randomUUID().slice(0, 8)}`;
  const row = await db.transaction(async tx => {
    if (!state.connectionId) {
      const [created] = await tx.insert(f10ProviderConnectionsTable).values({ tenantId: state.userId, provider: state.provider, name, authorizationRef, authorizationKeyVersion: keyring.current.version, scopes: granted.scopes ?? [] }).returning();
      return created!;
    }
    const [reconnected] = await tx.update(f10ProviderConnectionsTable).set({
      name,
      authorizationRef,
      authorizationKeyVersion: keyring.current.version,
      scopes: granted.scopes ?? [],
      active: true,
      revokedAt: null,
      reconnectRequiredAt: null,
      reconnectReason: null,
    }).where(and(
      eq(f10ProviderConnectionsTable.id, state.connectionId),
      eq(f10ProviderConnectionsTable.tenantId, state.userId),
      eq(f10ProviderConnectionsTable.provider, state.provider),
    )).returning();
    if (!reconnected) throw Object.assign(new Error("Provider connection not found"), { status: 404 });
    const resumed = await tx.update(f10BundleDeploymentsTable).set({
      connectionRef: reconnected.id,
      reconciliationPausedAt: null,
      reconciliationPauseReason: null,
      reconciliationPauseNotifiedAt: null,
      reconciliationPauseNotificationClaimedAt: null,
      reconciliationPauseNotificationRequired: false,
      executionCheckedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(f10BundleDeploymentsTable.tenantId, state.userId),
      eq(f10BundleDeploymentsTable.connectionRef, reconnected.id),
      isNotNull(f10BundleDeploymentsTable.reconciliationPausedAt),
      eq(f10BundleDeploymentsTable.reconciliationPauseNotificationRequired, true),
    )).returning({ id: f10BundleDeploymentsTable.id });
    if (resumed.length > 0) {
      await tx.insert(f10BundleDeploymentAuditTable).values(resumed.map(deployment => ({
        deploymentId: deployment.id,
        actorId: state.userId,
        fromState: "RECONCILIATION_PAUSED",
        toState: "RECONCILIATION_RESUMED",
        reason: `${state.provider} provider connection reauthorized; automatic status checks resumed`,
      })));
    }
    return reconnected;
  });
  res.redirect(`${state.returnTo}?f10_connected=${row!.id}`);
});
router.post("/f10/connections/:id/revoke", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db.update(f10ProviderConnectionsTable).set({ active: false, revokedAt: new Date() }).where(and(eq(f10ProviderConnectionsTable.id, String(req.params.id)), eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id), eq(f10ProviderConnectionsTable.active, true))).returning();
  if (!row) { res.status(404).json({ error: "Connection not found or already revoked" }); return; }
  const { authorizationRef: _ref, ...safe } = row; res.json(safe);
});
router.get("/f10/deployments", requireAuth, async (req, res): Promise<void> => {
  res.json(await db.select().from(f10BundleDeploymentsTable).where(eq(f10BundleDeploymentsTable.tenantId, req.localUser!.id)).orderBy(desc(f10BundleDeploymentsTable.createdAt)));
});
router.post("/f10/deployments", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeploymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const p = parsed.data;
  let config: Parameters<typeof targetConfigError>[0];
  try { config = trustedProviderTargetConfig(p.provider, p.target, p.targetConfig); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "invalid target configuration" }); return; }
  const configError = targetConfigError(config);
  if (configError) { res.status(400).json({ error: configError }); return; }
  const source = await resolveExportSource(req.localUser!.id, p.sourceArtifactId);
  const [connection] = await db.select().from(f10ProviderConnectionsTable).where(and(eq(f10ProviderConnectionsTable.id, p.connectionRef), eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id))).limit(1);
  if (!source) { res.status(404).json({ error: "source artifact not found" }); return; }
  const profile = { outputKind: p.outputKind, family: p.provider, target: p.target, deliveryMode: "EXPORT" as const };
  const exportResult = buildExport(source, profile);
  if (connection && connection.provider !== p.provider) { res.status(400).json({ error: "connection provider does not match deployment provider" }); return; }
  const { provider: _provider, target: _target, ...destinationConfig } = config;
  const canonicalConfig = JSON.stringify(Object.fromEntries(Object.entries(config).sort(([a], [b]) => a.localeCompare(b))));
  const idem = deterministicIdempotencyKey(String(exportResult.manifest.bundleSha256), p.connectionRef, `${p.releaseIntent}:${canonicalConfig}`);
  const [existing] = await db.select().from(f10BundleDeploymentsTable).where(and(eq(f10BundleDeploymentsTable.tenantId, req.localUser!.id), eq(f10BundleDeploymentsTable.idempotencyKey, idem))).limit(1);
  if (existing) { res.json(existing); return; }
  if (!connection?.active) {
    res.status(200).json({ mode: "EXPORT", deployment: false, reason: "provider connection is unconfigured or revoked", manifest: exportResult.manifest });
    return;
  }
  const [deployment] = await db.insert(f10BundleDeploymentsTable).values({ tenantId: req.localUser!.id, actorId: req.localUser!.id, sourceArtifactId: p.sourceArtifactId, provider: p.provider, target: p.target, connectionRef: p.connectionRef, outputKind: p.outputKind, bundleHash: String(exportResult.manifest.bundleSha256), idempotencyKey: idem, policySnapshot: { schemaVersion: "f10-native-v1", targetConfig: destinationConfig, authorization: "USER_OWNED_REFERENCE" }, state: "QUEUED" }).returning();
  await db.insert(f10BundleDeploymentAuditTable).values({ deploymentId: deployment!.id, actorId: req.localUser!.id, fromState: "REQUESTED", toState: "QUEUED", reason: "bundle generated and provider connection authorized" });
  res.status(201).json({ ...deployment, acceptance: "PENDING_PROVIDER_ACCEPTANCE", execution: "NOT_CONFIRMED" });
});
router.get("/f10/deployments/:id", requireAuth, async (req, res): Promise<void> => {
  const [deployment] = await db.select().from(f10BundleDeploymentsTable).where(and(eq(f10BundleDeploymentsTable.id, String(req.params.id)), eq(f10BundleDeploymentsTable.tenantId, req.localUser!.id))).limit(1);
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  const [audit, attempts, receipts] = await Promise.all([
    db.select().from(f10BundleDeploymentAuditTable).where(eq(f10BundleDeploymentAuditTable.deploymentId, deployment.id)).orderBy(desc(f10BundleDeploymentAuditTable.createdAt)),
    db.select().from(f10BundleDeploymentAttemptsTable).where(eq(f10BundleDeploymentAttemptsTable.deploymentId, deployment.id)).orderBy(desc(f10BundleDeploymentAttemptsTable.attempt)),
    db.select().from(f10BundleDeploymentReceiptsTable).where(eq(f10BundleDeploymentReceiptsTable.deploymentId, deployment.id)).limit(1),
  ]);
  res.json({ ...deployment, audit, attempts, receipt: receipts[0]?.payload ?? null });
});
router.post("/f10/deployments/:id/process", requireAuth, async (req, res): Promise<void> => {
  const [deployment] = await db.select().from(f10BundleDeploymentsTable).where(and(eq(f10BundleDeploymentsTable.id, String(req.params.id)), eq(f10BundleDeploymentsTable.tenantId, req.localUser!.id))).limit(1);
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  if (deployment.state !== "QUEUED") { res.status(409).json({ state: deployment.state, execution: "NOT_CONFIRMED" }); return; }
  const [previousAttempt] = await db.select({ nextAttemptAt: f10BundleDeploymentAttemptsTable.nextAttemptAt }).from(f10BundleDeploymentAttemptsTable).where(eq(f10BundleDeploymentAttemptsTable.deploymentId, deployment.id)).orderBy(desc(f10BundleDeploymentAttemptsTable.attempt)).limit(1);
  if (previousAttempt?.nextAttemptAt && previousAttempt.nextAttemptAt > new Date()) { res.status(409).json({ state: "QUEUED", retryAt: previousAttempt.nextAttemptAt }); return; }
  const [connection] = await db.select().from(f10ProviderConnectionsTable).where(and(eq(f10ProviderConnectionsTable.id, deployment.connectionRef), eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id))).limit(1);
  if (!connection?.active || connection.provider !== deployment.provider) { res.status(409).json({ id: deployment.id, state: "BLOCKED", execution: "NOT_CONFIRMED", acceptance: "NOT_SUBMITTED", fallback: "EXPORT" }); return; }
  const source = await resolveExportSource(req.localUser!.id, String(deployment.sourceArtifactId));
  if (!source) { res.status(409).json({ error: "source artifact unavailable", execution: "NOT_CONFIRMED" }); return; }
  const exportResult = buildExport(source, { outputKind: deployment.outputKind as OutputKind, family: deployment.provider as Family, target: deployment.target, deliveryMode: "EXPORT" });
  try { assertQueuedBundleHash(exportResult, deployment.bundleHash); }
  catch (error) {
    await db.transaction(async tx => {
      const [blocked] = await tx.update(f10BundleDeploymentsTable).set({ state: "BLOCKED", updatedAt: new Date() }).where(and(eq(f10BundleDeploymentsTable.id, deployment.id), eq(f10BundleDeploymentsTable.state, "QUEUED"))).returning({ id: f10BundleDeploymentsTable.id });
      if (blocked) await tx.insert(f10BundleDeploymentAuditTable).values({ deploymentId: deployment.id, actorId: req.localUser!.id, fromState: "QUEUED", toState: "BLOCKED", reason: "source changed after authorization; queued bundle hash mismatch" });
    });
    res.status(409).json({ id: deployment.id, state: "BLOCKED", execution: "NOT_CONFIRMED", acceptance: "NOT_SUBMITTED", error: error instanceof Error ? error.message : "bundle hash mismatch" });
    return;
  }
  const attempt = deployment.attemptCount + 1; const fence = randomUUID(); const deadline = new Date(Date.now() + 30_000);
  const claimed = await db.update(f10BundleDeploymentsTable).set({ state: "DISPATCHING", attemptCount: attempt, updatedAt: new Date() }).where(and(eq(f10BundleDeploymentsTable.id, deployment.id), eq(f10BundleDeploymentsTable.state, "QUEUED"))).returning({ id: f10BundleDeploymentsTable.id });
  if (!claimed[0]) { res.status(409).json({ state: "DISPATCHING" }); return; }
  await db.insert(f10BundleDeploymentAttemptsTable).values({ deploymentId: deployment.id, attempt, fenceToken: fence, nextAttemptAt: new Date(), deadline, state: "CLAIMED" });
  try {
    const [freshConnection] = await db.select().from(f10ProviderConnectionsTable).where(and(eq(f10ProviderConnectionsTable.id, deployment.connectionRef), eq(f10ProviderConnectionsTable.tenantId, req.localUser!.id), eq(f10ProviderConnectionsTable.active, true))).limit(1);
    if (!freshConnection) throw Object.assign(new Error("provider connection revoked before dispatch"), { status: 403 });
    const storedTargetConfig = (deployment.policySnapshot as { targetConfig?: Record<string, string> }).targetConfig ?? {};
    let targetConfig: Parameters<typeof targetConfigError>[0];
    try { targetConfig = trustedProviderTargetConfig(deployment.provider, deployment.target, storedTargetConfig); }
    catch { throw Object.assign(new Error("stored target configuration is invalid"), { status: 400 }); }
    const keyring = authorizationKeyringFromEnv();
    const opened = openAuthorizationRef(freshConnection.authorizationRef, keyring, process.env.SESSION_SECRET);
    if (opened.needsReencryption || freshConnection.authorizationKeyVersion !== keyring.current.version) {
      await db.update(f10ProviderConnectionsTable).set({
        authorizationRef: sealAuthorizationRef(opened.value, keyring),
        authorizationKeyVersion: keyring.current.version,
        reconnectRequiredAt: null,
        reconnectReason: null,
      }).where(and(eq(f10ProviderConnectionsTable.id, freshConnection.id), eq(f10ProviderConnectionsTable.authorizationRef, freshConnection.authorizationRef)));
    }
    const receipt = await createProviderAdapter(providerBrokerTransport(), process.env.F10_RECEIPT_SIGNING_SECRET ?? process.env.SESSION_SECRET ?? "").deliver(targetConfig, opened.value, exportResult, deployment.idempotencyKey, deadline);
    if (!receipt.accepted) throw Object.assign(new Error("provider rejected bundle"), { status: 400 });
    const finalized = await db.transaction(async tx => {
      const [ownedAttempt] = await tx.update(f10BundleDeploymentAttemptsTable).set({ state: "ACKNOWLEDGED", resultClass: "accepted" }).where(and(eq(f10BundleDeploymentAttemptsTable.deploymentId, deployment.id), eq(f10BundleDeploymentAttemptsTable.fenceToken, fence), eq(f10BundleDeploymentAttemptsTable.state, "CLAIMED"))).returning({ id: f10BundleDeploymentAttemptsTable.id });
      if (!ownedAttempt) return false;
      await tx.insert(f10BundleDeploymentReceiptsTable).values({ deploymentId: deployment.id, bundleHash: receipt.bundle_sha256, provider: deployment.provider, target: deployment.target, accepted: true, providerReceiptId: receipt.provider_receipt_id, receiptSignature: receipt.signature, payload: receipt });
      const [ownedDeployment] = await tx.update(f10BundleDeploymentsTable).set({ state: "ACKNOWLEDGED", updatedAt: new Date() }).where(and(eq(f10BundleDeploymentsTable.id, deployment.id), eq(f10BundleDeploymentsTable.state, "DISPATCHING"))).returning({ id: f10BundleDeploymentsTable.id });
      if (!ownedDeployment) throw new Error("deployment fence lost");
      await tx.insert(f10BundleDeploymentAuditTable).values({ deploymentId: deployment.id, actorId: req.localUser!.id, fromState: "DISPATCHING", toState: "ACKNOWLEDGED", reason: "provider accepted bundle; execution remains unconfirmed" });
      return true;
    });
    if (!finalized) { res.status(409).json({ id: deployment.id, state: "QUEUED", execution: "NOT_CONFIRMED" }); return; }
    res.json({ id: deployment.id, state: "ACKNOWLEDGED", receipt, execution: "NOT_CONFIRMED" });
  } catch (error) {
    const reconnectRequired = error instanceof AuthorizationKeyUnavailableError;
    if (reconnectRequired) {
      await db.update(f10ProviderConnectionsTable).set({
        active: false,
        reconnectRequiredAt: new Date(),
        reconnectReason: error.message,
      }).where(eq(f10ProviderConnectionsTable.id, deployment.connectionRef));
    }
    const status = Number((error as { status?: number }).status ?? 0); const retryable = status === 429 || status >= 500 || status === 0;
    const effectiveRetryable = reconnectRequired ? false : retryable;
    const next = attempt < 5 && effectiveRetryable ? "QUEUED" : (effectiveRetryable ? "DEAD_LETTERED" : "FAILED_PERMANENT");
    const retryAt = new Date(Date.now() + retryDelay(attempt));
    await db.update(f10BundleDeploymentAttemptsTable).set({ state: effectiveRetryable ? "RETRYABLE" : "PERMANENT", resultClass: reconnectRequired ? "authorization_key_unavailable" : status ? `provider_http_${status}` : "network", nextAttemptAt: retryAt }).where(and(eq(f10BundleDeploymentAttemptsTable.deploymentId, deployment.id), eq(f10BundleDeploymentAttemptsTable.fenceToken, fence)));
    await db.update(f10BundleDeploymentsTable).set({ state: next, updatedAt: new Date() }).where(eq(f10BundleDeploymentsTable.id, deployment.id));
    const auditReason = reconnectRequired ? error.message : effectiveRetryable ? "bounded retry scheduled" : "permanent provider rejection";
    await db.insert(f10BundleDeploymentAuditTable).values({ deploymentId: deployment.id, actorId: req.localUser!.id, fromState: "DISPATCHING", toState: next, reason: auditReason });
    res.status(effectiveRetryable ? 202 : 409).json({ id: deployment.id, state: next, execution: "NOT_CONFIRMED", retryAt: next === "QUEUED" ? retryAt : undefined, fallback: effectiveRetryable ? undefined : "EXPORT", reconnectRequired, error: reconnectRequired ? error.message : undefined });
  }
});
router.post("/f10/deployments/:id/reconcile", requireAuth, async (req, res): Promise<void> => {
  const deploymentId = String(req.params.id);
  const [deployment] = await db.select().from(f10BundleDeploymentsTable).where(and(eq(f10BundleDeploymentsTable.id, deploymentId), eq(f10BundleDeploymentsTable.tenantId, req.localUser!.id))).limit(1);
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  try {
    const result = await reconcileF10BundleDeployment(deployment.id, { actorId: req.localUser!.id });
    if (result.outcome !== "CHECKED") { res.status(409).json(result); return; }
    res.json(result);
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 0);
    res.status(status >= 400 && status < 500 ? 409 : 502).json({ executionStatus: "UNAVAILABLE", reason: error instanceof Error ? error.message : "provider status reconciliation failed" });
  }
});

router.post("/f10/destinations", requireAuth, async (req, res): Promise<void> => {
  const parsed = DestinationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    await validateHttpsDestination(parsed.data.endpoint);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Destination is not safe" });
    return;
  }
  const [destination] = await db.insert(f10DestinationsTable).values({
    ...parsed.data,
    tenantId: req.localUser!.id,
    authorizationScopes: parsed.data.authorizationScopes,
  }).returning();
  if (!destination) { res.status(500).json({ error: "Destination creation failed" }); return; }
  const { secretRef: _secretRef, ...safe } = destination;
  res.status(201).json(safe);
});

router.post("/f10/destinations/:id/revoke", requireAuth, async (req, res): Promise<void> => {
  const [destination] = await db.update(f10DestinationsTable)
    .set({ active: false, revokedAt: new Date() })
    .where(and(eq(f10DestinationsTable.id, String(req.params.id)), eq(f10DestinationsTable.tenantId, req.localUser!.id), eq(f10DestinationsTable.active, true)))
    .returning();
  if (!destination) { res.status(404).json({ error: "Destination not found or already revoked" }); return; }
  const { secretRef: _secretRef, ...safe } = destination;
  res.json(safe);
});

// F9 artifacts are selected by ID only. The caller cannot provide bytes, signatures, or verdicts.
router.post("/f10/releases", requireAuth, async (req, res): Promise<void> => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "machineArtifactId, destinationId and releaseIntent are required; artifact bytes are never accepted" }); return; }
  const { machineArtifactId, destinationId, releaseIntent, sessionId } = parsed.data;
  const tenantId = req.localUser!.id;
  const runConditions = [
    eq(f9MechaRunsTable.userId, tenantId),
    eq(f9MechaRunsTable.status, "EMITTED" as const),
    ...(sessionId ? [eq(f9MechaRunsTable.sessionId, sessionId)] : []),
  ];
  const runs = await db.select().from(f9MechaRunsTable).where(and(...runConditions));
  const run = runs.find((candidate) => (candidate.artifactContent as Record<string, any> | null)?.machine_artifact_id === machineArtifactId);
  const artifactContent = run?.artifactContent as Record<string, any> | null;
  const artifact = run && artifactContent?.machine_artifact_id === machineArtifactId ? {
    machineArtifactId, mechaRunId: run.mechaRunId, spkId: String(artifactContent.spk_id ?? ""),
    artifactVersion: run.artifactVersion, mediaType: "application/json", payloadHash: run.payloadHash ?? "",
    artifactSignature: run.artifactSignature ?? "", artifactContent, sourceArtifactId: run.sourceArtifactId,
  } : null;
  const [destination] = await db.select().from(f10DestinationsTable).where(and(eq(f10DestinationsTable.tenantId, tenantId), eq(f10DestinationsTable.id, destinationId))).limit(1);
  const [custody] = artifact ? await db.select().from(osirisCustodiesTable).where(and(eq(osirisCustodiesTable.machineArtifactId, artifact.machineArtifactId), eq(osirisCustodiesTable.ownerUserId, tenantId))).limit(1) : [];
  if (!artifact || !custody || !destination) { res.status(404).json({ error: "Artifact, active custody, or destination not found" }); return; }
  if (!process.env.SESSION_SECRET) { res.status(503).json({ error: "F9 signing verification is not configured" }); return; }
  try { verifyF9Hmac(artifact.artifactContent, artifact.payloadHash, artifact.artifactSignature, process.env.SESSION_SECRET); } catch { res.status(409).json({ error: "F9 artifact integrity verification failed" }); return; }
  const key = deterministicIdempotencyKey(artifact.payloadHash, destination.id, releaseIntent);
  const [old] = await db.select().from(f10ReleaseRequestsTable).where(and(eq(f10ReleaseRequestsTable.tenantId, tenantId), eq(f10ReleaseRequestsTable.idempotencyKey, key))).limit(1);
  if (old) { res.json(old); return; }
  const envelope = { machine_artifact_id: artifact.machineArtifactId, mecha_run_id: artifact.mechaRunId, artifact_version: artifact.artifactVersion, media_type: artifact.mediaType, spk_id: artifact.spkId, ucg_certificate: { verdict: String(artifact.artifactContent.ucg_certificate?.verdict ?? "FAIL"), expires_at: custody.expiresAt.toISOString(), signature: artifact.artifactSignature }, osiris_custody_attestation: { osiris_custody: ["active", "recovered"].includes(custody.custodyState), expires_at: custody.expiresAt.toISOString(), signature: custody.sourceSignature }, payload_hash: artifact.payloadHash, artifact_signature: artifact.artifactSignature };
  const failures = verifyPrerequisites(envelope);
  if (artifact.artifactContent.mm_verdict !== "MATH_VERIFIED") failures.push("MM verdict is not MATH_VERIFIED");
  if (!["FIT", "CLUSTER"].includes(artifact.artifactContent.savant_verdict)) failures.push("SAVANT verdict is not passing");
  const snapshot = { version: "f10-v1", destinationId: destination.id, adapterId: destination.adapterId, adapterVersion: destination.adapterVersion, scopes: destination.authorizationScopes };
  const [release] = await db.insert(f10ReleaseRequestsTable).values({
    tenantId, actorId: tenantId, machineArtifactId: artifact.machineArtifactId, mechaRunId: artifact.mechaRunId, spkId: artifact.spkId,
    artifactVersion: artifact.artifactVersion, mediaType: artifact.mediaType, payloadHash: artifact.payloadHash, artifactSignature: artifact.artifactSignature,
    custodyAttestation: { custodyRef: custody.id, active: ["active", "recovered"].includes(custody.custodyState) }, destinationRef: destination.id, destinationIdentity: destination.id,
    policyVersion: "f10-v1", policyHash: deterministicIdempotencyKey(JSON.stringify(snapshot), destination.id, "policy"), policySnapshot: snapshot, idempotencyKey: key,
    state: failures.length || !destination.active ? "BLOCKED" : "QUEUED",
  }).returning();
  const chain = failures.length || !destination.active ? ["BLOCKED"] : ["VERIFYING", "AUTHORIZED", "QUEUED"];
  await db.insert(f10ReleaseTransitionsTable).values(chain.map((toState, i) => ({ releaseId: release!.id, fromState: i ? chain[i - 1] : "REQUESTED", toState, actorId: tenantId, reason: failures.join("; ") || "policy and upstream checks passed", policyVersion: "f10-v1" })));
  res.status(201).json({ ...release, blockedReasons: failures });
});

router.get("/f10/releases", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(f10ReleaseRequestsTable).where(eq(f10ReleaseRequestsTable.tenantId, req.localUser!.id)).orderBy(desc(f10ReleaseRequestsTable.createdAt));
  res.json(rows);
});
// Worker/operator trigger: dispatch implementations claim an attempt with a fence token
// before adapter I/O. This endpoint deliberately never accepts payload bytes.
router.post("/f10/releases/:id/process", requireAuth, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const [release] = await db.select().from(f10ReleaseRequestsTable).where(and(eq(f10ReleaseRequestsTable.id, id), eq(f10ReleaseRequestsTable.tenantId, req.localUser!.id))).limit(1);
  if (!release) { res.status(404).json({ error: "Release not found" }); return; }
  if (release.state !== "QUEUED") { res.status(409).json({ error: `Release is ${release.state}`, state: release.state }); return; }
  const store=createF10ProductionStore(); const artifact=await store.getArtifact(req.localUser!.id,release.machineArtifactId); const dest=await store.getDestination(req.localUser!.id,release.destinationRef);
  if(!artifact||!dest) { res.status(409).json({releaseId:release.id,state:"BLOCKED",error:"F9 artifact or OSIRIS custody unavailable"}); return; }
  const secret=envSecretProvider(); const adapter=createF10Adapters(secret).get(dest.adapterId,dest.adapterVersion,dest.endpoint,dest.secretRef);
  const service=new F10ReleaseService({store,custody:createF10CustodyProvider(req.localUser!.id,release.machineArtifactId),adapters:new Map([[dest.adapterId,adapter]]),secret,signingSecret:process.env.F10_RECEIPT_SIGNING_SECRET??process.env.SESSION_SECRET??"",maxAttempts:5});
  try { const result=await service.process(release.id,req.localUser!.id); res.status(result.state==="ACKNOWLEDGED"?200:result.state==="QUEUED"?202:409).json(result); } catch { res.status(409).json({releaseId:release.id,state:"BLOCKED",error:"Release prerequisites failed"}); }
});
router.get("/f10/releases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
  const [release] = await db.select().from(f10ReleaseRequestsTable).where(and(eq(f10ReleaseRequestsTable.id, id), eq(f10ReleaseRequestsTable.tenantId, req.localUser!.id))).limit(1);
  if (!release) { res.status(404).json({ error: "Release not found" }); return; }
  const [transitions, attempts, receipts, dlq] = await Promise.all([
    db.select().from(f10ReleaseTransitionsTable).where(eq(f10ReleaseTransitionsTable.releaseId, release.id)).orderBy(desc(f10ReleaseTransitionsTable.createdAt)),
    db.select().from(f10AttemptsTable).where(eq(f10AttemptsTable.releaseId, release.id)),
    db.select().from(f10ReceiptsTable).where(eq(f10ReceiptsTable.releaseId, release.id)),
    db.select().from(f10DlqTable).where(eq(f10DlqTable.releaseId, release.id)),
  ]);
  res.json({ ...release, transitions, attempts, receipt: receipts[0]?.receiptPayload ?? null, dlq: dlq[0] ?? null });
});

/**
 * F11 H8 is a receipt handoff, not an F10 release. F10 can inspect the
 * server-signed receipt without treating it as a deployment acknowledgement
 * or bypassing the signed F9/OSIRIS release gateway.
 */
router.get("/f10/host-receipts/:hostRunId", requireAuth, async (req, res): Promise<void> => {
  const hostRunId = typeof req.params.hostRunId === "string" ? req.params.hostRunId : req.params.hostRunId[0]!;
  const [run] = await db.select().from(f11HostRunsTable).where(and(
    eq(f11HostRunsTable.id, hostRunId),
    eq(f11HostRunsTable.tenantId, req.localUser!.id),
  )).limit(1);
  if (!run) { res.status(404).json({ error: "Host run not found" }); return; }
  if (run.state !== "H8_HANDED_OFF" || !run.hostReceipt || typeof run.hostReceipt !== "object" || Array.isArray(run.hostReceipt)) {
    res.status(409).json({ error: "HostReceipt is unavailable until H8 monitoring registration completes", code: "HOST_RECEIPT_UNAVAILABLE" });
    return;
  }
  const receipt = run.hostReceipt as Record<string, unknown>;
  const signature = typeof receipt.receiptSignature === "string" ? receipt.receiptSignature : "";
  const unsigned = { ...receipt };
  delete unsigned.receiptSignature;
  if (!signature || signature !== signHostReceipt(unsigned, process.env.SESSION_SECRET ?? "")) {
    res.status(409).json({ error: "HostReceipt signature is invalid", code: "HOST_RECEIPT_INVALID" });
    return;
  }
  res.json({ receipt, handoffType: "F11_TO_F10_RECEIPT_ONLY", releaseRequired: true });
});
export default router;