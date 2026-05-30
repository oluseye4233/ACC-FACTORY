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
// cannot clean up (the granted token has no delete_repo scope). We swap the
// client factory for a fake whose behaviour each test drives via `mockGh`.
// `GitHubNotConnectedError` is kept real because the route branches on
// `err instanceof GitHubNotConnectedError`.
const mockGh = vi.hoisted(() => {
  // Mirror of the real GitHubNotConnectedError. The route imports this class
  // from the (mocked) module and branches on `err instanceof
  // GitHubNotConnectedError`; throwing this same class keeps that check valid
  // without loading the real github.ts (which pulls in @octokit/rest).
  class GitHubNotConnectedError extends Error {
    constructor(message = "GitHub is not connected") {
      super(message);
      this.name = "GitHubNotConnectedError";
    }
  }
  return {
    GitHubNotConnectedError,
    notConnected: false,
    authThrows: false,
    createRepoStatus: null as number | null,
    treeThrows: false,
    owner: "octo-tester",
    createdCalls: [] as Array<{ name: string; private: boolean }>,
    treeFiles: [] as Array<{ path: string; content: string }>,
    refCalls: 0,
    reset(): void {
      this.notConnected = false;
      this.authThrows = false;
      this.createRepoStatus = null;
      this.treeThrows = false;
      this.owner = "octo-tester";
      this.createdCalls = [];
      this.treeFiles = [];
      this.refCalls = 0;
    },
  };
});

vi.mock("../src/lib/github", async (importOriginal) => {
  // Spread the real module so non-client exports the route relies on
  // (e.g. `GITHUB_TOKEN_RE`, `githubTokenScheme`, `githubOAuthConfigured`)
  // stay intact, and override only the client factories with our fake.
  const actual = await importOriginal<typeof import("../src/lib/github")>();
  const buildFakeClient = () => ({
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
      },
      git: {
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
        createCommit: async () => ({ data: { sha: "commit-sha" } }),
        createRef: async () => {
          mockGh.refCalls += 1;
          return { data: {} };
        },
      },
    },
  });
  return {
    ...actual,
    GitHubNotConnectedError: mockGh.GitHubNotConnectedError,
    getUncachableGitHubClient: async () => {
      if (mockGh.notConnected) throw new mockGh.GitHubNotConnectedError();
      return buildFakeClient();
    },
    getGitHubClientFromToken: () => buildFakeClient(),
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
let sessionId = "";
let bundleArtifactId = "";
let spcArtifactId = "";
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
  architectId = arch!.id;
  explorerId = exp!.id;

  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: architectId, tier: "ARCHITECT", status: "active" });
  await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: explorerId, tier: "EXPLORER", status: "inactive" });

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
    .where(inArray(usersTable.id, [architectId, explorerId]));
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

  test("a missing GitHub credential maps to 503 GITHUB_NOT_CONNECTED", async () => {
    // The route treats "GitHub not connected" as the absence of a per-user
    // credential row. Drop the seeded credential, assert the 503, then restore
    // it so subsequent tests keep their connected architect.
    await db
      .delete(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.userId, architectId),
          eq(integrationCredentialsTable.provider, "github"),
        ),
      );
    try {
      const res = await push(architectId, {
        artifactId: bundleArtifactId,
        repoName: `noconn-${stamp}`,
        files: validFiles,
      });
      const body = (await res.json()) as { code?: string };
      expect(res.status).toBe(503);
      expect(body.code).toBe("GITHUB_NOT_CONNECTED");
      expect(mockGh.createdCalls).toHaveLength(0);
    } finally {
      await seedGithubCredential(architectId);
    }
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
});
