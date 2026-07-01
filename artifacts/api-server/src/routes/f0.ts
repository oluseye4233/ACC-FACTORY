import { Router, type IRouter, type RequestHandler } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  f0EngagementsTable,
  f0ReportsTable,
  f0RetainersTable,
  f0RetainerTasksTable,
  harnessArtifactsTable,
  harnessSessionsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireCostBudget } from "../lib/cost-budget";
import {
  CreateF0EngagementBody,
  RecordF0DiscoveryBody,
  CreateF0RetainerBody,
  CreateF0RetainerTaskBody,
  UpdateF0RetainerTaskBody,
} from "@workspace/api-zod";
import {
  handleF0GenerateDiscovery,
  handleF0GenerateChallenge,
  handleF0GenerateReportStream,
  handleF0GenerateCommentary,
  handleF0GenerateMonitoring,
  ownedEngagementOr404,
  ownedRetainerOr404,
} from "../engines/f0";

const router: IRouter = Router();

/**
 * F0 · Business Intelligence Consulting Layer (Domain 23).
 *
 * F0 is a boutique advisory layer OUTSIDE the F1–F9 production floor; it reads
 * production artifacts but never writes them. Access is open to all staff (no
 * tier gate); billing is dormant behind SUBSCRIPTIONS_ENABLED, so no per-report
 * charge is levied today.
 *
 * Middleware order is `requireAuth → requireCostBudget → handler`. F0 is a
 * boutique advisory side-step OUTSIDE the F1–F9 production floor, so — exactly
 * like the other off-floor LLM surfaces (INGESTION, CARTRIDGE, and the f6-vdj /
 * pfp / host-dj side-steps) — it deliberately has NO per-day `rateLimit`: that
 * gate is keyed to production feature ids 1–8 and would wrongly consume a
 * production engine's daily quota. The `requireCostBudget` gate mounts AFTER
 * auth (where `rateLimit` would sit if F0 were on-floor) so runaway advisory
 * spend is still caught by the company-wide monthly cost cap. If F0 is ever
 * promoted to a rate-limited surface, `rateLimit(...)` slots in BEFORE
 * `requireCostBudget`, preserving the canonical order.
 */
function f0LlmRoute(handler: RequestHandler): RequestHandler[] {
  return [requireAuth, requireCostBudget, handler];
}

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get("/f0/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const [engagements, retainers, reportAgg, taskAgg] = await Promise.all([
    db
      .select()
      .from(f0EngagementsTable)
      .where(eq(f0EngagementsTable.userId, userId))
      .orderBy(desc(f0EngagementsTable.createdAt)),
    db
      .select()
      .from(f0RetainersTable)
      .where(eq(f0RetainersTable.userId, userId))
      .orderBy(desc(f0RetainersTable.createdAt)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        accrued: sql<string>`coalesce(sum(${f0ReportsTable.accruedCostUsd}), 0)::text`,
      })
      .from(f0ReportsTable)
      .where(eq(f0ReportsTable.userId, userId)),
    db
      .select({ accrued: sql<string>`coalesce(sum(${f0RetainerTasksTable.estCostUsd}), 0)::text` })
      .from(f0RetainerTasksTable)
      .where(eq(f0RetainerTasksTable.userId, userId)),
  ]);
  res.json({
    engagements,
    retainers,
    totals: {
      engagementCount: engagements.length,
      reportCount: reportAgg[0]?.count ?? 0,
      accruedReportCostUsd: reportAgg[0]?.accrued ?? "0",
      accruedTaskCostUsd: taskAgg[0]?.accrued ?? "0",
    },
  });
});

// ── Engagements ──────────────────────────────────────────────────────────────

router.get("/f0/engagements", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(f0EngagementsTable)
    .where(eq(f0EngagementsTable.userId, req.localUser!.id))
    .orderBy(desc(f0EngagementsTable.createdAt));
  res.json(rows);
});

router.post("/f0/engagements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateF0EngagementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  // Only allow linking to a session / artifact the caller actually owns, so an
  // attacker cannot bind an engagement to another user's resource (and thereby
  // read its SKU at report time). Unknown/foreign ids are rejected, not silently
  // dropped, so callers get a clear signal.
  if (parsed.data.sessionId) {
    const owned = await db
      .select({ id: harnessSessionsTable.id })
      .from(harnessSessionsTable)
      .where(and(eq(harnessSessionsTable.id, parsed.data.sessionId), eq(harnessSessionsTable.userId, userId)))
      .limit(1);
    if (!owned[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
  }
  if (parsed.data.artifactId) {
    const owned = await db
      .select({ id: harnessArtifactsTable.id })
      .from(harnessArtifactsTable)
      .where(and(eq(harnessArtifactsTable.id, parsed.data.artifactId), eq(harnessArtifactsTable.userId, userId)))
      .limit(1);
    if (!owned[0]) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
  }
  const rows = await db
    .insert(f0EngagementsTable)
    .values({
      userId,
      title: parsed.data.title,
      sessionId: parsed.data.sessionId ?? null,
      artifactId: parsed.data.artifactId ?? null,
    })
    .returning();
  res.status(201).json(rows[0]);
});

router.get("/f0/engagements/:id", requireAuth, async (req, res): Promise<void> => {
  const guard = await ownedEngagementOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const reports = await db
    .select()
    .from(f0ReportsTable)
    .where(eq(f0ReportsTable.engagementId, guard.engagement.id))
    .orderBy(desc(f0ReportsTable.createdAt));
  res.json({ engagement: guard.engagement, reports });
});

router.put("/f0/engagements/:id/discovery", requireAuth, async (req, res): Promise<void> => {
  const parsed = RecordF0DiscoveryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedEngagementOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  // SOCRATES integrity: answers may only be recorded against a discovery that
  // was actually generated. This is what makes "every engagement opens with
  // SOCRATES" non-bypassable — without the generated 7-question set there is
  // nothing to answer, so ad-hoc answers (and therefore reports) are refused.
  const existing = (guard.engagement.discoveryTranscript ?? {}) as {
    intro?: unknown;
    questions?: Array<{ id?: unknown }>;
    answers?: unknown[];
  };
  const questions = Array.isArray(existing.questions) ? existing.questions : [];
  if (questions.length !== 7) {
    res.status(409).json({
      error: "DISCOVERY_NOT_STARTED",
      detail: "Generate the SOCRATES 7-question discovery before recording answers.",
    });
    return;
  }
  const questionIds = new Set(questions.map((q) => String(q.id)));
  const unknownIds = parsed.data.answers.filter((a) => !questionIds.has(a.id)).map((a) => a.id);
  if (unknownIds.length > 0) {
    res.status(400).json({
      error: "UNKNOWN_QUESTION_ID",
      detail: `Answers reference question ids that were not generated: ${unknownIds.join(", ")}`,
    });
    return;
  }
  const transcript = { ...existing, answers: parsed.data.answers };
  // Recording answers advances the engagement out of DISCOVERY.
  const nextStatus = guard.engagement.status === "DISCOVERY" ? "ACTIVE" : guard.engagement.status;
  const rows = await db
    .update(f0EngagementsTable)
    .set({ discoveryTranscript: transcript, status: nextStatus })
    .where(eq(f0EngagementsTable.id, guard.engagement.id))
    .returning();
  res.json(rows[0]);
});

router.post("/f0/engagements/:id/discovery/generate", ...f0LlmRoute(handleF0GenerateDiscovery));
router.post("/f0/engagements/:id/reports", ...f0LlmRoute(handleF0GenerateReportStream));
router.post("/f0/engagements/:id/challenge", ...f0LlmRoute(handleF0GenerateChallenge));

// ── Retainers ────────────────────────────────────────────────────────────────

router.get("/f0/retainers", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(f0RetainersTable)
    .where(eq(f0RetainersTable.userId, req.localUser!.id))
    .orderBy(desc(f0RetainersTable.createdAt));
  res.json(rows);
});

router.post("/f0/retainers", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateF0RetainerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .insert(f0RetainersTable)
    .values({
      userId: req.localUser!.id,
      title: parsed.data.title,
      sessionId: parsed.data.sessionId ?? null,
    })
    .returning();
  res.status(201).json(rows[0]);
});

router.get("/f0/retainers/:id", requireAuth, async (req, res): Promise<void> => {
  const guard = await ownedRetainerOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const tasks = await db
    .select()
    .from(f0RetainerTasksTable)
    .where(eq(f0RetainerTasksTable.retainerId, guard.retainer.id))
    .orderBy(desc(f0RetainerTasksTable.createdAt));
  res.json({ retainer: guard.retainer, tasks });
});

router.post("/f0/retainers/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateF0RetainerTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedRetainerOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const rows = await db
    .insert(f0RetainerTasksTable)
    .values({
      retainerId: guard.retainer.id,
      userId: guard.retainer.userId,
      title: parsed.data.title,
      detail: parsed.data.detail ?? "",
      stage: parsed.data.stage ?? null,
      estCostUsd: parsed.data.estCostUsd != null ? String(parsed.data.estCostUsd) : "0",
    })
    .returning();
  res.status(201).json(rows[0]);
});

router.put("/f0/retainers/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateF0RetainerTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedRetainerOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const rows = await db
    .update(f0RetainerTasksTable)
    .set({ status: parsed.data.status })
    .where(
      and(
        eq(f0RetainerTasksTable.id, String(req.params.taskId)),
        eq(f0RetainerTasksTable.retainerId, guard.retainer.id),
      ),
    )
    .returning();
  if (!rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(rows[0]);
});

router.post("/f0/retainers/:id/commentary", ...f0LlmRoute(handleF0GenerateCommentary));
router.post("/f0/retainers/:id/monitoring", ...f0LlmRoute(handleF0GenerateMonitoring));

export default router;
