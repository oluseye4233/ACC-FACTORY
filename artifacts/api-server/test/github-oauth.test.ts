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
import { db, usersTable, integrationCredentialsTable } from "@workspace/db";

// ---------- github lib mock ----------
// Keep the real OAuth helpers (state signing/verifying, URL builders, config
// detection) but stub the two functions that would otherwise touch the network:
// the code→token exchange and the Octokit client used to resolve the login.
const mockGh = vi.hoisted(() => ({
  exchangeThrows: false,
  authThrows: false,
  login: "octo-oauth",
  exchangedCode: "" as string,
  revoked: "" as string,
  reset(): void {
    this.exchangeThrows = false;
    this.authThrows = false;
    this.login = "octo-oauth";
    this.exchangedCode = "";
    this.revoked = "";
  },
}));

vi.mock("../src/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/github")>();
  return {
    ...actual,
    exchangeGitHubOAuthCode: async (code: string): Promise<string> => {
      if (mockGh.exchangeThrows) throw new Error("bad code");
      mockGh.exchangedCode = code;
      return "gho_faketoken_aaaaaaaaaaaaaaaa";
    },
    getGitHubClientFromToken: () => ({
      rest: {
        users: {
          getAuthenticated: async () => {
            if (mockGh.authThrows) throw new Error("auth failed");
            return { data: { login: mockGh.login } };
          },
        },
      },
    }),
    revokeGitHubOAuthToken: async (token: string): Promise<void> => {
      mockGh.revoked = token;
    },
  };
});

// ---------- auth mock (mirrors github-push.test.ts) ----------
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { db: d, usersTable: u } = await import("@workspace/db");
    const { eq: e } = await import("drizzle-orm");
    const headerVal = req.headers["x-test-user-id"];
    const userId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!userId) {
      res.status(401).json({ error: "test user header missing" });
      return;
    }
    const [user] = await d.select().from(u).where(e(u.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "test user not found" });
      return;
    }
    req.localUser = user;
    req.memberships = [];
    next();
  };
  return { ...actual, requireAuth };
});

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

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = "";
let srv: { url: string; close: () => Promise<void> };
let signOAuthState: (uid: string) => string;
let verifyOAuthState: (s: string) => { userId: string } | null;

beforeAll(async () => {
  process.env.SESSION_SECRET ??= "test-session-secret-abcdef0123456789";
  process.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.testclientid";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "testsecret";
  process.env.PUBLIC_BASE_URL = "https://app.example.test";

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `clerk_ghoauth_${stamp}`,
      email: `ghoauth-${stamp}@example.test`,
    })
    .returning();
  userId = user!.id;

  const gh = await import("../src/lib/github");
  signOAuthState = gh.signOAuthState;
  verifyOAuthState = gh.verifyOAuthState;

  const app = express();
  app.use(injectLog);
  app.use(express.json());
  const integrationsRouter = (await import("../src/routes/integrations")).default;
  app.use("/api", integrationsRouter);
  srv = await startApp(app);
});

afterAll(async () => {
  await srv.close();
  await db.delete(usersTable).where(inArray(usersTable.id, [userId]));
});

beforeEach(async () => {
  mockGh.reset();
  process.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.testclientid";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "testsecret";
  await db
    .delete(integrationCredentialsTable)
    .where(
      and(
        eq(integrationCredentialsTable.userId, userId),
        eq(integrationCredentialsTable.provider, "github"),
      ),
    );
});

async function loadCred() {
  const [row] = await db
    .select()
    .from(integrationCredentialsTable)
    .where(
      and(
        eq(integrationCredentialsTable.userId, userId),
        eq(integrationCredentialsTable.provider, "github"),
      ),
    )
    .limit(1);
  return row;
}

describe("GitHub OAuth signed state", () => {
  test("round-trips the user id and rejects tampering", () => {
    const state = signOAuthState(userId);
    expect(verifyOAuthState(state)).toEqual({ userId });
    expect(verifyOAuthState(`${state}x`)).toBeNull();
    expect(verifyOAuthState("garbage")).toBeNull();
  });
});

describe("GET /integrations/github (status)", () => {
  test("reports oauthAvailable=true when configured", async () => {
    const res = await fetch(`${srv.url}/api/integrations/github`, {
      headers: { "x-test-user-id": userId },
    });
    const body = (await res.json()) as { connected: boolean; oauthAvailable: boolean };
    expect(res.status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.oauthAvailable).toBe(true);
  });

  test("reports oauthAvailable=false when not configured", async () => {
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    const res = await fetch(`${srv.url}/api/integrations/github`, {
      headers: { "x-test-user-id": userId },
    });
    const body = (await res.json()) as { oauthAvailable: boolean };
    expect(body.oauthAvailable).toBe(false);
  });
});

describe("GET /integrations/github/oauth/start", () => {
  test("redirects to github authorize with a verifiable state", async () => {
    const res = await fetch(`${srv.url}/api/integrations/github/oauth/start`, {
      headers: { "x-test-user-id": userId },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith("https://github.com/login/oauth/authorize?")).toBe(true);
    const url = new URL(loc);
    expect(url.searchParams.get("client_id")).toBe("Iv1.testclientid");
    expect(url.searchParams.get("scope")).toBe("repo");
    const state = url.searchParams.get("state") ?? "";
    expect(verifyOAuthState(state)).toEqual({ userId });
  });

  test("redirects to the front-end with oauth_unavailable when not configured", async () => {
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
    const res = await fetch(`${srv.url}/api/integrations/github/oauth/start`, {
      headers: { "x-test-user-id": userId },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/account?github=oauth_unavailable",
    );
  });
});

describe("GET /integrations/github/oauth/callback", () => {
  test("stores the token and redirects connected on success", async () => {
    const state = signOAuthState(userId);
    const res = await fetch(
      `${srv.url}/api/integrations/github/oauth/callback?code=abc123&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/account?github=connected",
    );
    expect(mockGh.exchangedCode).toBe("abc123");

    const cred = await loadCred();
    expect(cred).toBeDefined();
    expect(cred!.label).toBe("octo-oauth");
    expect(cred!.keyPrefix).toBe("gho_");
    expect(cred!.keyEncrypted.startsWith("enc:")).toBe(true);
  });

  test("rejects an invalid state without storing anything", async () => {
    const res = await fetch(
      `${srv.url}/api/integrations/github/oauth/callback?code=abc&state=forged`,
      { redirect: "manual" },
    );
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/account?github=error",
    );
    expect(await loadCred()).toBeUndefined();
  });

  test("propagates an authorize denial as github=denied", async () => {
    const res = await fetch(
      `${srv.url}/api/integrations/github/oauth/callback?error=access_denied`,
      { redirect: "manual" },
    );
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/account?github=denied",
    );
    expect(await loadCred()).toBeUndefined();
  });

  test("maps a failed code exchange to github=error", async () => {
    mockGh.exchangeThrows = true;
    const state = signOAuthState(userId);
    const res = await fetch(
      `${srv.url}/api/integrations/github/oauth/callback?code=bad&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/account?github=error",
    );
    expect(await loadCred()).toBeUndefined();
  });
});

describe("DELETE /integrations/github", () => {
  test("revokes the stored token before clearing it", async () => {
    // Seed a connected credential via the OAuth callback first.
    const state = signOAuthState(userId);
    await fetch(
      `${srv.url}/api/integrations/github/oauth/callback?code=seed&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(await loadCred()).toBeDefined();

    const res = await fetch(`${srv.url}/api/integrations/github`, {
      method: "DELETE",
      headers: { "x-test-user-id": userId },
    });
    const body = (await res.json()) as { connected: boolean };
    expect(res.status).toBe(200);
    expect(body.connected).toBe(false);
    expect(mockGh.revoked).toBe("gho_faketoken_aaaaaaaaaaaaaaaa");
    expect(await loadCred()).toBeUndefined();
  });
});
