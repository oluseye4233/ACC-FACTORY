import { createdAgentsTable, portalPublicationsTable } from "@workspace/db";
import { Router, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, boomerangCasesTable, harnessSessionsTable, harnessArtifactsTable,
  ingestionDocumentsTable, cartridgePackagesTable, f0EngagementsTable, f0ReportsTable,
} from "@workspace/db";
import { artifactDisplayName } from "@workspace/artifact-naming";
import { requireAuth } from "../lib/auth";
import { boomerangHash, boomerangOrigin, BOOMERANG_FEATURES, BoomerangError } from "../lib/boomerang";
import { nextBoomerangUpgrade, returnedArtifactHref } from "../lib/boomerang-upgrades";
import { captureArtifactPersisted } from "../lib/command-deck-capture";
import {
  SUPPORT_TOOLS, PUBLICATION_KINDS, exactSupportSource, supportAvailability,
  assertFreshSupportOutput, safePreparationResult, type SupportTool,
} from "../lib/stage-support";

const router = Router();
const uuid = z.string().uuid();
const originSchema = z.object({ sessionId: uuid, featureId: z.coerce.number().int() }).strict();
type Reader = Pick<typeof db, "select">;
type Case = typeof boomerangCasesTable.$inferSelect;
type Metadata = { supportTool: SupportTool; sourceId: string; featureId: number; sourceKind: string | null; f0EngagementId?: string };

function stageFor(featureId: number) {
  const stage = Object.keys(BOOMERANG_FEATURES).find(stage => BOOMERANG_FEATURES[stage] === featureId);
  if (!stage) throw new BoomerangError(400, "INVALID_STAGE", "Unknown production stage.");
  return stage;
}
function metadata(row: Case): Metadata {
  const first = (row.history as Record<string, unknown>[])[0];
  if (!first || !SUPPORT_TOOLS.includes(first.supportTool as SupportTool) || typeof first.sourceId !== "string" ||
      typeof first.featureId !== "number" || row.originKind !== "SESSION") {
    throw new BoomerangError(404, "DEPARTURE_NOT_FOUND", "Stage support departure not found.");
  }
  return first as unknown as Metadata;
}
async function ownedSession(reader: Reader, owner: string, id: string) {
  const [session] = await reader.select().from(harnessSessionsTable).where(and(
    eq(harnessSessionsTable.id, id), eq(harnessSessionsTable.userId, owner),
  )).limit(1);
  if (!session) throw new BoomerangError(404, "ORIGIN_NOT_FOUND", "Owned origin session not found.");
  return session;
}
async function sourceRows(reader: Reader, owner: string, id: string) {
  return reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.sessionId, id), eq(harnessArtifactsTable.userId, owner),
  )).orderBy(desc(harnessArtifactsTable.createdAt));
}
async function ownedCase(reader: Reader, owner: string, id: string) {
  const [row] = await reader.select().from(boomerangCasesTable).where(and(
    eq(boomerangCasesTable.id, id), eq(boomerangCasesTable.userId, owner),
  )).limit(1);
  if (!row) throw new BoomerangError(404, "DEPARTURE_NOT_FOUND", "Stage support departure not found.");
  metadata(row);
  return row;
}
async function departureDto(reader: Reader, row: Case) {
  const m = metadata(row);
  const [source] = await reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.id, m.sourceId), eq(harnessArtifactsTable.userId, row.userId),
    eq(harnessArtifactsTable.sessionId, row.originId),
  )).limit(1);
  if (!source) throw new BoomerangError(409, "SOURCE_MISSING", "The saved departure source is no longer available.");
  const sourceText = JSON.stringify(source.artifactContent, null, 2);
  if (sourceText.length > 200_000) throw new BoomerangError(413, "SOURCE_TOO_LARGE", "This saved source exceeds the supporting intake limit.");
  const params = new URLSearchParams({ supportCaseId: row.id });
  let path: string = m.supportTool === "agent-creator" ? "/agent-creator" : m.supportTool === "imprima" ? "/imprima-portal" : m.supportTool === "f0" ? "/f0" : m.supportTool === "ingestion" ? "/ingest" : m.supportTool === "cartridge" ? "/cartridge" : "/operations";
  if (m.supportTool === "agent-creator" || m.supportTool === "imprima") {
    params.set("sessionId", row.originId); params.set("featureId", String(m.featureId));
    params.set("sourceId", source.id); params.set("sourceType", "ARTIFACT");
  }
  if (m.supportTool === "f0") {
    const [engagement] = await reader.select({ id: f0EngagementsTable.id }).from(f0EngagementsTable).where(and(
      eq(f0EngagementsTable.id, m.f0EngagementId ?? row.id), eq(f0EngagementsTable.userId, row.userId),
      eq(f0EngagementsTable.sessionId, row.originId), eq(f0EngagementsTable.artifactId, source.id),
    )).limit(1);
    if (!engagement) throw new BoomerangError(409, "ADVISORY_MISSING", "This departure's linked advisory engagement is no longer available.");
    params.set("engagementId", engagement.id);
  }
  if (path === "/operations") {
    params.set("kind", m.supportTool); params.set("sessionId", row.originId);
    params.set("sourceId", source.id); params.set("sourceKind", m.sourceKind!);
  }
  const [returned] = await reader.select().from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, row.userId), eq(harnessArtifactsTable.sessionId, row.originId),
    sql`${harnessArtifactsTable.artifactContent}->>'boomerangCaseId' = ${row.id}`,
  )).limit(1);
  return {
    caseId: row.id, tool: m.supportTool, sessionId: row.originId, featureId: m.featureId, stageLabel: row.stage,
    sourceId: source.id, sourceKind: m.sourceKind, sourceTitle: artifactDisplayName(source), sourceText,
    launchHref: `${path}?${params}`, f0EngagementId: m.f0EngagementId ?? null,
    returnedArtifactHref: returned ? returnedArtifactHref(row.originId, m.featureId, returned.id) : null,
  };
}
function fail(res: Response, error: unknown) {
  if (!(error instanceof BoomerangError)) throw error;
  res.status(error.status).json({ error: error.message, code: error.code });
}

router.get("/stage-support/options", requireAuth, async (req, res) => {
  const parsed = originSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid stage origin." }); return; }
  try {
    stageFor(parsed.data.featureId);
    await ownedSession(db, req.localUser!.id, parsed.data.sessionId);
    const source = exactSupportSource(await sourceRows(db, req.localUser!.id, parsed.data.sessionId), parsed.data.featureId);
    res.json({ sourceId: source?.id ?? null, tools: SUPPORT_TOOLS.filter(tool => tool !== "short-sprints").map(tool => supportAvailability(source, tool)) });
  } catch (error) { fail(res, error); }
});

router.post("/stage-support/departures", requireAuth, async (req, res) => {
  const parsed = originSchema.extend({ tool: z.enum(SUPPORT_TOOLS) }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid stage support departure." }); return; }
  try {
    const { sessionId, featureId, tool } = parsed.data;
    const owner = req.localUser!.id;
    const row = await db.transaction(async tx => {
      await tx.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable).where(and(
        eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, owner),
      )).for("update");
      await ownedSession(tx, owner, sessionId);
      const stage = stageFor(featureId);
      const source = exactSupportSource(await sourceRows(tx, owner, sessionId), featureId);
      const availability = supportAvailability(source, tool);
      if (!availability.active || !source) throw new BoomerangError(409, "TOOL_INACTIVE", availability.reason);
      if (JSON.stringify(source.artifactContent).length > 200_000) throw new BoomerangError(413, "SOURCE_TOO_LARGE", "Saved source exceeds the supporting intake limit.");
      const baseline = await boomerangOrigin(tx, owner, "SESSION", sessionId, stage);
      const brief = `Prepare ${tool} supporting work for the saved ${stage} artifact. Return a new candidate for review and fresh evaluation; never certify or advance the stage.`;
      // A unique engagement per departure prevents unrelated/old advisory reports
      // being attached to a stage. Standalone F0 and its discovery gates are unchanged.
      let f0EngagementId: string | undefined;
      if (tool === "f0") {
        const [engagement] = await tx.insert(f0EngagementsTable).values({
          userId: owner, sessionId, artifactId: source.id,
          title: `${source.name || artifactDisplayName(source)} · ${stage} F0 Advisory`,
        }).returning({ id: f0EngagementsTable.id });
        f0EngagementId = engagement!.id;
      }
      const [created] = await tx.insert(boomerangCasesTable).values({
        userId: owner, originKind: "SESSION", originId: sessionId, stage,
        title: `${tool.toUpperCase()} · ${stage} supporting work`, brief,
        sourceHash: baseline.hash, sourceRefs: baseline.refs,
        history: [{ action: "REQUESTED", at: new Date().toISOString(), note: brief,
          supportTool: tool, sourceId: source.id, featureId, sourceKind: PUBLICATION_KINDS[source.artifactType] ?? null,
          ...(f0EngagementId ? { f0EngagementId } : {}) }],
      }).returning();
      return created!;
    });
    res.status(201).json(await departureDto(db, row));
  } catch (error) { fail(res, error); }
});

router.get("/stage-support/departures/:id", requireAuth, async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) { res.status(400).json({ error: "Invalid departure ID." }); return; }
  try { res.json(await departureDto(db, await ownedCase(db, req.localUser!.id, req.params.id as string))); }
  catch (error) { fail(res, error); }
});

// Reopen from the advisory dashboard after leaving the page without relying on
// browser storage or caller-supplied session/stage fields.
router.get("/stage-support/f0-origins/:engagementId", requireAuth, async (req, res) => {
  if (!uuid.safeParse(req.params.engagementId).success) { res.status(400).json({ error: "Invalid engagement ID." }); return; }
  try {
    const owner = req.localUser!.id;
    const [engagement] = await db.select({ id: f0EngagementsTable.id }).from(f0EngagementsTable).where(and(
      eq(f0EngagementsTable.id, req.params.engagementId as string), eq(f0EngagementsTable.userId, owner),
    )).limit(1);
    if (!engagement) throw new BoomerangError(404, "ADVISORY_NOT_FOUND", "Owned advisory engagement not found.");
    const [row] = await db.select().from(boomerangCasesTable).where(and(
      eq(boomerangCasesTable.userId, owner), eq(boomerangCasesTable.originKind, "SESSION"),
      sql`${boomerangCasesTable.history}->0->>'supportTool' = 'f0'`,
      sql`${boomerangCasesTable.history}->0->>'f0EngagementId' = ${engagement.id}`,
    )).orderBy(desc(boomerangCasesTable.createdAt)).limit(1);
    res.json({ departure: row ? await departureDto(db, row) : null });
  } catch (error) { fail(res, error); }
});

router.post("/stage-support/departures/:id/return", requireAuth, async (req, res) => {
  const input = z.object({ resultId: uuid }).strict().safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !input.success) { res.status(400).json({ error: "Invalid saved return result." }); return; }
  try {
    const owner = req.localUser!.id;
    const result = await db.transaction(async tx => {
      const original = await ownedCase(tx, owner, req.params.id as string);
      await tx.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable).where(and(
        eq(harnessSessionsTable.id, original.originId), eq(harnessSessionsTable.userId, owner),
      )).for("update");
      const [row] = await tx.select().from(boomerangCasesTable).where(eq(boomerangCasesTable.id, original.id)).for("update");
      const m = metadata(row!);
      const resultId = input.data.resultId;
      const [existing] = await tx.select().from(harnessArtifactsTable).where(and(
        eq(harnessArtifactsTable.userId, owner), eq(harnessArtifactsTable.sessionId, row!.originId),
        sql`${harnessArtifactsTable.artifactContent}->>'boomerangCaseId' = ${row!.id}`,
      )).limit(1);
      if (existing) {
        const content = existing.artifactContent as Record<string, unknown>;
        if (content.supportResultId !== resultId) throw new BoomerangError(409, "ALREADY_RETURNED", "This departure already returned another saved result.");
        return { returnedArtifactId: existing.id, returnedArtifactHref: returnedArtifactHref(row!.originId, m.featureId, existing.id),
          upgradeLabel: (content.boomerangUpgrade as { label: string }).label };
      }
      if (row!.state !== "REQUESTED") throw new BoomerangError(409, "DEPARTURE_CLOSED", "This departure is no longer open.");
      const session = await ownedSession(tx, owner, row!.originId);
      const [source] = await tx.select().from(harnessArtifactsTable).where(and(
        eq(harnessArtifactsTable.id, m.sourceId), eq(harnessArtifactsTable.userId, owner),
        eq(harnessArtifactsTable.sessionId, row!.originId),
      )).limit(1);
      if (!source) throw new BoomerangError(409, "SOURCE_MISSING", "Origin source is no longer available.");
      let output: unknown;
      let ownPreparationId: string | undefined;
      const [portalResult] = m.supportTool === "imprima" ? await tx.select().from(portalPublicationsTable)
        .where(and(eq(portalPublicationsTable.id, resultId), eq(portalPublicationsTable.userId, owner))).limit(1) : [];
      if (m.supportTool === "agent-creator") {
        const [agent] = await tx.select().from(createdAgentsTable).where(and(
          eq(createdAgentsTable.id, resultId), eq(createdAgentsTable.userId, owner),
          eq(createdAgentsTable.sessionId, row!.originId),
        )).limit(1);
        if (!agent?.artifactId || !["ACTIVE", "NEEDS_REWORK"].includes(agent.state) ||
            (agent.sourceArtifactId !== source.id && agent.companionArtifactId !== source.id) ||
            agent.createdAt.getTime() < row!.createdAt.getTime()) {
          throw new BoomerangError(409, "AGENT_RESULT_MISMATCH", "Create and save an agent tied to this departure's exact source or Micro PDD companion before returning.");
        }
        const [pkg] = await tx.select().from(harnessArtifactsTable).where(and(
          eq(harnessArtifactsTable.id, agent.artifactId), eq(harnessArtifactsTable.userId, owner),
        )).limit(1);
        if (!pkg) throw new BoomerangError(409, "AGENT_RESULT_MISSING", "Saved agent package is unavailable.");
        output = { agentId: agent.id, agentArtifactId: pkg.id, package: pkg.artifactContent,
          notice: "Supporting agent package; internal activation does not pass or advance the originating production stage." };
      } else if (portalResult) {
        if (portalResult.sourceType !== "ARTIFACT" || portalResult.sourceId !== source.id ||
            portalResult.state !== "READY" || portalResult.createdAt.getTime() < row!.createdAt.getTime()) {
          throw new BoomerangError(409, "PUBLICATION_RESULT_MISMATCH", "Prepare a publication for this exact departure source before returning.");
        }
        output = { publicationId: portalResult.id, title: portalResult.title, author: portalResult.author,
          publicationHref: `/imprima-portal?publicationId=${portalResult.id}`, source: source.artifactContent,
          notice: "Private publication preparation; downloading still requires the single-use emailed code. No release approval is conferred." };
      } else if (m.supportTool === "imprima" || m.supportTool === "short-sprints") {
        const [saved] = await tx.select().from(harnessArtifactsTable).where(and(
          eq(harnessArtifactsTable.id, resultId), eq(harnessArtifactsTable.userId, owner),
          eq(harnessArtifactsTable.sessionId, row!.originId),
          eq(harnessArtifactsTable.artifactType, m.supportTool === "imprima" ? "IMPRIMA_PREPARATION" : "SHORT_SPRINT_PREPARATION"),
        )).limit(1);
        if (!saved) throw new BoomerangError(404, "RESULT_NOT_FOUND", "Completed owned preparation not found.");
        assertFreshSupportOutput(saved.createdAt, row!.createdAt);
        output = { preparationId: saved.id, ...safePreparationResult(saved.artifactContent as Record<string, unknown>, m.supportTool, m.sourceId) };
        ownPreparationId = saved.id;
      } else if (m.supportTool === "f0") {
        const [engagement] = await tx.select({ id: f0EngagementsTable.id }).from(f0EngagementsTable).where(and(
          eq(f0EngagementsTable.id, m.f0EngagementId ?? row!.id), eq(f0EngagementsTable.userId, owner),
          eq(f0EngagementsTable.sessionId, row!.originId), eq(f0EngagementsTable.artifactId, m.sourceId),
        )).limit(1);
        if (!engagement) throw new BoomerangError(409, "WRONG_ADVISORY_SOURCE", "This departure's exact owned advisory source is no longer valid.");
        const [saved] = await tx.select().from(f0ReportsTable).where(and(
          eq(f0ReportsTable.id, resultId), eq(f0ReportsTable.userId, owner),
          eq(f0ReportsTable.engagementId, engagement.id),
        )).limit(1);
        if (!saved) throw new BoomerangError(404, "RESULT_NOT_FOUND", "Saved report for this exact advisory departure not found.");
        assertFreshSupportOutput(saved.createdAt, row!.createdAt);
        if (!saved.reportCode.trim() || !saved.content || typeof saved.content !== "object" ||
            Array.isArray(saved.content) || !Object.keys(saved.content).length) {
          throw new BoomerangError(409, "INCOMPLETE_ADVISORY", "A completed saved advisory report is required.");
        }
        output = { reportId: saved.id, engagementId: engagement.id, reportCode: saved.reportCode,
          service: saved.service, content: saved.content, advisoryOnly: true, independentVerification: "NOT_ASSERTED" };
      } else if (m.supportTool === "ingestion") {
        const [saved] = await tx.select().from(ingestionDocumentsTable).where(and(
          eq(ingestionDocumentsTable.id, resultId), eq(ingestionDocumentsTable.userId, owner),
        )).limit(1);
        if (!saved) throw new BoomerangError(404, "RESULT_NOT_FOUND", "Saved owned ingestion not found.");
        assertFreshSupportOutput(saved.createdAt, row!.createdAt);
        output = { ingestionId: saved.id, title: saved.detectedTitle, summary: saved.summary, seedPrompt: saved.seedPrompt,
          sourceDocKind: saved.sourceDocKind, extractedTextSha256: saved.extractedTextSha256 };
      } else {
        const [saved] = await tx.select().from(cartridgePackagesTable).where(and(
          eq(cartridgePackagesTable.id, resultId), eq(cartridgePackagesTable.userId, owner),
        )).limit(1);
        if (!saved) throw new BoomerangError(404, "RESULT_NOT_FOUND", "Saved owned cartridge not found.");
        assertFreshSupportOutput(saved.createdAt, row!.createdAt);
        output = { cartridgeId: saved.id, projectName: saved.projectName, outcomeOneLiner: saved.outcomeOneLiner,
          scopeStatement: saved.scopeStatement, seedPrompt: saved.seedPrompt, summary: saved.summary };
      }
      const baseline = await boomerangOrigin(tx, owner, "SESSION", row!.originId, row!.stage, ownPreparationId);
      if (baseline.hash !== row!.sourceHash) throw new BoomerangError(409, "SOURCE_CHANGED", "Origin production artifacts changed since departure. Start fresh supporting work against the current source.");
      const resultText = JSON.stringify(output, null, 2);
      if (resultText.length > 200_000) throw new BoomerangError(413, "RESULT_TOO_LARGE", "Saved result exceeds the supporting return limit.");
      const upgrade = await nextBoomerangUpgrade(tx, source);
      const project = session.sessionName.trim();
      const rootName = upgrade.rootName.toLocaleLowerCase().startsWith(project.toLocaleLowerCase()) ? upgrade.rootName : `${project} · ${upgrade.rootName}`;
      const [artifact] = await tx.insert(harnessArtifactsTable).values({
        userId: owner, sessionId: row!.originId, featureId: m.featureId, artifactType: "SPC_PLAYER_SUPPORT",
        name: `${rootName} · ${m.supportTool.toUpperCase()} · ${upgrade.label}`, parentArtifactId: source.id,
        artifactContent: { boomerangCaseId: row!.id, sourceArtifactId: source.id, supportTool: m.supportTool, supportResultId: resultId,
          boomerangUpgrade: { ...upgrade, originFeatureId: m.featureId }, resultText,
          advisoryOnly: true, planOnly: true, reviewRequired: true, certifies: false, advancesStage: false },
        scorecards: [], verificationStatus: "UNVERIFIED", forgeVerified: false,
      }).returning();
      await captureArtifactPersisted(tx, artifact!);
      await tx.update(boomerangCasesTable).set({
        state: "RETURNED", version: row!.version + 1, resultText, resultHash: boomerangHash({ resultText, sourceHash: row!.sourceHash }),
        history: [...row!.history as unknown[], { action: "RETURN", at: new Date().toISOString(), supportTool: m.supportTool,
          supportResultId: resultId, ...(ownPreparationId ? { supportOutputArtifactId: ownPreparationId } : {}) }],
      }).where(eq(boomerangCasesTable.id, row!.id));
      return { returnedArtifactId: artifact!.id, returnedArtifactHref: returnedArtifactHref(row!.originId, m.featureId, artifact!.id), upgradeLabel: upgrade.label };
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

export default router;
