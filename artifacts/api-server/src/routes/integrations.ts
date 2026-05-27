import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  harnessArtifactsTable,
  integrationCredentialsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  decryptApiKey,
  encryptApiKey,
  keyPrefixFor,
  maskKey,
} from "../lib/integration-crypto";

const router: IRouter = Router();

// ─── GET status ────────────────────────────────────────────────────────────
router.get("/integrations/sphinx", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: integrationCredentialsTable.id,
      label: integrationCredentialsTable.label,
      keyPrefix: integrationCredentialsTable.keyPrefix,
      lastUsedAt: integrationCredentialsTable.lastUsedAt,
      createdAt: integrationCredentialsTable.createdAt,
    })
    .from(integrationCredentialsTable)
    .where(
      and(
        eq(integrationCredentialsTable.userId, req.localUser!.id),
        eq(integrationCredentialsTable.provider, "sphinx"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.json({ connected: false });
    return;
  }
  res.json({
    connected: true,
    label: row.label,
    maskedKey: maskKey(row.keyPrefix),
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  });
});

// ─── POST connect (paste key) ──────────────────────────────────────────────
const ConnectBody = z.object({
  apiKey: z
    .string()
    .min(20, "Key looks too short")
    .max(200, "Key looks too long")
    .regex(/^sphinx_(live|test)_[A-Za-z0-9]{16,}$/u, "Expected sphinx_live_… or sphinx_test_…"),
  label: z.string().max(80).optional(),
});
router.post("/integrations/sphinx", requireAuth, async (req, res): Promise<void> => {
  const parsed = ConnectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const enc = encryptApiKey(parsed.data.apiKey);
  const prefix = keyPrefixFor(parsed.data.apiKey);
  await db
    .insert(integrationCredentialsTable)
    .values({
      userId: req.localUser!.id,
      provider: "sphinx",
      label: parsed.data.label ?? null,
      keyPrefix: prefix,
      keyEncrypted: enc,
    })
    .onConflictDoUpdate({
      target: [integrationCredentialsTable.userId, integrationCredentialsTable.provider],
      set: {
        label: parsed.data.label ?? null,
        keyPrefix: prefix,
        keyEncrypted: enc,
        updatedAt: new Date(),
      },
    });
  res.json({ connected: true, maskedKey: maskKey(prefix) });
});

// ─── DELETE disconnect ─────────────────────────────────────────────────────
router.delete("/integrations/sphinx", requireAuth, async (req, res): Promise<void> => {
  await db
    .delete(integrationCredentialsTable)
    .where(
      and(
        eq(integrationCredentialsTable.userId, req.localUser!.id),
        eq(integrationCredentialsTable.provider, "sphinx"),
      ),
    );
  res.json({ connected: false });
});

// ─── POST publish SPC to Sphinx ────────────────────────────────────────────
const PublishBody = z.object({
  artifactId: z.string().uuid(),
  license: z.string().max(40).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
});

router.post(
  "/integrations/sphinx/publish",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = PublishBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { artifactId } = parsed.data;

    // 1) Load credential.
    const credRows = await db
      .select()
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, req.localUser!.id),
          eq(integrationCredentialsTable.provider, "sphinx"),
        ),
      )
      .limit(1);
    const cred = credRows[0];
    if (!cred) {
      res.status(404).json({
        error: "Sphinx is not connected. Add your API key in Account → Connected Services.",
        code: "SPHINX_NOT_CONNECTED",
      });
      return;
    }

    // 2) Load artifact (must be SPC and owned by this user).
    const artRows = await db
      .select()
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.id, artifactId),
          eq(harnessArtifactsTable.userId, req.localUser!.id),
        ),
      )
      .limit(1);
    const artifact = artRows[0];
    if (!artifact) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    if (artifact.artifactType !== "SPC") {
      res.status(400).json({
        error: `Only SPC artifacts can be published to Sphinx (got ${artifact.artifactType}).`,
        code: "SPHINX_WRONG_TYPE",
      });
      return;
    }

    // 3) Load author display info (best-effort; we send what we have).
    const meRows = await db
      .select({ email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, req.localUser!.id))
      .limit(1);
    const me = meRows[0];

    // 4) Build the payload.
    const content = artifact.artifactContent as Record<string, unknown>;
    const title =
      (typeof content?.title === "string" && content.title) ||
      (typeof content?.name === "string" && content.name) ||
      `SPC ${artifact.id.slice(0, 8)}`;
    const spcMarkdown =
      typeof content?.markdown === "string"
        ? content.markdown
        : JSON.stringify(content, null, 2);

    const publicBase =
      process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
    const verificationUrl =
      artifact.spartanCert && publicBase
        ? `${publicBase}/verify?artifactId=${artifact.id}`
        : null;

    const payload = {
      source: "atanda-command-centre",
      externalId: artifact.id,
      title,
      spcKind: "F5_FULL_SPC",
      spcMarkdown,
      spcStructured: content,
      jcseScore: artifact.jcseScore,
      certTier: artifact.certTier,
      spartanCert: artifact.spartanCert,
      verificationUrl,
      license: parsed.data.license ?? "all-rights-reserved",
      visibility: parsed.data.visibility ?? "public",
      author: {
        id: req.localUser!.id,
        name: me?.displayName ?? null,
        email: me?.email ?? null,
      },
    };

    // 5) POST to Sphinx.
    const sphinxBase = process.env.SPHINX_BASE_URL?.replace(/\/$/, "");
    if (!sphinxBase) {
      res.status(503).json({
        error: "SPHINX_BASE_URL is not configured on this server.",
        code: "SPHINX_NOT_CONFIGURED",
      });
      return;
    }

    let plaintextKey: string;
    try {
      plaintextKey = decryptApiKey(cred.keyEncrypted);
    } catch {
      res.status(500).json({
        error: "Stored Sphinx key could not be decrypted. Disconnect and reconnect.",
        code: "SPHINX_KEY_UNREADABLE",
      });
      return;
    }

    let sphinxRes: Response;
    try {
      sphinxRes = await fetch(`${sphinxBase}/api/marketplace/listings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${plaintextKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      req.log.warn({ err }, "Sphinx publish: network error");
      res.status(502).json({
        error: "Could not reach Sphinx marketplace.",
        code: "SPHINX_UNREACHABLE",
      });
      return;
    }

    const sphinxBody = await sphinxRes.json().catch(() => null);
    if (!sphinxRes.ok) {
      req.log.warn(
        { status: sphinxRes.status, body: sphinxBody },
        "Sphinx publish: rejected",
      );
      res.status(sphinxRes.status === 401 ? 401 : 502).json({
        error:
          typeof sphinxBody === "object" && sphinxBody && "error" in sphinxBody
            ? String((sphinxBody as { error: unknown }).error)
            : `Sphinx rejected the publish (HTTP ${sphinxRes.status}).`,
        code: sphinxRes.status === 401 ? "SPHINX_BAD_KEY" : "SPHINX_REJECTED",
        sphinxStatus: sphinxRes.status,
      });
      return;
    }

    const listing = (sphinxBody ?? {}) as {
      listingId?: string;
      listingUrl?: string;
    };

    // 6) Persist marketplace listing pointer onto the artifact.
    const newContent = {
      ...content,
      sphinxListing: {
        listingId: listing.listingId ?? null,
        listingUrl: listing.listingUrl ?? null,
        publishedAt: new Date().toISOString(),
        license: payload.license,
        visibility: payload.visibility,
      },
    };
    await db
      .update(harnessArtifactsTable)
      .set({ artifactContent: newContent })
      .where(eq(harnessArtifactsTable.id, artifact.id));

    // 7) Touch lastUsedAt on the credential.
    await db
      .update(integrationCredentialsTable)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(integrationCredentialsTable.id, cred.id));

    res.json({
      ok: true,
      listingId: listing.listingId ?? null,
      listingUrl: listing.listingUrl ?? null,
    });
  },
);

export default router;
