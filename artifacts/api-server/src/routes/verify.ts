import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, harnessArtifactsTable, harnessSessionsTable } from "@workspace/db";

const router: IRouter = Router();

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
    sessionName: r.sessionName,
  });
});

export default router;
