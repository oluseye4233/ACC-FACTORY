import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth";
import { loadArtifact, ownedSessionOr404, persistArtifact } from "../engines/shared";
import { inspectGovernance } from "../lib/artifact-governance";

const router: IRouter = Router();
const path = "/harness/artifacts/:artifactId/governance";
router.get(path, requireAuth, async (req, res): Promise<void> => {
  const id = z.string().uuid().safeParse(req.params.artifactId);
  if (!id.success) { res.status(400).json({ error: "Invalid artifact ID." }); return; }
  const artifact = await loadArtifact(id.data, req.localUser!.id);
  if (!artifact) { res.status(404).json({ error: "Artifact not found." }); return; }
  if (!["MA_BIRTH_PACKAGE", "SPC"].includes(artifact.artifactType)) {
    res.status(400).json({ error: "Governance revisions apply to MA and SPC artifacts." }); return;
  }
  res.json({ artifactId: artifact.id, ...inspectGovernance(artifact.artifactContent) });
});
router.post(path, requireAuth, async (req, res): Promise<void> => {
  const id = z.string().uuid().safeParse(req.params.artifactId);
  const body = z.object({ confirmCreateRevision: z.literal(true) }).strict().safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "A valid artifact ID and explicit revision confirmation are required." }); return; }
  const artifact = await loadArtifact(id.data, req.localUser!.id);
  if (!artifact) { res.status(404).json({ error: "Artifact not found." }); return; }
  if (!["MA_BIRTH_PACKAGE", "SPC"].includes(artifact.artifactType)) {
    res.status(400).json({ error: "Governance revisions apply to MA and SPC artifacts." }); return;
  }
  const owned = await ownedSessionOr404(req, artifact.sessionId);
  if (!owned.ok) { res.status(owned.status).json({ error: owned.error }); return; }
  if (inspectGovernance(artifact.artifactContent).installed) {
    res.json({ artifactId: artifact.id, ...inspectGovernance(artifact.artifactContent) }); return;
  }
  // Append a private, unverified revision. Never rewrite legacy bytes, carry
  // approval flags, or advance a stage merely because policies were installed.
  const revised = await persistArtifact({
    userId: req.localUser!.id, sessionId: artifact.sessionId, featureId: artifact.featureId,
    artifactType: artifact.artifactType, artifactContent: artifact.artifactContent as Record<string, unknown>,
    parentArtifactId: artifact.id, name: `${artifact.name || artifact.artifactType} · governance v1`.slice(0, 255),
  });
  res.status(201).json({ artifactId: revised.id, ...inspectGovernance(revised.artifactContent) });
});
export default router;
