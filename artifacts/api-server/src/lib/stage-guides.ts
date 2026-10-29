import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, stageGuidesTable as guides } from "@workspace/db";
import { STAGE_GUIDE_CATALOG, stageDefinition, defaultStageScript, type GuideKind } from "./stage-guide-catalog";
import { synthesiaConfigured, synthesiaRequest, SynthesiaError, type SynthesiaVideo } from "./synthesia";

export class StageGuideError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Actor = { id: string; role: string };
type Row = typeof guides.$inferSelect;
const busy = ["SUBMITTING", "GENERATING", "UNKNOWN"];
function requireAdministrator(actor: Actor) {
  if (actor.role !== "ADMIN") throw new StageGuideError(403, "Administrator role required.");
}
function definition(stage: string) {
  try { return stageDefinition(stage); } catch { throw new StageGuideError(400, "Unknown F stage."); }
}
export function stageGuideView(row: Row | undefined, stage: string, kind: GuideKind) {
  const d = definition(stage);
  const published = Boolean(row?.publishedAt && row.state === "COMPLETE" && !row.isTest && row.providerVideoId);
  return {
    id: row?.id ?? null, stageKey: stage, kind, title: `ARK — ${stage} ${d.name} · ${kind === "EXPLAINER" ? "Explainer" : "Worked example"}`,
    script: row?.script ?? defaultStageScript(stage, kind), outcome: d.outcome, limitation: d.limitation,
    version: row?.version ?? 0, state: row?.state ?? "DRAFT", isTest: row?.isTest ?? true, published,
    embedUrl: published ? `https://share.synthesia.io/embeds/videos/${row!.providerVideoId}` : null,
    providerVideoId: row?.providerVideoId ?? null,
  };
}
async function guide(id: string) {
  const [row] = await db.select().from(guides).where(eq(guides.id, id)).limit(1);
  if (!row) throw new StageGuideError(404, "Guide revision not found.");
  return row;
}
export async function stageGuideLibrary(actor: Actor, stage?: string) {
  if (stage) definition(stage);
  const admin = actor.role === "ADMIN";
  const rows = await db.select().from(guides).where(stage ? eq(guides.stageKey, stage) : undefined).orderBy(desc(guides.version));
  const result = STAGE_GUIDE_CATALOG.filter(d => !stage || d[0] === stage).flatMap(d =>
    (["EXPLAINER", "DEMONSTRATION"] as const).map(kind => {
      const row = rows.find(row => row.stageKey === d[0] && row.kind === kind &&
        (admin || (row.publishedAt && row.state === "COMPLETE" && !row.isTest)));
      return stageGuideView(row, d[0], kind);
    }));
  return { configured: synthesiaConfigured(), canManage: admin, guides: result,
    history: admin ? rows.map(row => stageGuideView(row, row.stageKey, row.kind as GuideKind)) : [] };
}
export async function saveStageGuide(actor: Actor, input: { stageKey: string; kind: GuideKind; script: string }) {
  requireAdministrator(actor); definition(input.stageKey);
  if (input.script.trim().length < 40 || input.script.length > 1800 || input.script.trim().split(/\s+/).length > 200) {
    throw new StageGuideError(400, "Keep the short guide between 40 and 1800 characters and no more than 200 words.");
  }
  if (/-----BEGIN|sk_live_|ghp_[A-Za-z0-9]{15}|sk-[A-Za-z0-9_-]{20}|(?:api[_ -]?key|password)\s*[:=]\s*\S+/i.test(input.script)) {
    throw new StageGuideError(400, "Remove possible credentials before saving shared training content.");
  }
  const row = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`stage-guide:${input.stageKey}:${input.kind}`}, 0))`);
    const [latest] = await tx.select().from(guides).where(and(eq(guides.stageKey, input.stageKey), eq(guides.kind, input.kind)))
      .orderBy(desc(guides.version)).limit(1);
    if (latest && busy.includes(latest.state)) throw new StageGuideError(409, "Resolve the existing generation before creating another version.");
    const [saved] = await tx.insert(guides).values({ stageKey: input.stageKey, kind: input.kind, script: input.script.trim(),
      version: (latest?.version ?? 0) + 1, createdByUserId: actor.id }).returning();
    return saved!;
  });
  return stageGuideView(row, row.stageKey, row.kind as GuideKind);
}
export async function generateStageGuide(actor: Actor, id: string, input: { test: boolean; scriptReviewed: boolean; creditsAccepted: boolean }) {
  requireAdministrator(actor);
  if (!input.scriptReviewed || (!input.test && !input.creditsAccepted)) throw new StageGuideError(400, "Review the script and explicitly accept Synthesia credits for a real render.");
  if (!synthesiaConfigured()) throw new StageGuideError(503, "Configure SYNTHESIA_API_KEY with Legacy (v2) access before generation.");
  const row = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('stage-guide-generation', 0))`);
    const [existing] = await tx.select().from(guides).where(eq(guides.id, id)).limit(1);
    if (!existing) throw new StageGuideError(404, "Guide revision not found.");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`stage-guide:${existing.stageKey}:${existing.kind}`}, 0))`);
    const [latest] = await tx.select({ id: guides.id }).from(guides)
      .where(and(eq(guides.stageKey, existing.stageKey), eq(guides.kind, existing.kind)))
      .orderBy(desc(guides.version)).limit(1);
    if (latest?.id !== id) throw new StageGuideError(409, "A newer script revision exists. Generate only the latest reviewed version.");
    if (existing.state !== "DRAFT") throw new StageGuideError(409, "This revision has already been submitted. Refresh or reconcile its existing video; do not re-dispatch it.");
    const outstanding = await tx.select({ id: guides.id }).from(guides).where(sql`${guides.state} IN ('SUBMITTING','GENERATING','UNKNOWN')`).limit(2);
    if (outstanding.length >= 2) throw new StageGuideError(429, "Resolve the existing video jobs before starting more renders.");
    const recent = await tx.select({ id: guides.id }).from(guides)
      .where(gt(guides.generationStartedAt, new Date(Date.now() - 900_000))).limit(4);
    if (recent.length >= 4) throw new StageGuideError(429, "Wait before starting more video renders.");
    const [claimed] = await tx.update(guides).set({ state: "SUBMITTING", isTest: input.test, generationStartedAt: new Date() })
      .where(and(eq(guides.id, id), eq(guides.state, "DRAFT"))).returning();
    if (!claimed) throw new StageGuideError(409, "Generation already started.");
    return claimed;
  });
  let acceptedId: string | undefined;
  try {
    const result = await synthesiaRequest("POST", undefined, {
      title: stageGuideView(row, row.stageKey, row.kind as GuideKind).title, test: input.test,
      visibility: "private", callbackId: row.id, description: "Shared ATANDA ARK training. Synthetic teaching content; not project evidence.",
      input: [{ scriptText: row.script, avatar: process.env.SYNTHESIA_AVATAR_ID || "anna_costume1_cameraA",
        background: process.env.SYNTHESIA_BACKGROUND || "off_white" }],
    });
    if (result.callbackId !== undefined && result.callbackId !== row.id) throw new SynthesiaError(true);
    acceptedId = result.id;
    const [updated] = await db.update(guides).set({ state: "GENERATING", providerVideoId: result.id })
      .where(and(eq(guides.id, id), eq(guides.state, "SUBMITTING"))).returning();
    return stageGuideView(updated!, row.stageKey, row.kind as GuideKind);
  } catch (err) {
    const state = err instanceof SynthesiaError && !err.uncertain ? "FAILED" : "UNKNOWN";
    await db.update(guides).set({ state, ...(acceptedId ? { providerVideoId: acceptedId } : {}) })
      .where(and(eq(guides.id, id), eq(guides.state, "SUBMITTING")));
    // The durable result is returned, not a retryable HTTP error after a possibly paid call.
    return stageGuideView(await guide(id), row.stageKey, row.kind as GuideKind);
  }
}
function validateProvider(row: Row, result: SynthesiaVideo, expectedId: string) {
  if (result.id !== expectedId || result.callbackId !== row.id || (result.test ?? false) !== row.isTest) {
    throw new StageGuideError(409, "Provider identity, callback or test mode does not match this exact guide revision.");
  }
}
export async function syncStageGuide(actor: Actor, id: string, input: { providerVideoId?: string }) {
  requireAdministrator(actor);
  const row = await guide(id), providerId = row.providerVideoId ?? input.providerVideoId;
  if (!providerId || row.state === "DRAFT") throw new StageGuideError(409, "Provide the existing Synthesia video ID for this submitted revision. Do not create another render.");
  if (row.providerVideoId && input.providerVideoId && input.providerVideoId !== row.providerVideoId) throw new StageGuideError(409, "The provider video is already bound.");
  const result = await synthesiaRequest("GET", providerId);
  validateProvider(row, result, providerId);
  const state = result.status === "complete" ? "COMPLETE" : ["error", "rejected", "deleted"].includes(result.status ?? "") ? "FAILED" : "GENERATING";
  const [updated] = await db.update(guides).set({ state, providerVideoId: providerId,
    ...(state !== "COMPLETE" || result.visibility !== "public" ? { publishedAt: null } : {}) })
    .where(and(eq(guides.id, id), eq(guides.state, row.state),
      row.providerVideoId ? eq(guides.providerVideoId, row.providerVideoId) : isNull(guides.providerVideoId))).returning();
  if (!updated) throw new StageGuideError(409, "Another status update arrived. Refresh the current guide.");
  return stageGuideView(updated!, row.stageKey, row.kind as GuideKind);
}
export async function publishStageGuide(actor: Actor, id: string, input: { contentReviewed: boolean; publicSharingAccepted: boolean }) {
  requireAdministrator(actor);
  if (!input.contentReviewed || !input.publicSharingAccepted) throw new StageGuideError(400, "Review the actual video and accept public Synthesia sharing before publishing.");
  const row = await guide(id);
  if (row.state !== "COMPLETE" || row.isTest || !row.providerVideoId) throw new StageGuideError(409, "Only a completed, reviewed, non-test video can be published.");
  const fresh = await synthesiaRequest("GET", row.providerVideoId);
  validateProvider(row, fresh, row.providerVideoId);
  if (fresh.status !== "complete") throw new StageGuideError(409, "Rendering or moderation is not complete.");
  const result = await synthesiaRequest("PATCH", row.providerVideoId, { visibility: "public" });
  validateProvider(row, result, row.providerVideoId);
  if (result.visibility !== "public" || result.status !== "complete") throw new StageGuideError(503, "Synthesia has not confirmed public playback.");
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`stage-guide:${row.stageKey}:${row.kind}`}, 0))`);
    const [latest] = await tx.select({ id: guides.id }).from(guides).where(and(eq(guides.stageKey, row.stageKey), eq(guides.kind, row.kind)))
      .orderBy(desc(guides.version)).limit(1);
    if (latest?.id !== id) throw new StageGuideError(409, "A newer script revision exists. Publish the latest reviewed revision.");
    await tx.update(guides).set({ publishedAt: null }).where(and(eq(guides.stageKey, row.stageKey), eq(guides.kind, row.kind)));
    const [published] = await tx.update(guides).set({ publishedAt: new Date(), publishedByUserId: actor.id })
      .where(and(eq(guides.id, id), eq(guides.state, "COMPLETE"), eq(guides.isTest, false), eq(guides.providerVideoId, row.providerVideoId!))).returning();
    if (!published) throw new StageGuideError(409, "The guide status changed. Refresh and review it again.");
    return published!;
  });
  return stageGuideView(updated, row.stageKey, row.kind as GuideKind);
}
