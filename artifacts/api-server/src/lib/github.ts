import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";

/**
 * Replit-managed GitHub connection access.
 *
 * The token is served by the Replit connectors proxy and is bound to the
 * GitHub account the Repl owner connected. It expires, so we never cache the
 * Octokit client — every call re-reads the (possibly refreshed) access token.
 */

export class GitHubNotConnectedError extends Error {
  constructor(message = "GitHub is not connected") {
    super(message);
    this.name = "GitHubNotConnectedError";
  }
}

let cachedSettings:
  | { access_token: string; expires_at?: string | null }
  | null = null;

function replitToken(): string {
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) {
    throw new GitHubNotConnectedError(
      "No Replit identity token available to reach the connectors service",
    );
  }
  return xReplitToken;
}

async function getAccessToken(): Promise<string> {
  if (
    cachedSettings?.access_token &&
    cachedSettings.expires_at &&
    new Date(cachedSettings.expires_at).getTime() > Date.now() + 30_000
  ) {
    return cachedSettings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new GitHubNotConnectedError(
      "REPLIT_CONNECTORS_HOSTNAME is not set; GitHub connector is unavailable",
    );
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: replitToken(),
      },
    },
  );
  const data = (await res.json().catch(() => null)) as {
    items?: { settings?: { access_token?: string; expires_at?: string | null } }[];
  } | null;
  const settings = data?.items?.[0]?.settings;
  const accessToken = settings?.access_token;
  if (!accessToken) {
    throw new GitHubNotConnectedError();
  }
  cachedSettings = { access_token: accessToken, expires_at: settings?.expires_at ?? null };
  return accessToken;
}

/**
 * Returns a fresh Octokit client authenticated with the connected GitHub
 * account. NEVER cache the returned client — tokens expire.
 */
export async function getUncachableGitHubClient(): Promise<Octokit> {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

/**
 * Per-user GitHub access.
 *
 * Unlike the Replit-managed connection above (which is bound to the Repl
 * owner's account), each subscriber connects their OWN GitHub by pasting a
 * personal access token in Account → Connected Services. The token is stored
 * encrypted in `integration_credentials` and decrypted only to mint a client
 * for that one request. Mirrors the per-user Sphinx credential pattern.
 */

/** GitHub personal-access-token shapes we accept (classic + fine-grained + OAuth). */
export const GITHUB_TOKEN_RE =
  /^(gh[posur]_[A-Za-z0-9]{16,255}|github_pat_[A-Za-z0-9_]{20,255})$/u;

/**
 * Returns a fresh Octokit client authenticated with a per-user personal access
 * token. NEVER cache the returned client — it is scoped to one request.
 */
export function getGitHubClientFromToken(token: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * A non-secret identifier for a stored token (its scheme prefix, e.g. `ghp_`
 * or `github_pat_`). Used as the required `key_prefix` column without leaking
 * any of the secret body — for GitHub we display the resolved login instead.
 */
export function githubTokenScheme(token: string): string {
  const m = /^(github_pat_|gh[posur]_)/u.exec(token);
  return m ? m[1]! : "token";
}

/**
 * Per-user GitHub OAuth (the one-click "Connect GitHub" flow).
 *
 * Instead of pasting a personal access token, a subscriber is sent to
 * github.com to authorize this application; GitHub redirects back with a code
 * we exchange for a user-to-server access token (`gho_…`). The resulting token
 * is stored in the SAME per-user `integration_credentials` row (provider
 * "github", label = login) that the pasted-PAT path uses, so the downstream
 * push channel is unchanged.
 *
 * Requires a registered GitHub OAuth app:
 *   - GITHUB_OAUTH_CLIENT_ID
 *   - GITHUB_OAUTH_CLIENT_SECRET
 * with the callback URL set to `<public base>/api/integrations/github/oauth/callback`.
 */

/** True when both OAuth app credentials are present, so the flow can run. */
export function githubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET,
  );
}

/**
 * Public base URL of this deployment, used to build the OAuth callback and the
 * post-flow redirect back to the front-end. Prefers the explicit
 * `PUBLIC_BASE_URL`, falling back to the first `REPLIT_DOMAINS` entry.
 */
export function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.replace(/\/$/u, "");
  if (explicit) return explicit;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : "";
}

/** The exact callback URL that must be registered on the GitHub OAuth app. */
export function githubOAuthCallbackUrl(): string {
  return `${publicBaseUrl()}/api/integrations/github/oauth/callback`;
}

/** Build the github.com authorize URL the user is redirected to. */
export function buildGitHubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
    redirect_uri: githubOAuthCallbackUrl(),
    // `repo` is required to create repos and push trees on the user's behalf.
    scope: "repo",
    state,
    allow_signup: "false",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// State is a short-lived, HMAC-signed token binding the OAuth round-trip to the
// user who started it. It is verified on callback (which has no Clerk session
// context to rely on), preventing a forged callback from attaching someone
// else's GitHub account.
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is required to sign GitHub OAuth state.");
  }
  return s;
}

export function signOAuthState(userId: string): string {
  const exp = Date.now() + OAUTH_STATE_TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${exp}.${nonce}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyOAuthState(state: string): { userId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const b64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, expStr] = payload.split(".");
  if (!userId || !expStr) return null;
  if (Date.now() > Number(expStr)) return null;
  return { userId };
}

/**
 * Exchange an OAuth `code` for a user access token. Throws on any GitHub-side
 * error (the caller maps that to a redirect with an error flag).
 */
export async function exchangeGitHubOAuthCode(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "",
      code,
      redirect_uri: githubOAuthCallbackUrl(),
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!data?.access_token) {
    throw new Error(
      data?.error_description ?? data?.error ?? "GitHub did not return an access token",
    );
  }
  return data.access_token;
}

/**
 * Best-effort revocation of a user access token via the OAuth app's grant
 * endpoint. Only meaningful for OAuth tokens; never throws.
 */
export async function revokeGitHubOAuthToken(token: string): Promise<void> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  try {
    await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch {
    // best-effort; clearing the local row is what matters for the user.
  }
}
