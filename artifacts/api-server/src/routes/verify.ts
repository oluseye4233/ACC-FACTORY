import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, harnessArtifactsTable, harnessSessionsTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * Extract the certified MVP product's name from an artifact's content.
 *
 * The HARNESS-produced MVP PDD (F7) stores its identity in the
 * `card_identity_metadata` section, whose markdown body opens with a
 * `**Product:** <name>` line. That is the authoritative name of the MVP being
 * certified — the artifact row's own `name` column is usually blank and the
 * session name is an internal label, so neither reliably identifies the product
 * on a public certificate. Returns null when no product line can be found.
 */
export function extractProductName(artifactContent: unknown): string | null {
  if (!artifactContent || typeof artifactContent !== "object") return null;
  const sections = (artifactContent as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  const card = sections.find(
    (s): s is { body?: unknown } =>
      !!s &&
      typeof s === "object" &&
      (s as { key?: unknown }).key === "card_identity_metadata",
  );
  const body = card && typeof card.body === "string" ? card.body : null;
  if (!body) return null;
  // The identity line varies across model outputs: "**Product:**" or
  // "**Product Name:**", with or without a leading markdown bullet.
  const match = body.match(/\*\*Product(?:\s+Name)?:\*\*[ \t]*(.+)/i);
  if (!match) return null;
  const name = match[1]!.split("\n")[0]!.trim();
  return name.length > 0 ? name : null;
}

router.get("/verify", async (req, res): Promise<void> => {
  const cert = typeof req.query.cert === "string" ? req.query.cert : "";
  if (!cert) {
    res.status(400).json({ error: "cert query param required" });
    return;
  }
  const rows = await db
    .select({
      artifact: harnessArtifactsTable,
      sessionName: harnessSessionsTable.sessionName,
    })
    .from(harnessArtifactsTable)
    .leftJoin(harnessSessionsTable, sql`${harnessSessionsTable.id} = ${harnessArtifactsTable.sessionId}`)
    .where(sql`${harnessArtifactsTable.spartanCert}->>'certId' = ${cert}`)
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  const r = rows[0]!;
  const c = (r.artifact.spartanCert ?? {}) as Record<string, unknown>;
  res.json({
    valid: true,
    certId: typeof c.certId === "string" ? c.certId : null,
    class: typeof c.class === "string" ? c.class : null,
    crP: typeof c.crP === "number" ? c.crP : null,
    issuedAt: typeof c.issuedAt === "string" ? c.issuedAt : null,
    // The canonical Universal SKU (D24) issued to this certified artifact.
    sku: r.artifact.sku ?? null,
    // The certified MVP product's (SPC) name — the product named inside the
    // certified MVP PDD, or any explicit artifact name. Kept distinct from the
    // session name so the certificate can show both identifiers.
    productName:
      extractProductName(r.artifact.artifactContent) ||
      r.artifact.name?.trim() ||
      null,
    sessionName: r.sessionName,
    provider: r.artifact.provider ?? null,
    modelId: r.artifact.modelId ?? null,
  });
});

export default router;
