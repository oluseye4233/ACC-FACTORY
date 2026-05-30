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
