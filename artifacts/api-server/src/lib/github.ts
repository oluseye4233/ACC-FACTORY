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
