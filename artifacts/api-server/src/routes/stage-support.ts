import { Router, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, boomerangCasesTable, harnessSessionsTable, harnessArtifactsTable,
  ingestionDocumentsTable, cartridgePackagesTable,
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
type Metadata = { supportTool: SupportTool; sourceId: string; featureId: number; sourceKind: string | null };

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
  let path: string = m.supportTool === "ingestion" ? "/ingest" : m.supportTool === "cartridge" ? "/cartridge" : "/operations";
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
    launchHref: `${path}?${params}`,
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
    res.json({ sourceId: source?.id ?? null, tools: SUPPORT_TOOLS.map(tool => supportAvailability(source, tool)) });
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
      const [created] = await tx.insert(boomerangCasesTable).values({
        userId: owner, originKind: "SESSION", originId: sessionId, stage,
        title: `${tool.toUpperCase()} · ${stage} supporting work`, brief,
        sourceHash: baseline.hash, sourceRefs: baseline.refs,
        history: [{ action: "REQUESTED", at: new Date().toISOString(), note: brief,
          supportTool: tool, sourceId: source.id, featureId, sourceKind: PUBLICATION_KINDS[source.artifactType] ?? null }],
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
      if (m.supportTool === "imprima" || m.supportTool === "short-sprints") {
        const [saved] = await tx.select().from(harnessArtifactsTable).where(and(
          eq(harnessArtifactsTable.id, resultId), eq(harnessArtifactsTable.userId, owner),
          eq(harnessArtifactsTable.sessionId, row!.originId),
          eq(harnessArtifactsTable.artifactType, m.supportTool === "imprima" ? "IMPRIMA_PREPARATION" : "SHORT_SPRINT_PREPARATION"),
        )).limit(1);
        if (!saved) throw new BoomerangError(404, "RESULT_NOT_FOUND", "Completed owned preparation not found.");
        assertFreshSupportOutput(saved.createdAt, row!.createdAt);
        output = { preparationId: saved.id, ...safePreparationResult(saved.artifactContent as Record<string, unknown>, m.supportTool, m.sourceId) };
        ownPreparationId = saved.id;
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
