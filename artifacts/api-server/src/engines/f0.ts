import { z } from "zod/v4";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  f0EngagementsTable,
  f0MonitoringRunsTable,
  f0ReportsTable,
  f0RetainersTable,
  harnessArtifactsTable,
  type F0MonitoringRun,
  type F0MonitoringUrgency,
  type F0MonitoringSource,
  type F0Engagement,
  type F0Retainer,
  type F0Service,
} from "@workspace/db";
import {
  GenerateF0DiscoveryBody,
  GenerateF0ReportBody,
  GenerateF0ChallengeBody,
  GenerateF0CommentaryBody,
  GenerateF0MonitoringBody,
} from "@workspace/api-zod";
import {
  F0_SOCRATES_DISCOVERY_SYSTEM,
  F0_SOCRATES_CHALLENGE_SYSTEM,
  F0_REPORT_SYSTEM,
  F0_RETAINER_COMMENTARY_SYSTEM,
  F0_MONITORING_SYSTEM,
} from "./prompts";
import {
  callLlmJson,
  resolveProvider,
  sendProviderTierError,
  ProviderRequiresTierError,
  ProviderNotConfiguredError,
} from "./shared";
import { issueF0ReportCode, issueAdvisorySku } from "../lib/sku";
import { currentMonthCostGlobal, globalMonthlyCostCapUsd } from "../lib/cost-budget";
import { dispatchRetainerMonitoringAlert } from "../lib/notification-dispatch";
import { logger } from "../lib/logger";

// F0 telemetry engine IDs, kept distinct from the production floor (F1..F7=1..7,
// F6-VDJ=8, F8 Code DJ=9, ATLAS J=10, PFP=11, Host DJ=12). F0 is an advisory
// side-step: cost-gated, never per-day rate-limited.
const F0_ENGINE = {
  DISCOVERY: 20,
  REPORT: 21,
  CHALLENGE: 22,
  COMMENTARY: 23,
  MONITORING: 24,
} as const;

/** Short `[CODE]` component per F0 service, used to mint the report code. */
const SERVICE_CODE: Record<F0Service, string> = {
  PRODUCT_VIABILITY: "F0-PV",
  MARKET_VIABILITY: "F0-MV",
  CAPI_POSITIONING: "F0-CAP",
  CUSTOMER_ACQUISITION: "F0-CAQ",
  GO_TO_MARKET: "F0-GTM",
  FINANCIAL_PROJECTIONS: "F0-FIN",
  PRODUCT_SYNTHESIS_ADVISORY: "F0-PSA",
  OFFICER_ANALYSIS: "F0-OA",
  COMPETITIVE_TEARDOWN: "F0-CT",
  PRICING_STRATEGY: "F0-PS",
  BRAND_NARRATIVE: "F0-BN",
  INVESTOR_READINESS: "F0-IR",
  MATHMON_MAX: "F0-MMX",
  EVE_MAX: "F0-EMX",
} as const;

/**
 * Service-specific briefs for the high-level ULTRA SI services. Appended to the
 * report user prompt so the ensemble reframes the SAME report contract through
 * each service's invariant-first lens without changing the response schema.
 */
const SERVICE_GUIDANCE: Partial<Record<F0Service, string>> = {
  MATHMON_MAX: [
    "MATHMON MAX ULTRA SI — The Infinite Architect Ascendant.",
    "Universal quantitative reasoning. Before advising, hunt the Minimal",
    "Sufficient Description (MSD): the irreducible governing invariant of the",
    "operator's domain, and let every finding, financial and recommendation",
    "follow from it. Distinguish HARD CEILINGS (physical/mathematical limits",
    "that cannot be crossed) from SOFT BOUNDARIES (assumptions that can flex).",
    "Keep quantitative claims range-honest.",
  ].join(" "),
  EVE_MAX: [
    "EVE MAX ULTRA SI — The Financial Sovereign Ascendant.",
    "Invariant-first enterprise valuation via VOLUMETRICS MAX and the Value",
    "Osmosis Engine (EVC / EOP / flow-rate). Treat conservation of enterprise",
    "value across every transformation as the invariant and drive the",
    "bear/base/bull financials from it. Every valuation figure is a modelled",
    "range with its assumptions, never a single point estimate.",
  ].join(" "),
};

// ── ownership helpers ────────────────────────────────────────────────────────

export async function ownedEngagementOr404(
  req: Request,
  id: string,
): Promise<{ ok: true; engagement: F0Engagement } | { ok: false; status: number; error: string }> {
  const userId = req.localUser?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const rows = await db
    .select()
    .from(f0EngagementsTable)
    .where(and(eq(f0EngagementsTable.id, id), eq(f0EngagementsTable.userId, userId)))
    .limit(1);
  const engagement = rows[0];
  if (!engagement) return { ok: false, status: 404, error: "Engagement not found" };
  return { ok: true, engagement };
}

export async function ownedRetainerOr404(
  req: Request,
  id: string,
): Promise<{ ok: true; retainer: F0Retainer } | { ok: false; status: number; error: string }> {
  const userId = req.localUser?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const rows = await db
    .select()
    .from(f0RetainersTable)
    .where(and(eq(f0RetainersTable.id, id), eq(f0RetainersTable.userId, userId)))
    .limit(1);
  const retainer = rows[0];
  if (!retainer) return { ok: false, status: 404, error: "Retainer not found" };
  return { ok: true, retainer };
}

/** Compose the engagement context block every F0 prompt is grounded in. */
async function engagementContext(engagement: F0Engagement, extra?: string | null): Promise<string> {
  let artifactContext: string | null = null;
  if (engagement.artifactId) {
    const rows = await db
      .select({
        id: harnessArtifactsTable.id,
        artifactType: harnessArtifactsTable.artifactType,
        name: harnessArtifactsTable.name,
        artifactContent: harnessArtifactsTable.artifactContent,
      })
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.id, engagement.artifactId),
          eq(harnessArtifactsTable.userId, engagement.userId),
        ),
      )
      .limit(1);
    const artifact = rows[0];
    if (artifact) {
      artifactContext = [
        `SELECTED PROJECT ARTIFACT: ${artifact.artifactType}${artifact.name ? ` · ${artifact.name}` : ""}`,
        `ARTIFACT ID: ${artifact.id}`,
        `ARTIFACT CONTENT:\n${JSON.stringify(artifact.artifactContent)}`,
        "Treat this selected artifact as the primary project source for the requested advisory service.",
      ].join("\n");
    }
  }
  return [
    `ENGAGEMENT TITLE: ${engagement.title}`,
    engagement.discoveryTranscript
      ? `SOCRATES DISCOVERY TRANSCRIPT:\n${JSON.stringify(engagement.discoveryTranscript, null, 2)}`
      : "SOCRATES DISCOVERY TRANSCRIPT: (not yet recorded)",
    extra ? `OPERATOR NOTES: ${extra}` : null,
    artifactContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── SOCRATES discovery (JSON) ────────────────────────────────────────────────

const DiscoverySchema = z.object({
  intro: z.string(),
  questions: z
    .array(z.object({ id: z.string(), prompt: z.string(), why: z.string() }))
    .length(7),
});

export async function handleF0GenerateDiscovery(req: Request, res: Response): Promise<void> {
  const parsed = GenerateF0DiscoveryBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedEngagementOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, parsed.data.provider, "claude");
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }
  let out: z.infer<typeof DiscoverySchema>;
  try {
    out = await callLlmJson(
      provider,
      F0_SOCRATES_DISCOVERY_SYSTEM,
       await engagementContext(guard.engagement, parsed.data.notes),
      DiscoverySchema,
      { sessionId: guard.engagement.sessionId, userId: guard.engagement.userId, engineId: F0_ENGINE.DISCOVERY },
    );
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F0 discovery generation failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const transcript = { intro: out.intro, questions: out.questions, answers: [] as unknown[] };
  const rows = await db
    .update(f0EngagementsTable)
    .set({ discoveryTranscript: transcript })
    .where(eq(f0EngagementsTable.id, guard.engagement.id))
    .returning();
  res.json(rows[0]);
}

// ── SOCRATES challenge close (JSON) ──────────────────────────────────────────

const ChallengeSchema = z.object({
  challenge: z.string(),
  killCriteria: z.array(z.string()).min(3).max(6),
  proceedConditions: z.array(z.string()).min(2).max(4),
  closingCounsel: z.string(),
});

export async function handleF0GenerateChallenge(req: Request, res: Response): Promise<void> {
  const parsed = GenerateF0ChallengeBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedEngagementOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, parsed.data.provider, "claude");
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }
  // Include any generated reports so the challenge is grounded in real analysis.
  const reports = await db
    .select({ service: f0ReportsTable.service, content: f0ReportsTable.content })
    .from(f0ReportsTable)
    .where(eq(f0ReportsTable.engagementId, guard.engagement.id));
  const userPrompt = [
    await engagementContext(guard.engagement, parsed.data.notes),
    reports.length
      ? `GENERATED REPORTS SO FAR:\n${JSON.stringify(reports, null, 2)}`
      : "GENERATED REPORTS SO FAR: (none)",
  ].join("\n\n");

  let out: z.infer<typeof ChallengeSchema>;
  try {
    out = await callLlmJson(provider, F0_SOCRATES_CHALLENGE_SYSTEM, userPrompt, ChallengeSchema, {
      sessionId: guard.engagement.sessionId,
      userId: guard.engagement.userId,
      engineId: F0_ENGINE.CHALLENGE,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F0 challenge generation failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  const rows = await db
    .update(f0EngagementsTable)
    .set({ challengeResponse: out, status: "CLOSED" })
    .where(eq(f0EngagementsTable.id, guard.engagement.id))
    .returning();
  res.json(rows[0]);
}

// ── Ensemble report (SSE stream) ─────────────────────────────────────────────

const lineItem = z.object({ label: z.string(), value: z.string() });
const scenario = z.object({
  assumptions: z.array(z.string()),
  lineItems: z.array(lineItem),
});

const ReportSchema = z.object({
  executivePosition: z.string(),
  findings: z
    .array(z.object({ title: z.string(), detail: z.string(), evidenceBasis: z.string() }))
    .min(3)
    .max(8),
  solvaBearCase: z.object({
    thesis: z.string(),
    arguments: z.array(z.string()).min(3).max(6),
  }),
  financials: z.object({
    currency: z.string(),
    scenarios: z.object({ bear: scenario, base: scenario, bull: scenario }),
  }),
  honestyGate: z.object({
    modelledVsSourced: z.string(),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    biggestReasonToDistrust: z.string(),
  }),
  recommendations: z
    .array(z.object({ action: z.string(), rationale: z.string() }))
    .min(2)
    .max(5),
});

const ENSEMBLE_STEPS = [
  { id: "DISCOVERY", label: "Grounding in the SOCRATES discovery transcript" },
  { id: "ENSEMBLE", label: "Convening the 9-SPC ensemble board" },
  { id: "SOLVA", label: "SOLVA bear-case adversary" },
  { id: "FINANCIALS", label: "Range-based financials — bear / base / bull" },
  { id: "HONESTY", label: "Sealing the non-suppressible Honesty Gate" },
  { id: "CODE", label: "Minting the report code" },
] as const;

export async function handleF0GenerateReportStream(req: Request, res: Response): Promise<void> {
  const parsed = GenerateF0ReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedEngagementOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  const { engagement } = guard;
  // No report without a fully completed SOCRATES discovery: the 7 questions must
  // have been generated AND answered. Checking questions (not just answers)
  // closes the bypass where ad-hoc answers could be posted without ever running
  // discovery — every engagement genuinely opens with SOCRATES.
  const transcript = engagement.discoveryTranscript as
    | { questions?: Array<{ id?: unknown }>; answers?: Array<{ id?: unknown; answer?: unknown }> }
    | null
    | undefined;
  const questions =
    !!transcript && Array.isArray(transcript.questions) ? transcript.questions : [];
  const answers = !!transcript && Array.isArray(transcript.answers) ? transcript.answers : [];
  const hasQuestions = questions.length === 7;
  // Discovery is only genuinely complete when every one of the 7 questions has a
  // non-empty answer. Checking `answers.length > 0` was too weak: a single stray
  // answer against six blank questions would pass. We build the set of question
  // ids that carry a substantive (non-whitespace) answer and require it to cover
  // all 7, closing the "one answer, six blanks" bypass.
  const questionIds = questions.map((q) => String(q.id));
  const answeredIds = new Set(
    answers
      .filter((a) => typeof a.answer === "string" && a.answer.trim().length > 0)
      .map((a) => String(a.id)),
  );
  const hasFullCoverage =
    hasQuestions && questionIds.every((id) => answeredIds.has(id));
  if (!hasQuestions || !hasFullCoverage) {
    res.status(409).json({
      error: "DISCOVERY_REQUIRED",
      detail:
        "Complete the SOCRATES discovery (generate the 7 questions, then record an answer for every one) before generating a report.",
    });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, parsed.data.provider, "claude");
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }
  const service = parsed.data.service as F0Service;

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

  const guidance = SERVICE_GUIDANCE[service];
  const userPrompt = [
    `REQUESTED SERVICE: ${service}`,
    guidance ? `SERVICE BRIEF:\n${guidance}` : null,
    await engagementContext(engagement, parsed.data.notes),
  ]
    .filter(Boolean)
    .join("\n\n");

  const llmPromise = callLlmJson(provider, F0_REPORT_SYSTEM, userPrompt, ReportSchema, {
    sessionId: engagement.sessionId,
    userId: engagement.userId,
    engineId: F0_ENGINE.REPORT,
  });

  send("start", { totalSteps: ENSEMBLE_STEPS.length, service });
  for (let i = 0; i < ENSEMBLE_STEPS.length; i++) {
    if (clientClosed) break;
    const s = ENSEMBLE_STEPS[i]!;
    send("step", { index: i, id: s.id, label: s.label, status: "RUNNING" });
    await new Promise((r) => setTimeout(r, 250));
    if (clientClosed) break;
    send("step", { index: i, id: s.id, label: s.label, status: "DONE" });
  }

  let out: z.infer<typeof ReportSchema>;
  try {
    out = await llmPromise;
  } catch (err) {
    const code =
      err instanceof ProviderRequiresTierError
        ? "PROVIDER_REQUIRES_TIER"
        : err instanceof ProviderNotConfiguredError
          ? "PROVIDER_NOT_CONFIGURED"
          : "ENGINE_CALL_FAILED";
    req.log.error({ err, code }, "F0 report generation failed");
    send("error", { error: code, code, detail: (err as Error).message });
    if (!clientClosed) res.end();
    return;
  }

  // ── Mint the report code anchored to the owning SKU ──────────────────────
  // Prefer the linked artifact's SKU; fall back to a minted advisory SKU so the
  // report code always anchors to a real catalog identity (F0-021).
  let sku: string | null = null;
  if (engagement.artifactId) {
    // Scope by owner as well as id: the artifact link is validated at engagement
    // creation, but re-asserting ownership here means a report can never read a
    // foreign artifact's SKU even if the link were somehow tampered with.
    const artRows = await db
      .select({ sku: harnessArtifactsTable.sku })
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.id, engagement.artifactId),
          eq(harnessArtifactsTable.userId, engagement.userId),
        ),
      )
      .limit(1);
    sku = artRows[0]?.sku ?? null;
  }
  if (!sku) sku = await issueAdvisorySku(engagement.userId);
  const reportCodeRow = await issueF0ReportCode({
    userId: engagement.userId,
    sku,
    code: SERVICE_CODE[service],
    artifactId: engagement.artifactId,
  });

  // Persist to the F0 reports table (never a harness artifact). Persist even if
  // the client disconnected — the ensemble work is done and cost was recorded.
  const reportRows = await db
    .insert(f0ReportsTable)
    .values({
      engagementId: engagement.id,
      userId: engagement.userId,
      service,
      reportCode: reportCodeRow.reportCode,
      sku,
      content: out,
    })
    .returning();
  const report = reportRows[0]!;

  // Advance the engagement out of DISCOVERY once real analysis exists.
  if (engagement.status === "DISCOVERY") {
    await db
      .update(f0EngagementsTable)
      .set({ status: "ACTIVE" })
      .where(eq(f0EngagementsTable.id, engagement.id));
  }

  if (clientClosed) return;
  send("complete", { report });
  res.end();
}

// ── Retainer stage commentary (JSON) ─────────────────────────────────────────

const CommentarySchema = z.object({
  stage: z.string(),
  read: z.string(),
  strengths: z.array(z.string()).min(1).max(4),
  watchouts: z.array(z.string()).min(1).max(4),
  oneThingToFix: z.string(),
});

export async function handleF0GenerateCommentary(req: Request, res: Response): Promise<void> {
  const parsed = GenerateF0CommentaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedRetainerOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, parsed.data.provider, "claude");
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }
  // Optionally ground the read in a specific artifact the operator points at.
  let artifactContent: unknown = null;
  if (parsed.data.artifactId) {
    const rows = await db
      .select({ content: harnessArtifactsTable.artifactContent, userId: harnessArtifactsTable.userId })
      .from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.id, parsed.data.artifactId))
      .limit(1);
    if (rows[0] && rows[0].userId === guard.retainer.userId) artifactContent = rows[0].content;
  }
  const userPrompt = [
    `RETAINER: ${guard.retainer.title}`,
    `STAGE UNDER REVIEW: ${parsed.data.stage}`,
    parsed.data.notes ? `OPERATOR NOTES: ${parsed.data.notes}` : null,
    artifactContent
      ? `STAGE ARTIFACT:\n${JSON.stringify(artifactContent, null, 2)}`
      : "STAGE ARTIFACT: (none supplied)",
  ]
    .filter(Boolean)
    .join("\n\n");

  let out: z.infer<typeof CommentarySchema>;
  try {
    out = await callLlmJson(provider, F0_RETAINER_COMMENTARY_SYSTEM, userPrompt, CommentarySchema, {
      sessionId: guard.retainer.sessionId,
      userId: guard.retainer.userId,
      engineId: F0_ENGINE.COMMENTARY,
    });
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F0 commentary generation failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }
  res.json(out);
}

// ── Weekly CAPI monitoring (JSON) ────────────────────────────────────────────

const MonitoringSchema = z.object({
  capiPosture: z.string(),
  movements: z
    .array(z.object({ summary: z.string(), significance: z.enum(["LOW", "MEDIUM", "HIGH"]) }))
    .max(6),
  eventAlerts: z
    .array(
      z.object({
        alert: z.string(),
        urgency: z.enum(["WATCH", "ACT_SOON", "ACT_NOW"]),
        recommendedAction: z.string(),
      }),
    )
    .max(4),
  weeklyCounsel: z.string(),
});

type MonitoringOutput = z.infer<typeof MonitoringSchema>;

const URGENCY_RANK: Record<F0MonitoringUrgency, number> = {
  WATCH: 1,
  ACT_SOON: 2,
  ACT_NOW: 3,
};

/**
 * A monitoring run is a BREACH when it carries at least one event alert with
 * urgency ACT_SOON or ACT_NOW. Returns the breach flag plus the highest urgency
 * seen (null when there are no alerts). This is the single source of truth used
 * by both the on-demand route and the weekly cron sweep.
 */
export function evaluateMonitoringBreach(out: MonitoringOutput): {
  breached: boolean;
  highestUrgency: F0MonitoringUrgency | null;
} {
  let highest: F0MonitoringUrgency | null = null;
  for (const a of out.eventAlerts) {
    if (highest === null || URGENCY_RANK[a.urgency] > URGENCY_RANK[highest]) {
      highest = a.urgency;
    }
  }
  const breached = highest === "ACT_SOON" || highest === "ACT_NOW";
  return { breached, highestUrgency: highest };
}

/** Run the monitoring LLM call for a retainer. Records a harness_engine_runs row. */
async function generateRetainerMonitoring(
  retainer: Pick<F0Retainer, "id" | "title" | "userId" | "sessionId">,
  signals: string | undefined,
  provider: Parameters<typeof callLlmJson>[0],
): Promise<MonitoringOutput> {
  const userPrompt = [
    `RETAINER: ${retainer.title}`,
    signals
      ? `OPERATOR-SUPPLIED SIGNALS (past week):\n${signals}`
      : "OPERATOR-SUPPLIED SIGNALS (past week): (none)",
  ].join("\n\n");
  return callLlmJson(provider, F0_MONITORING_SYSTEM, userPrompt, MonitoringSchema, {
    sessionId: retainer.sessionId,
    userId: retainer.userId,
    engineId: F0_ENGINE.MONITORING,
  });
}

/** Persist a monitoring run (with breach evaluation) and return the stored row. */
async function persistMonitoringRun(
  retainer: Pick<F0Retainer, "id" | "userId">,
  out: MonitoringOutput,
  source: F0MonitoringSource,
): Promise<F0MonitoringRun> {
  const { breached, highestUrgency } = evaluateMonitoringBreach(out);
  const [row] = await db
    .insert(f0MonitoringRunsTable)
    .values({
      retainerId: retainer.id,
      userId: retainer.userId,
      content: out,
      source,
      breached,
      highestUrgency,
    })
    .returning();
  return row!;
}

export async function handleF0GenerateMonitoring(req: Request, res: Response): Promise<void> {
  const parsed = GenerateF0MonitoringBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const guard = await ownedRetainerOr404(req, String(req.params.id));
  if (!guard.ok) {
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  let provider;
  try {
    provider = resolveProvider(req, parsed.data.provider, "claude");
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    throw err;
  }

  let out: MonitoringOutput;
  try {
    out = await generateRetainerMonitoring(guard.retainer, parsed.data.signals, provider);
  } catch (err) {
    if (sendProviderTierError(res, err)) return;
    req.log.error({ err }, "F0 monitoring generation failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  // Persist the run so it surfaces on the dashboard (last-run time + open
  // alerts). On-demand breaches become open alerts but do NOT email the owner —
  // they are looking at the result already; only cron-driven breaches push mail.
  try {
    await persistMonitoringRun(guard.retainer, out, "manual");
  } catch (err) {
    req.log.warn({ err }, "F0 monitoring run persistence failed");
  }
  res.json(out);
}

/**
 * Weekly cron sweep: run CAPI monitoring for every ACTIVE retainer, persist the
 * run, and email the owner on a breach. Skips retainers already swept within the
 * last 6 days (so an extra tick can't double-run), and halts LLM spend the
 * moment the company-wide monthly cost cap is reached.
 */
export async function runF0MonitoringSweep(now: Date = new Date()): Promise<{
  retainersConsidered: number;
  runsExecuted: number;
  breaches: number;
  alertsSent: number;
  skippedRecent: number;
  costCapReached: boolean;
}> {
  const reRunCutoff = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const retainers = await db
    .select()
    .from(f0RetainersTable)
    .where(eq(f0RetainersTable.status, "ACTIVE"))
    .orderBy(f0RetainersTable.createdAt);

  let runsExecuted = 0;
  let breaches = 0;
  let alertsSent = 0;
  let skippedRecent = 0;
  let costCapReached = false;

  const capUsd = globalMonthlyCostCapUsd();
  for (const retainer of retainers) {
    // Re-run guard: skip if a cron run already exists inside the window.
    const recent = await db
      .select({ id: f0MonitoringRunsTable.id })
      .from(f0MonitoringRunsTable)
      .where(
        and(
          eq(f0MonitoringRunsTable.retainerId, retainer.id),
          eq(f0MonitoringRunsTable.source, "cron"),
        ),
      )
      .orderBy(desc(f0MonitoringRunsTable.createdAt))
      .limit(1);
    if (recent[0]) {
      const lastRows = await db
        .select({ createdAt: f0MonitoringRunsTable.createdAt })
        .from(f0MonitoringRunsTable)
        .where(eq(f0MonitoringRunsTable.id, recent[0].id))
        .limit(1);
      const last = lastRows[0]?.createdAt as Date | undefined;
      if (last && last > reRunCutoff) {
        skippedRecent++;
        continue;
      }
    }

    // Cost-cap guard: never start another LLM call once the cap is hit.
    if (Number.isFinite(capUsd)) {
      const used = await currentMonthCostGlobal();
      if (used >= capUsd) {
        costCapReached = true;
        logger.warn(
          { used, capUsd },
          "F0 monitoring sweep halted: company-wide monthly cost cap reached",
        );
        break;
      }
    }

    let out: MonitoringOutput;
    try {
      out = await generateRetainerMonitoring(retainer, undefined, "claude");
    } catch (err) {
      logger.warn({ err, retainerId: retainer.id }, "F0 monitoring sweep: generation failed");
      continue;
    }
    runsExecuted++;

    let run: F0MonitoringRun;
    try {
      run = await persistMonitoringRun(retainer, out, "cron");
    } catch (err) {
      logger.warn({ err, retainerId: retainer.id }, "F0 monitoring sweep: persistence failed");
      continue;
    }

    if (!run.breached) continue;
    breaches++;
    const sent = await dispatchRetainerMonitoringAlert({
      userId: retainer.userId,
      retainerTitle: retainer.title,
      capiPosture: out.capiPosture,
      highestUrgency: run.highestUrgency ?? "ACT_SOON",
      alerts: out.eventAlerts.filter((a) => a.urgency === "ACT_SOON" || a.urgency === "ACT_NOW"),
      weeklyCounsel: out.weeklyCounsel,
      occurredAt: run.createdAt as Date,
    });
    if (sent) {
      alertsSent++;
      await db
        .update(f0MonitoringRunsTable)
        .set({ notifiedAt: new Date() })
        .where(eq(f0MonitoringRunsTable.id, run.id));
    }
  }

  return {
    retainersConsidered: retainers.length,
    runsExecuted,
    breaches,
    alertsSent,
    skippedRecent,
    costCapReached,
  };
}

export { ReportSchema as F0ReportContentSchema };
export const F0_SERVICE_CODE = SERVICE_CODE;
