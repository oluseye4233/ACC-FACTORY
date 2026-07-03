/**
 * sync-github — mirror new local commits to the GitHub repo (ACC-FACTORY).
 *
 * Incremental snapshot sync via the GitHub Data API (blobs/trees/commits):
 * it never rewrites remote history and never force-pushes. Each run creates
 * at most ONE remote commit whose tree applies the local diff since the last
 * synced local commit on top of the current remote tree, and stamps a
 * `Replit-Commit: <local sha>` trailer so the next run knows where to resume.
 *
 * Why not `git push`: the OAuth connector token lacks the `workflow` scope,
 * so any push containing `.github/workflows/*` changes is rejected outright.
 * The API path lets us simply exclude those files.
 *
 * The GitHub token is fetched fresh from the Replit connector on every run
 * (tokens expire) and is never logged.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run sync-github            # normal run
 *   pnpm --filter @workspace/scripts run sync-github -- --base=<sha>
 *     # first run / recovery: explicitly state which local commit the remote
 *     # tree currently corresponds to (when no Replit-Commit trailer exists).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OWNER = "oluseye4233";
const REPO = "ACC-FACTORY";
const BRANCH = "main";
const EXCLUDE_PREFIXES = [".github/workflows/"];
const TRAILER = "Replit-Commit:";
const API = "https://api.github.com";

async function git(args: string[], opts: { binary?: boolean } = {}): Promise<string | Buffer> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot(),
    maxBuffer: 200 * 1024 * 1024,
    encoding: opts.binary ? ("buffer" as const) : ("utf8" as const),
  } as never);
  return stdout as string | Buffer;
}

function repoRoot(): string {
  // scripts run with CWD=scripts/ under pnpm --filter; the repo root is one up.
  return new URL("../..", import.meta.url).pathname;
}

async function getGithubToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) {
    throw new Error("Replit connector environment not available (REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY)");
  }
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "github");
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  if (!response.ok) throw new Error(`connector lookup failed: HTTP ${response.status}`);
  const data = (await response.json()) as {
    items?: Array<{ settings?: { access_token?: string; oauth?: { credentials?: { access_token?: string } } } }>;
  };
  const settings = data.items?.[0]?.settings;
  const token = settings?.access_token ?? settings?.oauth?.credentials?.access_token;
  if (!token) throw new Error("GitHub connection not found or missing access token");
  return token;
}

function makeApi(token: string) {
  return async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API ${method} ${path} failed: HTTP ${response.status} ${text.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  };
}

function isExcluded(path: string): boolean {
  return EXCLUDE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

interface Change {
  status: "upsert" | "delete";
  path: string;
}

async function parseChanges(baseSha: string, headSha: string): Promise<Change[]> {
  const raw = (await git([
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    baseSha,
    headSha,
  ])) as string;
  const parts = raw.split("\0").filter(Boolean);
  const changes: Change[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const status = parts[i][0];
    const path = parts[i + 1];
    if (isExcluded(path)) continue;
    if (status === "D") changes.push({ status: "delete", path });
    else changes.push({ status: "upsert", path }); // A, M, T
  }
  return changes;
}

async function fileMode(headSha: string, path: string): Promise<string> {
  const line = (await git(["ls-tree", headSha, "--", path])) as string;
  const mode = line.trim().split(/\s+/)[0];
  if (mode === "160000") throw new Error(`submodule not supported: ${path}`);
  return mode || "100644";
}

type Api = ReturnType<typeof makeApi>;

async function syncOnce(api: Api, baseArg: string | undefined, headSha: string): Promise<void> {
  const remoteRef = await api<{ object: { sha: string } }>("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const remoteHeadSha = remoteRef.object.sha;
  const remoteHead = await api<{ tree: { sha: string }; message: string }>(
    "GET",
    `/repos/${OWNER}/${REPO}/git/commits/${remoteHeadSha}`,
  );

  const trailerMatch = remoteHead.message.match(new RegExp(`${TRAILER}\\s*([0-9a-f]{7,40})`));
  const baseSha = baseArg ?? trailerMatch?.[1];
  if (!baseSha) {
    throw new Error(
      `Cannot determine the last synced local commit: the remote head commit has no "${TRAILER}" trailer. ` +
        `Re-run with --base=<local sha whose tree matches the remote> once; subsequent runs are automatic.`,
    );
  }

  const fullBaseSha = ((await git(["rev-parse", baseSha])) as string).trim();
  if (fullBaseSha === headSha) {
    console.log(`[sync-github] up to date (remote already at local ${headSha.slice(0, 7)})`);
    return;
  }
  try {
    await git(["merge-base", "--is-ancestor", fullBaseSha, headSha]);
  } catch {
    throw new Error(
      `Last synced commit ${fullBaseSha.slice(0, 7)} is not an ancestor of HEAD ${headSha.slice(0, 7)} ` +
        `(history rewritten?). Re-run with an explicit --base=<sha>.`,
    );
  }

  const changes = await parseChanges(fullBaseSha, headSha);
  console.log(
    `[sync-github] syncing ${fullBaseSha.slice(0, 7)}..${headSha.slice(0, 7)}: ${changes.length} changed file(s)`,
  );

  // Create blobs for upserts with limited concurrency.
  const treeEntries: Array<{ path: string; mode: string; type: "blob"; sha: string | null }> = [];
  const upserts = changes.filter((c) => c.status === "upsert");
  const CONCURRENCY = 5;
  for (let i = 0; i < upserts.length; i += CONCURRENCY) {
    const batch = upserts.slice(i, i + CONCURRENCY);
    const entries = await Promise.all(
      batch.map(async (change) => {
        const content = (await git(["cat-file", "blob", `${headSha}:${change.path}`], { binary: true })) as Buffer;
        const blob = await api<{ sha: string }>("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
          content: content.toString("base64"),
          encoding: "base64",
        });
        return { path: change.path, mode: await fileMode(headSha, change.path), type: "blob" as const, sha: blob.sha };
      }),
    );
    treeEntries.push(...entries);
    if (upserts.length > CONCURRENCY) {
      console.log(`[sync-github] uploaded ${Math.min(i + CONCURRENCY, upserts.length)}/${upserts.length} blobs`);
    }
  }
  for (const change of changes) {
    if (change.status === "delete") {
      treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
    }
  }

  let newTreeSha = remoteHead.tree.sha;
  if (treeEntries.length > 0) {
    const tree = await api<{ sha: string }>("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
      base_tree: remoteHead.tree.sha,
      tree: treeEntries,
    });
    newTreeSha = tree.sha;
  }

  const subjects = ((await git(["log", "--format=%s", "--reverse", `${fullBaseSha}..${headSha}`])) as string)
    .trim()
    .split("\n")
    .filter(Boolean);
  const shown = subjects.slice(0, 20);
  const extra = subjects.length - shown.length;
  const title = shown.length === 1 ? shown[0] : `Sync ${subjects.length} commits from Replit`;
  const bodyLines = shown.length === 1 ? [] : shown.map((s) => `- ${s}`);
  if (extra > 0) bodyLines.push(`- …and ${extra} more`);
  const message =
    bodyLines.length > 0
      ? [title, "", ...bodyLines, "", `${TRAILER} ${headSha}`].join("\n")
      : [title, "", `${TRAILER} ${headSha}`].join("\n");

  const commit = await api<{ sha: string }>("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message,
    tree: newTreeSha,
    parents: [remoteHeadSha],
  });

  await api("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  console.log(
    `[sync-github] pushed ${commit.sha.slice(0, 7)} to ${OWNER}/${REPO}@${BRANCH} (local ${headSha.slice(0, 7)}, ${treeEntries.length} tree change(s))`,
  );
}

function isNonFastForwardError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /HTTP 422/.test(message) && /fast.?forward|not a fast forward|Update is not/i.test(message);
}

async function main(): Promise<void> {
  const baseArg = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
  const headSha = ((await git(["rev-parse", "HEAD"])) as string).trim();
  const api = makeApi(await getGithubToken());

  try {
    await syncOnce(api, baseArg, headSha);
  } catch (error) {
    // Two syncs can race (post-merge hook vs the periodic workflow). force:false
    // makes the loser fail with a non-fast-forward 422 — re-read the remote head
    // (now advanced by the winner, trailer included) and try exactly once more.
    if (!isNonFastForwardError(error)) throw error;
    console.log("[sync-github] ref moved during sync (concurrent run); retrying once from the new remote head");
    await syncOnce(api, undefined, headSha);
  }
}

main().catch((error: unknown) => {
  console.error(`[sync-github] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
