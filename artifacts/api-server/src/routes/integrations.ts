import { Router, type IRouter, type Response as ExpressResponse } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  harnessArtifactsTable,
  integrationCredentialsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireTier } from "../lib/tier";
import {
  decryptApiKey,
  encryptApiKey,
  keyPrefixFor,
  maskKey,
} from "../lib/integration-crypto";
import {
  buildGitHubAuthorizeUrl,
  exchangeGitHubOAuthCode,
  getGitHubClientFromToken,
  GITHUB_TOKEN_RE,
  githubOAuthConfigured,
  githubTokenScheme,
  isGitHubOAuthScope,
  publicBaseUrl,
  revokeGitHubOAuthToken,
  signOAuthState,
  verifyOAuthState,
} from "../lib/github";

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

// ─── GitHub (per-user personal access token) ───────────────────────────────
//
// Each subscriber connects their OWN GitHub by pasting a personal access token
// (mirrors the per-user Sphinx credential pattern), so a CODE DJ codebase push
// lands in *their* account — not the Repl owner's. The token is stored
// encrypted in `integration_credentials` and decrypted only at push time.

// ─── GET github status ──────────────────────────────────────────────────────
router.get(
  "/integrations/github",
  requireAuth,
  async (req, res): Promise<void> => {
    const rows = await db
      .select({
        login: integrationCredentialsTable.label,
        lastUsedAt: integrationCredentialsTable.lastUsedAt,
        createdAt: integrationCredentialsTable.createdAt,
      })
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, req.localUser!.id),
          eq(integrationCredentialsTable.provider, "github"),
        ),
      )
      .limit(1);
    const row = rows[0];
    const oauthAvailable = githubOAuthConfigured();
    if (!row) {
      res.json({ connected: false, login: null, oauthAvailable });
      return;
    }
    res.json({
      connected: true,
      login: row.login,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      oauthAvailable,
    });
  },
);

// ─── OAuth: one-click "Connect GitHub" ─────────────────────────────────────
//
// The friendlier alternative to pasting a PAT. `start` (auth'd) redirects the
// user to github.com; `callback` (no Clerk session — bound by signed state)
// exchanges the code for a token and stores it in the same per-user
// `integration_credentials` row the paste path uses.

function frontendRedirect(res: ExpressResponse, status: string): void {
  const base = publicBaseUrl();
  res.redirect(`${base}/account?github=${status}`);
}

router.get(
  "/integrations/github/oauth/start",
  requireAuth,
  (req, res): void => {
    if (!githubOAuthConfigured()) {
      frontendRedirect(res, "oauth_unavailable");
      return;
    }
    // The user may narrow the grant to public repos only; default to `repo`
    // (public + private) so private codebases can still be pushed. OAuth-App
    // scopes can't express per-repo selection — that's the fine-grained PAT path.
    const scope = isGitHubOAuthScope(req.query.scope) ? req.query.scope : "repo";
    const state = signOAuthState(req.localUser!.id);
    res.redirect(buildGitHubAuthorizeUrl(state, scope));
  },
);

router.get(
  "/integrations/github/oauth/callback",
  async (req, res): Promise<void> => {
    // The user denied access, or GitHub returned an error.
    if (typeof req.query.error === "string") {
      req.log.warn({ error: req.query.error }, "GitHub OAuth: authorize error");
      frontendRedirect(res, "denied");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !stateRaw) {
      frontendRedirect(res, "error");
      return;
    }

    const state = verifyOAuthState(stateRaw);
    if (!state) {
      req.log.warn("GitHub OAuth: invalid or expired state");
      frontendRedirect(res, "error");
      return;
    }

    // Exchange the code for a user access token.
    let token: string;
    try {
      token = await exchangeGitHubOAuthCode(code);
    } catch (err) {
      req.log.warn({ err }, "GitHub OAuth: code exchange failed");
      frontendRedirect(res, "error");
      return;
    }

    // Resolve the login so the UI can show "connected as <login>" and pushes
    // are tagged to the right account.
    let login: string;
    try {
      const gh = getGitHubClientFromToken(token);
      const me = await gh.rest.users.getAuthenticated();
      login = me.data.login;
    } catch (err) {
      req.log.warn({ err }, "GitHub OAuth: could not resolve account login");
      frontendRedirect(res, "error");
      return;
    }

    const enc = encryptApiKey(token);
    await db
      .insert(integrationCredentialsTable)
      .values({
        userId: state.userId,
        provider: "github",
        label: login,
        keyPrefix: githubTokenScheme(token),
        keyEncrypted: enc,
      })
      .onConflictDoUpdate({
        target: [integrationCredentialsTable.userId, integrationCredentialsTable.provider],
        set: {
          label: login,
          keyPrefix: githubTokenScheme(token),
          keyEncrypted: enc,
          updatedAt: new Date(),
        },
      });
    frontendRedirect(res, "connected");
  },
);

// ─── POST connect (paste personal access token) ────────────────────────────
const GitHubConnectBody = z.object({
  token: z
    .string()
    .min(20, "Token looks too short")
    .max(255, "Token looks too long")
    .regex(GITHUB_TOKEN_RE, "Expected a GitHub token (ghp_…, github_pat_…)"),
});
router.post(
  "/integrations/github",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GitHubConnectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { token } = parsed.data;

    // Validate the token against GitHub and resolve the account login so we can
    // show "connected as <login>" and tag pushes to the right account.
    let login: string;
    try {
      const gh = getGitHubClientFromToken(token);
      const me = await gh.rest.users.getAuthenticated();
      login = me.data.login;
    } catch (err) {
      const status = (err as { status?: number }).status;
      req.log.warn({ err }, "GitHub connect: token validation failed");
      res.status(status === 401 ? 401 : 502).json({
        error:
          status === 401
            ? "GitHub rejected that token. Check it has the 'repo' scope and hasn't expired."
            : "Could not reach GitHub to verify the token. Try again.",
        code: status === 401 ? "GITHUB_BAD_TOKEN" : "GITHUB_UNREACHABLE",
      });
      return;
    }

    const enc = encryptApiKey(token);
    await db
      .insert(integrationCredentialsTable)
      .values({
        userId: req.localUser!.id,
        provider: "github",
        label: login,
        keyPrefix: githubTokenScheme(token),
        keyEncrypted: enc,
      })
      .onConflictDoUpdate({
        target: [integrationCredentialsTable.userId, integrationCredentialsTable.provider],
        set: {
          label: login,
          keyPrefix: githubTokenScheme(token),
          keyEncrypted: enc,
          updatedAt: new Date(),
        },
      });
    res.json({ connected: true, login });
  },
);

// ─── DELETE disconnect ─────────────────────────────────────────────────────
router.delete(
  "/integrations/github",
  requireAuth,
  async (req, res): Promise<void> => {
    // Best-effort: revoke the grant on GitHub before clearing the local row,
    // so a token obtained via OAuth is actually invalidated, not just forgotten.
    const rows = await db
      .select({ keyEncrypted: integrationCredentialsTable.keyEncrypted })
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, req.localUser!.id),
          eq(integrationCredentialsTable.provider, "github"),
        ),
      )
      .limit(1);
    const existing = rows[0];
    if (existing && githubOAuthConfigured()) {
      try {
        await revokeGitHubOAuthToken(decryptApiKey(existing.keyEncrypted));
      } catch (err) {
        req.log.warn({ err }, "GitHub disconnect: token revoke failed (clearing anyway)");
      }
    }

    await db
      .delete(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, req.localUser!.id),
          eq(integrationCredentialsTable.provider, "github"),
        ),
      );
    res.json({ connected: false });
  },
);

// ─── POST push a CODE DJ codebase bundle to a new GitHub repo ───────────────
const RepoNameRe = /^[A-Za-z0-9._-]{1,100}$/u;
const PushCodebaseBody = z.object({
  // The CODEBASE_BUNDLE artifact this push corresponds to — for ownership
  // checks and lineage. The file *contents* are assembled client-side by the
  // shared CODE DJ export generator so they are byte-identical to the ZIP.
  artifactId: z.string().uuid(),
  repoName: z
    .string()
    .regex(RepoNameRe, "Repo name may use letters, numbers, '.', '-', '_' only"),
  description: z.string().max(350).optional(),
  private: z.boolean().optional(),
  // "create" (default) makes a brand-new repo; "update" commits a fresh tree
  // on top of the repo already linked to this bundle (re-running CODE DJ).
  mode: z.enum(["create", "update"]).optional(),
  // When true (only meaningful in "update" mode), push the fresh tree to a new
  // branch off HEAD and open a pull request instead of committing straight onto
  // the default branch, so the user can review the diff before it goes live.
  pullRequest: z.boolean().optional(),
  files: z
    .record(
      z
        .string()
        .min(1)
        .max(200)
        .refine((p) => !p.startsWith("/") && !p.includes(".."), {
          message: "file path must be relative and free of '..' traversal",
        }),
      z.string().max(100_000),
    )
    .refine((f) => Object.keys(f).length > 0, "No files to push")
    .refine((f) => Object.keys(f).length <= 60, "Too many files in bundle"),
});

router.post(
  "/integrations/github/push-codebase",
  requireAuth,
  // F8 / CODE DJ is an Architect-tier capability; gate the live handoff the same.
  requireTier("ARCHITECT"),
  async (req, res): Promise<void> => {
    const parsed = PushCodebaseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { artifactId, repoName, description, files } = parsed.data;
    const isPrivate = parsed.data.private ?? true;
    const mode = parsed.data.mode ?? "create";
    const asPullRequest = mode === "update" && parsed.data.pullRequest === true;

    const totalBytes = Object.values(files).reduce((n, c) => n + c.length, 0);
    if (totalBytes > 2_000_000) {
      res
        .status(400)
        .json({ error: "Bundle too large to push (2 MB limit).", code: "BUNDLE_TOO_LARGE" });
      return;
    }

    // Ownership + lineage: the bundle artifact must belong to this user and be
    // a CODE DJ codebase bundle.
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
      res.status(404).json({ error: "Codebase bundle artifact not found" });
      return;
    }
    if (artifact.artifactType !== "CODEBASE_BUNDLE") {
      res.status(400).json({
        error: `Only CODE DJ codebase bundles can be pushed (got ${artifact.artifactType}).`,
        code: "GITHUB_WRONG_TYPE",
      });
      return;
    }

    // Load THIS user's GitHub credential (their pasted personal access token),
    // so the push lands in their own account — not the Repl owner's.
    const ghCredRows = await db
      .select()
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, req.localUser!.id),
          eq(integrationCredentialsTable.provider, "github"),
        ),
      )
      .limit(1);
    const ghCred = ghCredRows[0];
    if (!ghCred) {
      res.status(503).json({
        error:
          "GitHub is not connected. Add a personal access token in Account → Connected Services.",
        code: "GITHUB_NOT_CONNECTED",
      });
      return;
    }

    let gh;
    let owner: string;
    try {
      const token = decryptApiKey(ghCred.keyEncrypted);
      gh = getGitHubClientFromToken(token);
      const me = await gh.rest.users.getAuthenticated();
      owner = me.data.login;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        res.status(401).json({
          error:
            "Your GitHub token was rejected. Reconnect GitHub in Account → Connected Services.",
          code: "GITHUB_BAD_TOKEN",
        });
        return;
      }
      req.log.warn({ err }, "GitHub push: could not authenticate");
      res.status(502).json({
        error: "Could not authenticate with GitHub.",
        code: "GITHUB_AUTH_FAILED",
      });
      return;
    }

    // A previously-linked repo pointer (if this bundle was pushed before).
    const content = (artifact.artifactContent ?? {}) as Record<string, unknown>;
    const existingRepo = content.githubRepo as
      | {
          fullName?: string;
          htmlUrl?: string;
          defaultBranch?: string;
          private?: boolean;
        }
      | undefined;

    // Build the git tree once — used by both code paths. Omitting `base_tree`
    // makes this the *complete* tree, so files removed between CODE DJ runs are
    // dropped rather than left behind as stale entries.
    const treeEntries = Object.entries(files).map(([path, fileContent]) => ({
      path,
      mode: "100644" as const,
      type: "blob" as const,
      content: fileContent,
    }));

    let repoFullName: string;
    let htmlUrl: string;
    let branch: string;
    let created: boolean;
    let pullRequestUrl: string | undefined;

    if (mode === "update") {
      // ── Push a fresh commit onto the already-linked repo ──────────────────
      if (!existingRepo?.fullName) {
        res.status(409).json({
          error: "This bundle is not linked to a GitHub repo yet. Create one first.",
          code: "GITHUB_NO_LINKED_REPO",
        });
        return;
      }
      const linkedRepo = existingRepo.fullName.split("/").pop() ?? repoName;
      branch = existingRepo.defaultBranch ?? "main";
      try {
        // HEAD of the default branch becomes the parent of the new commit.
        const ref = await gh.rest.git.getRef({
          owner,
          repo: linkedRepo,
          ref: `heads/${branch}`,
        });
        const headSha = ref.data.object.sha;
        const tree = await gh.rest.git.createTree({
          owner,
          repo: linkedRepo,
          tree: treeEntries,
        });
        const commit = await gh.rest.git.createCommit({
          owner,
          repo: linkedRepo,
          message: asPullRequest
            ? "CODE DJ scaffold — proposed update"
            : "CODE DJ scaffold — update",
          tree: tree.data.sha,
          parents: [headSha],
        });
        if (asPullRequest) {
          // Push the commit to a fresh branch off HEAD and open a PR so the user
          // can review the diff (including files removed between runs) before it
          // lands on the default branch.
          const prBranch = `code-dj-update-${Date.now()}`;
          await gh.rest.git.createRef({
            owner,
            repo: linkedRepo,
            ref: `refs/heads/${prBranch}`,
            sha: commit.data.sha,
          });
          const pr = await gh.rest.pulls.create({
            owner,
            repo: linkedRepo,
            title: "CODE DJ scaffold — proposed update",
            head: prBranch,
            base: branch,
            body:
              "This pull request was opened by CODE DJ (F8) with a freshly regenerated scaffold.\n\n" +
              "Review the diff — including any files removed between runs — then merge to apply the update to the default branch.",
          });
          pullRequestUrl = pr.data.html_url;
        } else {
          await gh.rest.git.updateRef({
            owner,
            repo: linkedRepo,
            ref: `heads/${branch}`,
            sha: commit.data.sha,
          });
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          res.status(409).json({
            error:
              "The linked GitHub repo no longer exists. Create a new repo for this bundle.",
            code: "GITHUB_REPO_MISSING",
          });
          return;
        }
        if (status === 403) {
          res.status(403).json({
            error: `Your GitHub token isn't authorized for "${existingRepo.fullName}". If you used a fine-grained token, add this repository to its selected repos and grant Contents: Read and write, then retry.`,
            code: "GITHUB_REPO_NOT_AUTHORIZED",
          });
          return;
        }
        req.log.warn({ err }, "GitHub push: update failed");
        res.status(502).json({
          error: asPullRequest
            ? "Could not open a pull request on the linked GitHub repo."
            : "Could not push the update to the linked GitHub repo.",
          code: asPullRequest ? "GITHUB_PR_FAILED" : "GITHUB_UPDATE_FAILED",
        });
        return;
      }
      repoFullName = existingRepo.fullName;
      htmlUrl = existingRepo.htmlUrl ?? `https://github.com/${existingRepo.fullName}`;
      created = false;
    } else {
      // ── Create a brand-new repo and seed it ───────────────────────────────
      try {
        const repo = await gh.rest.repos.createForAuthenticatedUser({
          name: repoName,
          description: description ?? "Scaffolded by CODE DJ (F8) — ATANDA Command Centre",
          private: isPrivate,
          auto_init: false,
        });
        repoFullName = repo.data.full_name;
        htmlUrl = repo.data.html_url;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 422) {
          res.status(409).json({
            error: `A repo named "${repoName}" already exists on ${owner}. Pick another name${existingRepo?.fullName ? ', or push an update to the linked repo' : ''}.`,
            code: "GITHUB_REPO_EXISTS",
          });
          return;
        }
        if (status === 403) {
          res.status(403).json({
            error: `Your GitHub token isn't allowed to create a new repository on ${owner}. A fine-grained token scoped to only selected repos can't create repos — grant it Administration: Read and write on all repositories, or create "${repoName}" on GitHub yourself and push an update to it.`,
            code: "GITHUB_REPO_NOT_AUTHORIZED",
          });
          return;
        }
        req.log.warn({ err }, "GitHub push: repo create failed");
        res.status(502).json({
          error: "GitHub rejected the repo creation.",
          code: "GITHUB_CREATE_FAILED",
        });
        return;
      }

      branch = "main";
      try {
        const tree = await gh.rest.git.createTree({
          owner,
          repo: repoName,
          tree: treeEntries,
        });
        const commit = await gh.rest.git.createCommit({
          owner,
          repo: repoName,
          message: "CODE DJ scaffold — initial commit",
          tree: tree.data.sha,
        });
        await gh.rest.git.createRef({
          owner,
          repo: repoName,
          ref: `refs/heads/${branch}`,
          sha: commit.data.sha,
        });
      } catch (err) {
        req.log.warn({ err }, "GitHub push: tree/commit failed");
        res.status(502).json({
          error:
            "Repo was created but the codebase could not be pushed. Delete it on GitHub and retry.",
          code: "GITHUB_PUSH_FAILED",
          repoUrl: htmlUrl,
        });
        return;
      }
      created = true;
    }

    // Persist a pointer on the bundle artifact for lineage + "already pushed" UI.
    const replitImportUrl = `https://replit.com/github/${repoFullName}`;
    await db
      .update(harnessArtifactsTable)
      .set({
        artifactContent: {
          ...content,
          githubRepo: {
            fullName: repoFullName,
            htmlUrl,
            defaultBranch: branch,
            replitImportUrl,
            private: created ? isPrivate : existingRepo?.private ?? isPrivate,
            pushedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(harnessArtifactsTable.id, artifact.id));

    // Touch lastUsedAt on the GitHub credential.
    await db
      .update(integrationCredentialsTable)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(integrationCredentialsTable.id, ghCred.id));

    res.json({
      ok: true,
      created,
      owner,
      repo: repoFullName.split("/").pop(),
      repoFullName,
      htmlUrl,
      defaultBranch: branch,
      replitImportUrl,
      pullRequestUrl,
    });
  },
);

export default router;
