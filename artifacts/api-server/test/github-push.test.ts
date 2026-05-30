import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  integrationCredentialsTable,
} from "@workspace/db";

// The push route loads the caller's encrypted GitHub credential and decrypts it
// with `integration-crypto`, which derives its key from SESSION_SECRET. Set a
// stable test secret before any encrypt/decrypt happens so the seeded
// credential below round-trips.
process.env.SESSION_SECRET ??= "test-session-secret-abcdef0123456789";

// ---------- GitHub client mock ----------
// The real `lib/github.ts` reaches out to the Replit connectors proxy for a
// token and returns a live Octokit. Pushing for real would create repos we
// cannot clean up (the granted token has no delete_repo scope). We swap only
// the client factory (`getGitHubClientFromToken`) for a fake whose behaviour
// each test drives via `mockGh`; every other github.ts export is kept real via
// `...actual` in the `vi.mock` below.
const mockGh = vi.hoisted(() => {
  return {
    authThrows: false,
    createRepoStatus: null as number | null,
    treeThrows: false,
    owner: "octo-tester",
    createdCalls: [] as Array<{ name: string; private: boolean }>,
    treeFiles: [] as Array<{ path: string; content: string }>,
    refCalls: 0,
    // ── "existing"-mode controls ────────────────────────────────────────────
    // `repos.get` lookup result / failure for a named target repo.
    repoGetStatus: null as number | null,
    repoInfo: {
      owner: "octo-tester",
      name: "existing-repo",
      defaultBranch: "main",
      private: true,
    },
    // `git.getRef` outcome: a 404 models a freshly-created EMPTY repo (no
    // default-branch ref yet) so the route seeds it; a number models any other
    // error; null returns a real HEAD sha to parent onto.
    getRefStatus: null as number | null,
    // Recorded so tests can assert the seed commit had NO parents.
    commitParents: [] as string[][],
    createdRefs: [] as string[],
    updateRefCalls: 0,
    prCalls: 0,
    // ── repo-list controls (GET /integrations/github/repos) ─────────────────
    // Raw GitHub-shaped rows `repos.listForAuthenticatedUser` returns; the route
    // filters/maps them. A non-null `listReposStatus` makes the call throw with
    // that HTTP status (401 → bad-token, anything else → list-failed).
    listReposData: [] as Array<Record<string, unknown>>,
    listReposStatus: null as number | null,
    listReposCalls: [] as Array<Record<string, unknown>>,
    // ── repo-search controls (GET /integrations/github/repos with ?q=) ──────
    // Items `search.repos` returns for a query; a non-null `searchReposStatus`
    // makes the call throw with that HTTP status.
    searchReposData: [] as Array<Record<string, unknown>>,
    searchReposStatus: null as number | null,
    searchReposCalls: [] as Array<Record<string, unknown>>,
    reset(): void {
      this.authThrows = false;
      this.createRepoStatus = null;
      this.treeThrows = false;
      this.owner = "octo-tester";
      this.createdCalls = [];
      this.treeFiles = [];
      this.refCalls = 0;
      this.repoGetStatus = null;
      this.repoInfo = {
        owner: "octo-tester",
        name: "existing-repo",
        defaultBranch: "main",
        private: true,
      };
      this.getRefStatus = null;
      this.commitParents = [];
      this.createdRefs = [];
      this.updateRefCalls = 0;
      this.prCalls = 0;
      this.listReposData = [];
      this.listReposStatus = null;
      this.listReposCalls = [];
      this.searchReposData = [];
      this.searchReposStatus = null;
      this.searchReposCalls = [];
    },
  };
});

// The push handler decrypts the user's stored PAT before building a client.
// We seed credentials with a plaintext sentinel and make decryption a no-op so
// the test doesn't depend on SESSION_SECRET-derived encryption.
vi.mock("../src/lib/integration-crypto", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/lib/integration-crypto")>();
  return { ...actual, decryptApiKey: (stored: string) => stored };
});

// Build the fake Octokit-shaped client the route drives. `getGitHubClientFromToken`
// returns it synchronously (the route does `gh = getGitHubClientFromToken(token)`
// then awaits individual REST calls).
function buildFakeGitHubClient() {
  return {
    rest: {
          users: {
            getAuthenticated: async () => {
              if (mockGh.authThrows) throw new Error("github auth network error");
              return { data: { login: mockGh.owner } };
            },
          },
          repos: {
            createForAuthenticatedUser: async (args: {
              name: string;
              private: boolean;
            }) => {
              mockGh.createdCalls.push({
                name: args.name,
                private: args.private,
              });
              if (mockGh.createRepoStatus !== null) {
                const err = new Error("github rejected create") as Error & {
                  status: number;
                };
                err.status = mockGh.createRepoStatus;
                throw err;
              }
              return {
                data: {
                  full_name: `${mockGh.owner}/${args.name}`,
                  html_url: `https://github.com/${mockGh.owner}/${args.name}`,
                },
              };
            },
            listForAuthenticatedUser: async (args: Record<string, unknown>) => {
              mockGh.listReposCalls.push(args);
              if (mockGh.listReposStatus !== null) {
                const err = new Error("github list failed") as Error & {
                  status: number;
                };
                err.status = mockGh.listReposStatus;
                throw err;
              }
              return { data: mockGh.listReposData };
            },
            get: async () => {
              if (mockGh.repoGetStatus !== null) {
                const err = new Error("github repo get failed") as Error & {
                  status: number;
                };
                err.status = mockGh.repoGetStatus;
                throw err;
              }
              const { owner, name, defaultBranch, private: priv } = mockGh.repoInfo;
              return {
                data: {
                  owner: { login: owner },
                  name,
                  default_branch: defaultBranch,
                  full_name: `${owner}/${name}`,
                  html_url: `https://github.com/${owner}/${name}`,
                  private: priv,
                },
              };
            },
          },
          git: {
            getRef: async () => {
              if (mockGh.getRefStatus !== null) {
                const err = new Error("github getRef failed") as Error & {
                  status: number;
                };
                err.status = mockGh.getRefStatus;
                throw err;
              }
              return { data: { object: { sha: "head-sha" } } };
            },
            createTree: async (args: {
              tree: Array<{ path: string; content: string }>;
            }) => {
              if (mockGh.treeThrows) throw new Error("github tree error");
              mockGh.treeFiles = args.tree.map((t) => ({
                path: t.path,
                content: t.content,
              }));
              return { data: { sha: "tree-sha" } };
            },
            createCommit: async (args: { parents?: string[] }) => {
              mockGh.commitParents.push(args.parents ?? []);
              return { data: { sha: "commit-sha" } };
            },
            createRef: async (args: { ref: string }) => {
              mockGh.refCalls += 1;
              mockGh.createdRefs.push(args.ref);
              return { data: {} };
            },
            updateRef: async () => {
              mockGh.updateRefCalls += 1;
              return { data: {} };
            },
          },
          search: {
            repos: async (args: Record<string, unknown>) => {
              mockGh.searchReposCalls.push(args);
              if (mockGh.searchReposStatus !== null) {
                const err = new Error("github search failed") as Error & {
                  status: number;
                };
                err.status = mockGh.searchReposStatus;
                throw err;
              }
              return {
                data: {
                  total_count: mockGh.searchReposData.length,
                  incomplete_results: false,
                  items: mockGh.searchReposData,
                },
              };
            },
          },
          pulls: {
            create: async () => {
              mockGh.prCalls += 1;
              return {
                data: {
                  html_url: `https://github.com/${mockGh.repoInfo.owner}/${mockGh.repoInfo.name}/pull/1`,
                },
              };
            },
          },
    },
  };
}

// Spread `...actual` so EVERY export `integrations.ts` imports from this module
// (GITHUB_TOKEN_RE, GitHubNotConnectedError, the OAuth helpers, …) is present —
// otherwise an unlisted import is `undefined` at module load and the whole suite
// fails to import. We override only the one boundary that would reach the network:
// `getGitHubClientFromToken`, which we replace with a fake Octokit each test drives.
vi.mock("../src/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/github")>();
  return {
    ...actual,
    getGitHubClientFromToken: () => buildFakeGitHubClient(),
  };
});

// ---------- Auth mock ----------
// Drive the router as different seeded users via an `x-test-user-id` header,
// hydrating the same request shape `requireAuth` would (localUser, subscriber,
// effectiveTier) so the real `requireTier("ARCHITECT")` gate runs unmodified.
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { db: d, usersTable: u, commandCentreSubscribersTable: s } =
      await import("@workspace/db");
    const { eq: e } = await import("drizzle-orm");
    const headerVal = req.headers["x-test-user-id"];
    const userId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!userId) {
      res.status(401).json({ error: "test user header missing" });
      return;
    }
    const [user] = await d.select().from(u).where(eq(u.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "test user not found" });
      return;
    }
    const [sub] = await d
      .select()
      .from(s)
      .where(e(s.userId, user.id))
      .limit(1);
    req.localUser = user;
    req.subscriber = sub!;
    req.effectiveTier = sub!.tier;
    req.memberships = [];
    next();
  };
  return { ...actual, requireAuth };
});

// ---------- Helpers ----------
function injectLog(req: Request, _res: Response, next: NextFunction): void {
  const noop = (): void => {};
  (req as unknown as { log: Record<string, unknown> }).log = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => (req as unknown as { log: unknown }).log,
  };
  next();
}

async function seedGithubCredential(userId: string): Promise<void> {
  const { encryptApiKey } = await import("../src/lib/integration-crypto");
  await db.insert(integrationCredentialsTable).values({
    userId,
    provider: "github",
    label: "octo-tester",
    keyPrefix: "ghp_testtoken000",
    keyEncrypted: encryptApiKey("ghp_testtoken0000000000000000000000000000"),
  });
}

async function startApp(
  app: Express,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no test server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const PUSH_PATH = "/api/integrations/github/push-codebase";

// ---------- Fixtures ----------
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let architectId = "";
let explorerId = "";
let architectNoGhId = "";
let sessionId = "";
let bundleArtifactId = "";
let spcArtifactId = "";
let noGhBundleArtifactId = "";
let srv: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  const [arch] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_ghpush_arch_${stamp}`,
      email: `ghpush-arch-${stamp}@example.test`,
    })
    .returning();
  const [exp] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_ghpush_exp_${stamp}`,
      email: `ghpush-exp-${stamp}@example.test`,
    })
    .returning();
  // An Architect-tier user who has NOT connected GitHub (no credential row),
  // used to exercise the GITHUB_NOT_CONNECTED path past the tier gate.
  const [archNoGh] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_ghpush_nogh_${stamp}`,
      email: `ghpush-nogh-${stamp}@example.test`,
    })
    .returning();
  architectId = arch!.id;
  explorerId = exp!.id;
  architectNoGhId = archNoGh!.id;

  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: architectId, tier: "ARCHITECT", status: "active" });
  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: explorerId, tier: "EXPLORER", status: "inactive" });
  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: architectNoGhId, tier: "ARCHITECT", status: "active" });

  // Seed the architect's per-user GitHub credential. The push route looks this
  // row up (by userId + provider) and decrypts the token before minting a
  // client. The token value itself is irrelevant — `getGitHubClientFromToken`
  // is mocked — but the row must exist and decrypt cleanly.
  await seedGithubCredential(architectId);

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({ userId: architectId, sessionName: "GH push test session" })
    .returning();
  sessionId = session!.id;

  const [bundle] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId,
      userId: architectId,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { note: "scaffold" },
    })
    .returning();
  bundleArtifactId = bundle!.id;

  const [spc] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId,
      userId: architectId,
      featureId: 5,
      artifactType: "SPC",
      artifactContent: { note: "spc" },
    })
    .returning();
  spcArtifactId = spc!.id;

  // A bundle owned by the GitHub-less architect (ownership is checked before the
  // credential lookup, so this user needs their own bundle to reach the 503).
  const [noGhSession] = await db
    .insert(harnessSessionsTable)
    .values({ userId: architectNoGhId, sessionName: "GH push no-cred session" })
    .returning();
  const [noGhBundle] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: noGhSession!.id,
      userId: architectNoGhId,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { note: "scaffold" },
    })
    .returning();
  noGhBundleArtifactId = noGhBundle!.id;

  const app = express();
  app.use(injectLog);
  // NOTE: production `app.ts` mounts `express.json()` with the DEFAULT 100kb
  // limit, which shadows this route's own 2MB `BUNDLE_TOO_LARGE` guard (and the
  // zod per-file/file-count limits, which together allow ~6MB) — a real bundle
  // over 100kb is rejected by the body parser with a 413 *before* reaching the
  // handler. We raise the limit here so the route's own oversize guard is the
  // thing under test. See the BUNDLE_TOO_LARGE test below.
  app.use(express.json({ limit: "10mb" }));
  const integrationsRouter = (await import("../src/routes/integrations")).default;
  app.use("/api", integrationsRouter);
  srv = await startApp(app);
});

afterAll(async () => {
  await srv.close();
  // users cascade to subscribers, sessions, and artifacts.
  await db
    .delete(usersTable)
    .where(inArray(usersTable.id, [architectId, explorerId, architectNoGhId]));
});

beforeEach(() => {
  mockGh.reset();
});

function push(
  userId: string,
  body: unknown,
): Promise<Response & { json: () => Promise<unknown> }> {
  return fetch(`${srv.url}${PUSH_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-user-id": userId,
    },
    body: JSON.stringify(body),
  }) as unknown as Promise<Response & { json: () => Promise<unknown> }>;
}

const validFiles = {
  "README.md": "# Scaffold\n",
  "src/index.ts": "export const hi = 1;\n",
};

// ---------- Tests ----------
describe("POST /integrations/github/push-codebase", () => {
  test("happy path: pushes, returns repoFullName + replitImportUrl, persists githubRepo pointer", async () => {
    const repoName = `scaffold-${stamp}`;
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName,
      files: validFiles,
    });
    const body = (await res.json()) as {
      ok: boolean;
      owner: string;
      repo: string;
      repoFullName: string;
      htmlUrl: string;
      defaultBranch: string;
      replitImportUrl: string;
    };
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.owner).toBe("octo-tester");
    expect(body.repo).toBe(repoName);
    expect(body.repoFullName).toBe(`octo-tester/${repoName}`);
    expect(body.replitImportUrl).toBe(
      `https://replit.com/github/octo-tester/${repoName}`,
    );
    expect(body.defaultBranch).toBe("main");

    // Default visibility is private; the tree carried both files; the branch ref was set.
    expect(mockGh.createdCalls).toEqual([{ name: repoName, private: true }]);
    expect(mockGh.treeFiles.map((t) => t.path).sort()).toEqual([
      "README.md",
      "src/index.ts",
    ]);
    expect(mockGh.refCalls).toBe(1);

    // The pointer is persisted onto the bundle artifact for lineage / "already pushed" UI.
    const [row] = await db
      .select()
      .from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.id, bundleArtifactId))
      .limit(1);
    const githubRepo = (
      row!.artifactContent as { githubRepo?: Record<string, unknown> }
    ).githubRepo;
    expect(githubRepo).toBeDefined();
    expect(githubRepo!.fullName).toBe(`octo-tester/${repoName}`);
    expect(githubRepo!.replitImportUrl).toBe(
      `https://replit.com/github/octo-tester/${repoName}`,
    );
    expect(githubRepo!.defaultBranch).toBe("main");
    expect(githubRepo!.private).toBe(true);
    expect(typeof githubRepo!.pushedAt).toBe("string");
  });

  test("respects an explicit private:false", async () => {
    const repoName = `public-${stamp}`;
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName,
      files: validFiles,
      private: false,
    });
    expect(res.status).toBe(200);
    expect(mockGh.createdCalls).toEqual([{ name: repoName, private: false }]);
  });

  test("422 from repo create maps to 409 GITHUB_REPO_EXISTS", async () => {
    mockGh.createRepoStatus = 422;
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `dupe-${stamp}`,
      files: validFiles,
    });
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(409);
    expect(body.code).toBe("GITHUB_REPO_EXISTS");
    // No tree should have been built once create failed.
    expect(mockGh.refCalls).toBe(0);
  });

  test("an architect without a stored GitHub token maps to 503 GITHUB_NOT_CONNECTED", async () => {
    const res = await push(architectNoGhId, {
      artifactId: noGhBundleArtifactId,
      repoName: `noconn-${stamp}`,
      files: validFiles,
    });
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(503);
    expect(body.code).toBe("GITHUB_NOT_CONNECTED");
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("an authenticate failure (token present, call fails) maps to 502 GITHUB_AUTH_FAILED", async () => {
    mockGh.authThrows = true;
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `authfail-${stamp}`,
      files: validFiles,
    });
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(502);
    expect(body.code).toBe("GITHUB_AUTH_FAILED");
  });

  test("a tree/commit failure after repo create maps to 502 GITHUB_PUSH_FAILED with the repo url", async () => {
    mockGh.treeThrows = true;
    const repoName = `treefail-${stamp}`;
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName,
      files: validFiles,
    });
    const body = (await res.json()) as { code?: string; repoUrl?: string };
    expect(res.status).toBe(502);
    expect(body.code).toBe("GITHUB_PUSH_FAILED");
    expect(body.repoUrl).toBe(`https://github.com/octo-tester/${repoName}`);
  });

  test("non-CODEBASE_BUNDLE artifacts are rejected (400 GITHUB_WRONG_TYPE)", async () => {
    const res = await push(architectId, {
      artifactId: spcArtifactId,
      repoName: `wrongtype-${stamp}`,
      files: validFiles,
    });
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe("GITHUB_WRONG_TYPE");
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("a non-existent / unowned artifact id is not found (404)", async () => {
    const res = await push(architectId, {
      artifactId: "00000000-0000-0000-0000-000000000000",
      repoName: `notfound-${stamp}`,
      files: validFiles,
    });
    expect(res.status).toBe(404);
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("non-Architect tier is blocked (403)", async () => {
    const res = await push(explorerId, {
      artifactId: bundleArtifactId,
      repoName: `tierblock-${stamp}`,
      files: validFiles,
    });
    const body = (await res.json()) as { error?: string };
    expect(res.status).toBe(403);
    expect(body.error).toContain("ARCHITECT");
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("path-traversal file keys are rejected (400)", async () => {
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `traversal-${stamp}`,
      files: { "../escape.txt": "nope" },
    });
    const body = (await res.json()) as { error?: string };
    expect(res.status).toBe(400);
    expect(body.error ?? "").toMatch(/traversal|relative/i);
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("absolute file keys are rejected (400)", async () => {
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `abs-${stamp}`,
      files: { "/etc/passwd": "nope" },
    });
    expect(res.status).toBe(400);
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("an oversized bundle is rejected (400 BUNDLE_TOO_LARGE)", async () => {
    // 21 files x 100k chars = 2.1MB > the 2MB ceiling, while staying within the
    // per-file (<=100k) and file-count (<=60) zod limits so we hit the byte cap.
    const big: Record<string, string> = {};
    for (let i = 0; i < 21; i += 1) {
      big[`file-${i}.txt`] = "a".repeat(100_000);
    }
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `big-${stamp}`,
      files: big,
    });
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe("BUNDLE_TOO_LARGE");
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  test("an empty file set is rejected (400)", async () => {
    const res = await push(architectId, {
      artifactId: bundleArtifactId,
      repoName: `empty-${stamp}`,
      files: {},
    });
    expect(res.status).toBe(400);
    expect(mockGh.createdCalls).toHaveLength(0);
  });

  describe("existing-repo mode", () => {
    test("pushes onto a populated existing repo with a parented update commit", async () => {
      mockGh.repoInfo = {
        owner: "octo-tester",
        name: "populated-repo",
        defaultBranch: "main",
        private: true,
      };
      mockGh.getRefStatus = null; // HEAD exists → parent onto it.
      const res = await push(architectId, {
        artifactId: bundleArtifactId,
        mode: "existing",
        targetRepo: "octo-tester/populated-repo",
        files: validFiles,
      });
      const body = (await res.json()) as {
        ok: boolean;
        created: boolean;
        repoFullName: string;
      };
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.created).toBe(false);
      expect(body.repoFullName).toBe("octo-tester/populated-repo");
      // No repo was created; the commit parented onto HEAD; the ref was updated.
      expect(mockGh.createdCalls).toHaveLength(0);
      expect(mockGh.commitParents).toEqual([["head-sha"]]);
      expect(mockGh.updateRefCalls).toBe(1);
      expect(mockGh.refCalls).toBe(0);
    });

    test("seeds a brand-new EMPTY existing repo with a parentless initial commit", async () => {
      mockGh.repoInfo = {
        owner: "octo-tester",
        name: "fresh-empty-repo",
        defaultBranch: "main",
        private: false,
      };
      mockGh.getRefStatus = 404; // No default-branch ref yet → empty repo.
      const res = await push(architectId, {
        artifactId: bundleArtifactId,
        mode: "existing",
        targetRepo: "octo-tester/fresh-empty-repo",
        files: validFiles,
      });
      const body = (await res.json()) as {
        ok: boolean;
        created: boolean;
        repoFullName: string;
        defaultBranch: string;
      };
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(body.ok).toBe(true);
      // The repo existed but we created its first commit — flagged like a create.
      expect(body.created).toBe(true);
      expect(body.repoFullName).toBe("octo-tester/fresh-empty-repo");
      expect(body.defaultBranch).toBe("main");
      // We never created the repo itself, the seed commit had NO parents, and the
      // default-branch ref was created (not updated).
      expect(mockGh.createdCalls).toHaveLength(0);
      expect(mockGh.commitParents).toEqual([[]]);
      expect(mockGh.createdRefs).toEqual(["refs/heads/main"]);
      expect(mockGh.updateRefCalls).toBe(0);
      // The bundle pointer captures the now-populated repo.
      const [row] = await db
        .select()
        .from(harnessArtifactsTable)
        .where(eq(harnessArtifactsTable.id, bundleArtifactId))
        .limit(1);
      const githubRepo = (
        row!.artifactContent as { githubRepo?: Record<string, unknown> }
      ).githubRepo;
      expect(githubRepo!.fullName).toBe("octo-tester/fresh-empty-repo");
      expect(githubRepo!.defaultBranch).toBe("main");
    });

    test("seeds an empty repo on its real default branch even when a PR was requested", async () => {
      mockGh.repoInfo = {
        owner: "octo-tester",
        name: "empty-trunk-repo",
        defaultBranch: "trunk",
        private: true,
      };
      mockGh.getRefStatus = 404;
      const res = await push(architectId, {
        artifactId: bundleArtifactId,
        mode: "existing",
        targetRepo: "octo-tester/empty-trunk-repo",
        files: validFiles,
        pullRequest: true,
      });
      const body = (await res.json()) as {
        created: boolean;
        defaultBranch: string;
        pullRequestUrl?: string | null;
      };
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(body.created).toBe(true);
      expect(body.defaultBranch).toBe("trunk");
      // An empty repo has no base to diff against — no PR is opened, the seed
      // lands directly on the resolved default branch.
      expect(mockGh.prCalls).toBe(0);
      expect(mockGh.commitParents).toEqual([[]]);
      expect(mockGh.createdRefs).toEqual(["refs/heads/trunk"]);
      expect(body.pullRequestUrl ?? null).toBeNull();
    });

    test("a missing / unauthorized target repo still errors clearly (404)", async () => {
      mockGh.repoGetStatus = 404;
      const res = await push(architectId, {
        artifactId: bundleArtifactId,
        mode: "existing",
        targetRepo: "octo-tester/does-not-exist",
        files: validFiles,
      });
      const body = (await res.json()) as { code?: string };
      expect(res.status).toBe(404);
      expect(body.code).toBe("GITHUB_REPO_NOT_FOUND");
      expect(mockGh.commitParents).toHaveLength(0);
    });
  });
});

// ---------- Repo-list endpoint ----------
const REPOS_PATH = "/api/integrations/github/repos";

function listRepos(
  userId: string,
  query = "",
): Promise<Response & { json: () => Promise<unknown> }> {
  return fetch(`${srv.url}${REPOS_PATH}${query}`, {
    headers: { "x-test-user-id": userId },
  }) as unknown as Promise<Response & { json: () => Promise<unknown> }>;
}

// Build a raw GitHub-API-shaped repo row (what `listForAuthenticatedUser`
// returns), so the route's filter/map logic is what's under test.
function rawRepo(
  name: string,
  opts: { push?: boolean; private?: boolean; pushedAt?: string | null } = {},
): Record<string, unknown> {
  const owner = "octo-tester";
  return {
    full_name: `${owner}/${name}`,
    owner: { login: owner },
    name,
    private: opts.private ?? false,
    default_branch: "main",
    html_url: `https://github.com/${owner}/${name}`,
    pushed_at: opts.pushedAt === undefined ? "2026-01-01T00:00:00Z" : opts.pushedAt,
    permissions: { push: opts.push ?? true },
  };
}

type RepoListBody = {
  repos: Array<{
    fullName: string;
    owner: string;
    name: string;
    private: boolean;
    defaultBranch: string;
    htmlUrl: string;
    pushedAt: string | null;
  }>;
  page: number;
  hasMore: boolean;
};

describe("GET /integrations/github/repos", () => {
  test("returns only push-eligible repos, mapped to the picker shape", async () => {
    mockGh.listReposData = [
      rawRepo("can-push", { push: true, private: true }),
      rawRepo("read-only", { push: false }),
      rawRepo("also-pushable", { push: true, pushedAt: null }),
    ];
    const res = await listRepos(architectId);
    const body = (await res.json()) as RepoListBody;
    expect(res.status, JSON.stringify(body)).toBe(200);
    // The non-pushable repo is dropped; only the two push:true repos survive.
    expect(body.repos.map((r) => r.name).sort()).toEqual([
      "also-pushable",
      "can-push",
    ]);
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(false);
    // Field mapping from the raw GitHub shape.
    const canPush = body.repos.find((r) => r.name === "can-push")!;
    expect(canPush).toMatchObject({
      fullName: "octo-tester/can-push",
      owner: "octo-tester",
      name: "can-push",
      private: true,
      defaultBranch: "main",
      htmlUrl: "https://github.com/octo-tester/can-push",
      pushedAt: "2026-01-01T00:00:00Z",
    });
    // A null pushed_at maps through as null rather than being dropped.
    const alsoPushable = body.repos.find((r) => r.name === "also-pushable")!;
    expect(alsoPushable.pushedAt).toBeNull();
    // Default request asks for the pushed-desc first page.
    expect(mockGh.listReposCalls).toHaveLength(1);
    expect(mockGh.listReposCalls[0]).toMatchObject({
      page: 1,
      sort: "pushed",
      direction: "desc",
    });
  });

  test("a q query is backed by GitHub's search API scoped to the login, and still push-filtered", async () => {
    // The route delegates matching to GitHub's search API (so any repo across
    // the whole account surfaces, not just the recency page), then keeps only
    // push-eligible results. We return one non-pushable item to prove the
    // push filter still applies to search results.
    mockGh.searchReposData = [
      rawRepo("alpha-service", { push: true }),
      rawRepo("legacy-alpha", { push: true }),
      rawRepo("alpha-readonly", { push: false }),
    ];
    const res = await listRepos(architectId, "?q=ALPHA");
    const body = (await res.json()) as RepoListBody;
    expect(res.status, JSON.stringify(body)).toBe(200);
    // The recency list endpoint must NOT be used for a search query.
    expect(mockGh.listReposCalls).toHaveLength(0);
    expect(mockGh.searchReposCalls).toHaveLength(1);
    // Query is scoped to the connected login and to repo names; the term is
    // lower-cased by the route before being embedded.
    expect(mockGh.searchReposCalls[0]).toMatchObject({
      q: "alpha in:name user:octo-tester fork:true",
      page: 1,
    });
    // Non-pushable search hits are dropped; the two push:true repos survive.
    expect(body.repos.map((r) => r.name).sort()).toEqual([
      "alpha-service",
      "legacy-alpha",
    ]);
  });

  test("a q-search failure maps to 502 GITHUB_LIST_FAILED", async () => {
    mockGh.searchReposStatus = 500;
    const res = await listRepos(architectId, "?q=anything");
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(502);
    expect(body.code).toBe("GITHUB_LIST_FAILED");
    expect(mockGh.listReposCalls).toHaveLength(0);
  });

  test("non-Architect tier is blocked (403)", async () => {
    mockGh.listReposData = [rawRepo("anything", { push: true })];
    const res = await listRepos(explorerId);
    const body = (await res.json()) as { error?: string };
    expect(res.status).toBe(403);
    expect(body.error).toContain("ARCHITECT");
    // The tier gate runs before any GitHub call.
    expect(mockGh.listReposCalls).toHaveLength(0);
  });

  test("an architect without a stored token maps to 503 GITHUB_NOT_CONNECTED", async () => {
    const res = await listRepos(architectNoGhId);
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(503);
    expect(body.code).toBe("GITHUB_NOT_CONNECTED");
    expect(mockGh.listReposCalls).toHaveLength(0);
  });

  test("a rejected token maps to 401 GITHUB_BAD_TOKEN", async () => {
    mockGh.listReposStatus = 401;
    const res = await listRepos(architectId);
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(401);
    expect(body.code).toBe("GITHUB_BAD_TOKEN");
  });

  test("any other GitHub failure maps to 502 GITHUB_LIST_FAILED", async () => {
    mockGh.listReposStatus = 500;
    const res = await listRepos(architectId);
    const body = (await res.json()) as { code?: string };
    expect(res.status).toBe(502);
    expect(body.code).toBe("GITHUB_LIST_FAILED");
  });
});
