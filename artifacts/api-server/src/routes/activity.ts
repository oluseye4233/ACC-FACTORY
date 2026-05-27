import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import {
  db,
  harnessEngineRunsTable,
  stripeWebhookEventsTable,
  usersTable,
  organizationsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { memberRole, memberUserIdsForOrgs } from "../lib/orgs";

const router: IRouter = Router();

const FilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  engineId: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(",")
            .map((x) => Number.parseInt(x.trim(), 10))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 32)
        : undefined,
    ),
  sessionId: z.string().uuid().optional(),
  source: z.enum(["engine", "billing"]).optional(),
  status: z.string().optional(),
  userIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : undefined)),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  format: z.enum(["json", "csv"]).default("json"),
});
type Filter = z.infer<typeof FilterSchema>;

interface ActivityRow {
  source: "engine" | "billing";
  ts: string;
  userId: string | null;
  userEmail: string | null;
  engineId: number | null;
  sessionId: string | null;
  status: string;
  provider: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  durationMs: number | null;
  eventType: string | null;
  eventId: string | null;
}

/**
 * Loads a unioned activity view for the supplied user-id set, applying filters.
 * Stripe webhook events are scoped to the user via their `stripeCustomerId` join
 * through `command_centre_subscribers` so the activity surface stays user-owned.
 */
async function loadActivity(
  userIds: string[],
  filter: Filter,
): Promise<{ rows: ActivityRow[]; total: number }> {
  if (userIds.length === 0) return { rows: [], total: 0 };

  const conditions: ReturnType<typeof sql>[] = [];
  conditions.push(sql`r.user_id = ANY(${userIds}::uuid[])`);
  if (filter.from) conditions.push(sql`r.created_at >= ${filter.from}`);
  if (filter.to) conditions.push(sql`r.created_at <= ${filter.to}`);
  if (filter.engineId && filter.engineId.length > 0)
    conditions.push(sql`r.engine_id = ANY(${filter.engineId}::int[])`);
  if (filter.sessionId) conditions.push(sql`r.session_id = ${filter.sessionId}`);
  const engineWhere = conditions.length
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const billingConditions: ReturnType<typeof sql>[] = [];
  billingConditions.push(sql`s.user_id = ANY(${userIds}::uuid[])`);
  if (filter.from) billingConditions.push(sql`e.received_at >= ${filter.from}`);
  if (filter.to) billingConditions.push(sql`e.received_at <= ${filter.to}`);
  // Status filter applies to billing rows by matching on event type
  // (e.g. invoice.paid, customer.subscription.deleted). Engine rows
  // are always 'ok' so a status filter implicitly hides them.
  if (filter.status) billingConditions.push(sql`e.type = ${filter.status}`);
  const billingWhere = billingConditions.length
    ? sql`WHERE ${sql.join(billingConditions, sql` AND `)}`
    : sql``;

  // A status filter only makes sense for billing rows — silently drop
  // engine rows so the response is internally consistent.
  const sourceFilter = filter.status ? "billing" : filter.source;

  // CTE: engine_runs + billing_events → UNION ALL → order + paginate.
  const query = sql`
    WITH engine_rows AS (
      SELECT
        'engine'::text AS source,
        r.created_at AS ts,
        r.user_id,
        u.email AS user_email,
        r.engine_id,
        r.session_id,
        'ok'::text AS status,
        r.provider,
        r.model_id,
        r.input_tokens,
        r.output_tokens,
        r.cost_usd::text AS cost_usd,
        r.duration_ms,
        NULL::text AS event_type,
        NULL::text AS event_id
      FROM ${harnessEngineRunsTable} r
      JOIN ${usersTable} u ON u.id = r.user_id
      ${engineWhere}
    ),
    billing_rows AS (
      SELECT
        'billing'::text AS source,
        e.received_at AS ts,
        s.user_id,
        u.email AS user_email,
        NULL::int AS engine_id,
        NULL::uuid AS session_id,
        e.type AS status,
        NULL::text AS provider,
        NULL::text AS model_id,
        NULL::int AS input_tokens,
        NULL::int AS output_tokens,
        NULL::text AS cost_usd,
        NULL::int AS duration_ms,
        e.type AS event_type,
        e.event_id AS event_id
      FROM ${stripeWebhookEventsTable} e
      JOIN command_centre_subscribers s
        ON s.stripe_customer_id = e.customer_id
      JOIN ${usersTable} u ON u.id = s.user_id
      ${billingWhere}
    ),
    all_rows AS (
      ${sourceFilter === "billing" ? sql`SELECT * FROM billing_rows` : sql``}
      ${sourceFilter === "engine" ? sql`SELECT * FROM engine_rows` : sql``}
      ${
        !sourceFilter
          ? sql`SELECT * FROM engine_rows UNION ALL SELECT * FROM billing_rows`
          : sql``
      }
    )
    SELECT
      (SELECT COUNT(*) FROM all_rows)::bigint AS _total,
      a.*
    FROM all_rows a
    ORDER BY ts DESC
    LIMIT ${filter.limit} OFFSET ${filter.offset}
  `;

  const result = (await db.execute(query)) as unknown as {
    rows: Array<Record<string, unknown>>;
  };
  const rows: ActivityRow[] = [];
  let total = 0;
  for (const r of result.rows) {
    total = Number(r._total ?? 0);
    rows.push({
      source: r.source as "engine" | "billing",
      ts: (r.ts as Date).toISOString(),
      userId: (r.user_id as string | null) ?? null,
      userEmail: (r.user_email as string | null) ?? null,
      engineId: r.engine_id == null ? null : Number(r.engine_id),
      sessionId: (r.session_id as string | null) ?? null,
      status: String(r.status ?? ""),
      provider: (r.provider as string | null) ?? null,
      modelId: (r.model_id as string | null) ?? null,
      inputTokens: r.input_tokens == null ? null : Number(r.input_tokens),
      outputTokens: r.output_tokens == null ? null : Number(r.output_tokens),
      costUsd: (r.cost_usd as string | null) ?? null,
      durationMs: r.duration_ms == null ? null : Number(r.duration_ms),
      eventType: (r.event_type as string | null) ?? null,
      eventId: (r.event_id as string | null) ?? null,
    });
  }
  return { rows, total };
}

function rowsToCsv(rows: ActivityRow[]): string {
  const header = [
    "ts",
    "source",
    "userEmail",
    "engineId",
    "sessionId",
    "status",
    "provider",
    "modelId",
    "inputTokens",
    "outputTokens",
    "costUsd",
    "durationMs",
    "eventType",
    "eventId",
  ];
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.ts,
        r.source,
        r.userEmail,
        r.engineId,
        r.sessionId,
        r.status,
        r.provider,
        r.modelId,
        r.inputTokens,
        r.outputTokens,
        r.costUsd,
        r.durationMs,
        r.eventType,
        r.eventId,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}

router.get("/me/activity", requireAuth, async (req, res): Promise<void> => {
  const parsed = FilterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const { rows, total } = await loadActivity([userId], parsed.data);
  if (parsed.data.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="activity-${userId.slice(0, 8)}.csv"`,
    );
    res.send(rowsToCsv(rows));
    return;
  }
  res.json({ rows, total, limit: parsed.data.limit, offset: parsed.data.offset });
});

router.get("/orgs/:id/activity", requireAuth, async (req, res): Promise<void> => {
  const orgId = String(req.params.id);
  const callerId = req.localUser!.id;
  const role = await memberRole(callerId, orgId);
  if (!role) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Owner or admin role required" });
    return;
  }
  const parsed = FilterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let memberIds = await memberUserIdsForOrgs([orgId]);
  // Optional userIds filter: must be subset of org members (no cross-org leakage).
  if (parsed.data.userIds && parsed.data.userIds.length > 0) {
    const allowed = new Set(memberIds);
    memberIds = parsed.data.userIds.filter((id) => allowed.has(id));
  }
  const { rows, total } = await loadActivity(memberIds, parsed.data);
  if (parsed.data.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="org-activity-${orgId.slice(0, 8)}.csv"`,
    );
    res.send(rowsToCsv(rows));
    return;
  }
  res.json({ rows, total, limit: parsed.data.limit, offset: parsed.data.offset });
});

// Suppress unused-import warning for `organizationsTable`.
void organizationsTable;

export default router;
