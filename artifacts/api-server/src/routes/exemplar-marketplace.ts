import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, exemplarLibraryItemsTable, sphinxMarketplaceSettingsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import {
  COMMERCIAL_KINDS, POLICY_VERSION, commercialEligibility,
  exemplarContentHash, exemplarSummary, qualificationBody,
} from "../lib/exemplar-marketplace";

const idSchema = z.string().uuid();
const visibilityBody = z.object({
  active: z.boolean().optional(),
  artifactMode: z.enum(["LIBRARY_ARTIFACT", "SPHINX_ARTIFACT"]).optional(),
  commercialConsent: z.boolean().optional(),
}).strict().refine((body) => body.active !== undefined || body.artifactMode !== undefined);

export async function isSphinxCatalogOpen(settingsId = "global") {
  const [settings] = await db.select().from(sphinxMarketplaceSettingsTable)
    .where(eq(sphinxMarketplaceSettingsTable.id, settingsId)).limit(1);
  return settings?.publicOpen === true;
}

export function createExemplarMarketplaceRouter(settingsId = "global"): IRouter {
const router: IRouter = Router();
router.get("/sphinx/catalog", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const publicOpen = await isSphinxCatalogOpen(settingsId);
  if (!publicOpen) { res.json({ publicOpen: false, items: [] }); return; }
  const rows = await db.select().from(exemplarLibraryItemsTable).where(and(
    eq(exemplarLibraryItemsTable.active, true),
    eq(exemplarLibraryItemsTable.artifactMode, "SPHINX_ARTIFACT"),
  )).orderBy(desc(exemplarLibraryItemsTable.createdAt));
  res.json({
    publicOpen: true,
    items: rows.filter((row) => commercialEligibility(row).eligible).map((row) => ({
      id: row.id, title: row.title, tagline: row.tagline, kind: row.kind,
      jcse: row.qualification!.jcse, certClass: null, disc: null,
      source: "generated", marketplace: "open",
      sku: `OPEN-${row.kind}-${row.id.slice(0, 8).toUpperCase()}`,
      spcPlayer: null, artifactMode: "SPHINX_ARTIFACT", active: true,
    })),
  });
});

router.get("/exemplars/marketplace", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ publicOpen: await isSphinxCatalogOpen(settingsId), canManage: req.localUser!.role === "ADMIN", policyVersion: POLICY_VERSION });
});

router.patch("/exemplars/marketplace", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z.object({ publicOpen: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "publicOpen must be a boolean" }); return; }
  const values = { publicOpen: parsed.data.publicOpen, updatedBy: req.localUser!.id, updatedAt: new Date() };
  await db.insert(sphinxMarketplaceSettingsTable).values({ id: settingsId, ...values })
    .onConflictDoUpdate({ target: sphinxMarketplaceSettingsTable.id, set: values });
  res.json({ publicOpen: values.publicOpen, canManage: true, policyVersion: POLICY_VERSION });
});

router.patch("/exemplars/:id/visibility", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = visibilityBody.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: "Invalid artifact visibility request" }); return; }
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(exemplarLibraryItemsTable).where(and(
      eq(exemplarLibraryItemsTable.id, id.data), eq(exemplarLibraryItemsTable.ownerUserId, req.localUser!.id),
    )).for("update").limit(1);
    if (!row) return { status: 404, error: "Owned library artifact not found" };
    const active = parsed.data.active ?? row.active;
    let artifactMode = parsed.data.artifactMode ?? row.artifactMode;
    if (parsed.data.artifactMode === "SPHINX_ARTIFACT") {
      const eligibility = commercialEligibility({ ...row, active });
      if (!eligibility.eligible) return { status: 409, error: eligibility.reasons.join(" "), code: "SPHINX_STANDARDS_REQUIRED" };
      if (row.artifactMode !== "SPHINX_ARTIFACT" && parsed.data.commercialConsent !== true) {
        return { status: 409, error: "Explicit consent is required to make this artifact discoverable when Sphinx opens.", code: "SPHINX_CONSENT_REQUIRED" };
      }
    }
    if (!active) artifactMode = "LIBRARY_ARTIFACT";
    const [updated] = await tx.update(exemplarLibraryItemsTable).set({ active, artifactMode })
      .where(eq(exemplarLibraryItemsTable.id, row.id)).returning();
    return { row: updated! };
  });
  if ("status" in result) { res.status(result.status!).json({ error: result.error, code: result.code }); return; }
  res.json(exemplarSummary(result.row, req.localUser!.id, req.localUser!.role === "ADMIN"));
});

router.post("/exemplars/:id/qualification", requireAuth, requireAdmin, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = qualificationBody.safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid artifact ID" : parsed.error.message }); return;
  }
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(exemplarLibraryItemsTable)
      .where(eq(exemplarLibraryItemsTable.id, id.data)).for("update").limit(1);
    if (!row) return { status: 404, error: "Library artifact not found" };
    if (!COMMERCIAL_KINDS.includes(row.kind as typeof COMMERCIAL_KINDS[number])) {
      return { status: 400, error: "This artifact type cannot qualify for commercial publication." };
    }
    const qualification = {
      ...parsed.data, policyVersion: POLICY_VERSION, contentHash: exemplarContentHash(row),
      reviewedBy: req.localUser!.id, reviewedAt: new Date().toISOString(),
    };
    if (qualification.decision === "APPROVED") {
      const eligibility = commercialEligibility({ ...row, active: true, qualification });
      if (!eligibility.eligible) return { status: 400, error: eligibility.reasons.join(" ") };
    }
    const [updated] = await tx.update(exemplarLibraryItemsTable).set({
      qualification,
      ...(qualification.decision === "REJECTED" ? { artifactMode: "LIBRARY_ARTIFACT" as const } : {}),
    }).where(eq(exemplarLibraryItemsTable.id, row.id)).returning();
    return { row: updated! };
  });
  if ("status" in result) { res.status(result.status!).json({ error: result.error }); return; }
  res.json(exemplarSummary(result.row, req.localUser!.id, true));
});

return router;
}

export default createExemplarMarketplaceRouter();
