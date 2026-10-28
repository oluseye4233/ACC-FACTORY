import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { resolveSpcPlayerSource } from "@workspace/artifact-naming";
import { nextBoomerangUpgrade } from "../lib/boomerang-upgrades";
import { captureArtifactPersisted } from "../lib/command-deck-capture";
import {
  boomerangCasesTable, db, f0EngagementsTable, harnessArtifactsTable, harnessSessionsTable,
  spcPlayerDraftRunsTable, spcPlayerRunsTable,
} from "@workspace/db";
import { CreateBoomerangCaseBody, TransitionBoomerangCaseBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { boomerangRemediation } from "../lib/boomerang-remediation";
import {
  assertBoomerangTransition, BOOMERANG_FEATURES, BOOMERANG_STAGES, BoomerangError,
  boomerangHash, boomerangOrigin, boomerangResponse, returnedSupportOutputId,
} from "../lib/boomerang";

const router = Router();
const uuid = z.string().uuid();
const filters = z.object({
  originKind: z.enum(["SESSION", "F0"]).optional(),
  originId: uuid.optional(), stage: z.enum(BOOMERANG_STAGES).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

router.get("/boomerang/remediation", requireAuth, async (req, res) => {
  const input = z.object({ sessionId: uuid, stage: z.enum(BOOMERANG_STAGES) }).strict().safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid remediation origin" }); return; }
  try {
    res.json(await boomerangRemediation(req.localUser!.id, input.data.sessionId, input.data.stage));
  } catch (error) {
    if (!(error instanceof BoomerangError)) throw error;
    res.status(error.status).json({ error: error.message, code: error.code });
  }
});

router.get("/boomerang/origins", requireAuth, async (req, res) => {
  const owner = req.localUser!.id;
  const [sessions, engagements] = await Promise.all([
    db.select({ id: harnessSessionsTable.id, label: harnessSessionsTable.sessionName })
      .from(harnessSessionsTable).where(eq(harnessSessionsTable.userId, owner)).orderBy(desc(harnessSessionsTable.updatedAt)),
    db.select({ id: f0EngagementsTable.id, label: f0EngagementsTable.title })
      .from(f0EngagementsTable).where(eq(f0EngagementsTable.userId, owner)).orderBy(desc(f0EngagementsTable.updatedAt)),
  ]);
  res.json({ origins: [
    ...sessions.map((item) => ({ ...item, kind: "SESSION" })),
    ...engagements.map((item) => ({ ...item, kind: "F0" })),
  ], stages: BOOMERANG_STAGES });
});

router.get("/boomerang/cases", requireAuth, async (req, res) => {
  const parsed = filters.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid Boomerang filters" }); return; }
  const { originKind, originId, stage, offset } = parsed.data;
  const rows = await db.select().from(boomerangCasesTable).where(and(
    eq(boomerangCasesTable.userId, req.localUser!.id),
    originKind ? eq(boomerangCasesTable.originKind, originKind) : undefined,
    originId ? eq(boomerangCasesTable.originId, originId) : undefined,
    stage ? eq(boomerangCasesTable.stage, stage) : undefined,
  )).orderBy(desc(boomerangCasesTable.createdAt), desc(boomerangCasesTable.id)).limit(50).offset(offset);
  const origins = new Map<string, ReturnType<typeof boomerangOrigin>>();
  res.json(await Promise.all(rows.map(async (row) => {
    const key = `${row.originKind}:${row.originId}:${row.stage}`;
    const supportOutput = returnedSupportOutputId(row);
    const originKey = `${key}:${supportOutput ?? ""}`;
    if (!origins.has(originKey)) origins.set(originKey, boomerangOrigin(db, row.userId, row.originKind, row.originId, row.stage, supportOutput));
    const origin = await origins.get(originKey)!.catch((error) => {
      if (error instanceof BoomerangError && error.status === 404) return null;
      throw error;
    });
    return boomerangResponse(row, origin);
  })));
});

router.post("/boomerang/cases", requireAuth, async (req, res) => {
  const parsed = CreateBoomerangCaseBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid supporting-work request" }); return; }
  const input = parsed.data;
  if (input.title.trim().length < 3 || input.brief.trim().length < 10) {
    res.status(400).json({ error: "A title and a specific supporting-work brief are required" }); return;
  }
  try {
    const origin = await boomerangOrigin(db, req.localUser!.id, input.originKind, input.originId, input.stage);
    const [row] = await db.insert(boomerangCasesTable).values({
      userId: req.localUser!.id, ...input, title: input.title.trim(), brief: input.brief.trim(),
      sourceHash: origin.hash, sourceRefs: origin.refs,
      history: [{ action: "REQUESTED", at: new Date().toISOString(), note: input.brief.trim(),
        resultHash: null, resultText: null, spcPlayerRunId: null }],
    }).returning();
    res.status(201).json(await boomerangResponse(row!, origin));
  } catch (error) {
    if (!(error instanceof BoomerangError)) throw error;
    res.status(error.status).json({ error: error.message, code: error.code });
  }
});

router.post("/boomerang/cases/:id/transition", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  const parsed = TransitionBoomerangCaseBody.strict().safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: "Invalid Boomerang transition" }); return; }
  const input = parsed.data;
  const owner = req.localUser!.id;
  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(boomerangCasesTable).where(and(
        eq(boomerangCasesTable.id, id.data), eq(boomerangCasesTable.userId, owner),
      )).for("update").limit(1);
      if (!row) throw new BoomerangError(404, "CASE_NOT_FOUND", "Supporting-work request not found");
      if (row.version !== input.expectedVersion) throw new BoomerangError(409, "STALE_VERSION", "This request changed. Refresh before taking another action.");
      const origin = await boomerangOrigin(tx, owner, row.originKind, row.originId, row.stage, returnedSupportOutputId(row)).catch((error) => {
        if (error instanceof BoomerangError && error.status === 404) return null;
        throw error;
      });
      assertBoomerangTransition(row.state, input.action, !origin || origin.hash !== row.sourceHash);
      if (["REQUEST_REVISION", "REJECT"].includes(input.action) && !input.note?.trim()) {
        throw new BoomerangError(400, "NOTE_REQUIRED", "Explain the requested revision or rejection");
      }
      let resultText = row.resultText;
      let resultHash = row.resultHash;
      let runId = row.spcPlayerRunId;
      if (input.action !== "RETURN" && (input.resultText !== undefined || input.spcPlayerRunId !== undefined)) {
        throw new BoomerangError(400, "UNEXPECTED_RESULT", "A review decision cannot replace returned evidence");
      }
      if (input.action === "RETURN") {
        if (row.originKind === "SESSION") {
          // Serialize returned candidates with Player and F8 repair numbering.
          await tx.select({ id: harnessSessionsTable.id }).from(harnessSessionsTable).where(and(
            eq(harnessSessionsTable.id, row.originId), eq(harnessSessionsTable.userId, owner),
          )).for("update");
        }
        if (Boolean(input.resultText?.trim()) === Boolean(input.spcPlayerRunId)) {
          throw new BoomerangError(400, "RESULT_REQUIRED", "Return either supporting text or one completed owned SPC Player run");
        }
        runId = input.spcPlayerRunId ?? null;
        if (runId) {
          const [draft] = await tx.select().from(spcPlayerDraftRunsTable).where(and(
            eq(spcPlayerDraftRunsTable.id, runId), eq(spcPlayerDraftRunsTable.ownerUserId, owner),
          )).limit(1);
          const [execution] = await tx.select().from(spcPlayerRunsTable).where(and(
            eq(spcPlayerRunsTable.id, runId), eq(spcPlayerRunsTable.userId, owner),
          )).limit(1);
          if (!draft || execution?.status !== "completed" || !execution.outputPackage) {
            throw new BoomerangError(404, "COMPLETED_RUN_NOT_FOUND", "Completed owned SPC Player run not found");
          }
          if (draft.originSessionId && (row.originKind !== "SESSION" ||
            draft.originSessionId !== row.originId || BOOMERANG_FEATURES[row.stage] !== draft.originFeatureId)) {
            throw new BoomerangError(409, "RUN_ORIGIN_MISMATCH", "This SPC Player run belongs to another origin");
          }
          const departure = (draft.governance as { boomerangBaseline?: { hash: string } }).boomerangBaseline;
          if (departure && departure.hash !== row.sourceHash) {
            throw new BoomerangError(409, "RUN_BASELINE_MISMATCH", "This run was prepared against a different source baseline. Use current supporting work rather than relabelling stale evidence.");
          }
          if (draft.sourceArtifactId) {
            const [source] = await tx.select().from(harnessArtifactsTable).where(and(
              eq(harnessArtifactsTable.id, draft.sourceArtifactId), eq(harnessArtifactsTable.userId, owner),
            )).limit(1);
            if (!source || row.originKind !== "SESSION" || source.sessionId !== row.originId) {
              throw new BoomerangError(409, "RUN_ORIGIN_MISMATCH", "The run source does not belong to this origin");
            }
          }
          resultText = JSON.stringify(execution.outputPackage, null, 2);
          if (resultText.length > 40_000) throw new BoomerangError(400, "RESULT_TOO_LARGE", "This package exceeds the return limit. Return a bounded supporting summary instead.");
        } else {
          resultText = input.resultText!.trim();
          if (resultText.length < 10) throw new BoomerangError(400, "RESULT_REQUIRED", "Return at least 10 characters of supporting work");
        }
        resultHash = boomerangHash({ resultText, runId, sourceHash: row.sourceHash });
        const featureId = BOOMERANG_FEATURES[row.stage];
        if (row.originKind === "SESSION" && featureId) {
          const candidates = await tx.select().from(harnessArtifactsTable).where(and(
            eq(harnessArtifactsTable.sessionId, row.originId), eq(harnessArtifactsTable.userId, owner),
          ));
          const source = resolveSpcPlayerSource(candidates, { sessionId: row.originId, featureId });
          if (source) {
            const upgrade = await nextBoomerangUpgrade(tx, source);
            const [artifact] = await tx.insert(harnessArtifactsTable).values({
              sessionId: row.originId, userId: owner, featureId, artifactType: "SPC_PLAYER_SUPPORT",
              name: `${upgrade.rootName} · ${upgrade.label}`, parentArtifactId: source.id,
              artifactContent: {
                boomerangCaseId: row.id, sourceArtifactId: source.id, spcPlayerRunId: runId,
                boomerangUpgrade: { ...upgrade, originFeatureId: featureId },
                resultText, advisoryOnly: true, planOnly: true, reviewRequired: true,
                certifies: false, advancesStage: false,
              }, scorecards: [],
            }).returning();
            await captureArtifactPersisted(tx, artifact!);
          }
        }
      }
      const states: Record<string, string> = {
        RETURN: "RETURNED", ACCEPT: "ACCEPTED", REQUEST_REVISION: "REVISION_REQUESTED",
        REJECT: "REJECTED", CANCEL: "CANCELLED",
      };
      const history = row.history as unknown[];
      if (history.length >= 100) throw new BoomerangError(409, "HISTORY_LIMIT", "This request reached its review limit; start a fresh request.");
      if (JSON.stringify(history).length + (input.action === "RETURN" ? resultText?.length ?? 0 : 0) > 160_000) {
        throw new BoomerangError(409, "HISTORY_LIMIT", "This request reached its evidence-history limit; start a fresh request and retain this one as history.");
      }
      const [updated] = await tx.update(boomerangCasesTable).set({
        state: states[input.action], version: row.version + 1, resultText, resultHash, spcPlayerRunId: runId,
        history: [...history, { action: input.action, at: new Date().toISOString(), note: input.note?.trim() ?? "",
          resultHash, resultText: input.action === "RETURN" ? resultText : null, spcPlayerRunId: runId }],
      }).where(eq(boomerangCasesTable.id, row.id)).returning();
      return boomerangResponse(updated!, origin, tx);
    });
    res.json(result);
  } catch (error) {
    if (!(error instanceof BoomerangError)) throw error;
    res.status(error.status).json({ error: error.message, code: error.code });
  }
});

export default router;
