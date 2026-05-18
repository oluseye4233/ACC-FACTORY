import { and, eq, sql } from "drizzle-orm";
import { db, harnessArtifactsTable, commandCentreBadgesTable, type BadgeId } from "@workspace/db";

export interface BadgeProgress {
  badgeId: BadgeId;
  status: "LOCKED" | "UNLOCKED" | "CLAIMED";
  eligible: boolean;
  progress: Record<string, number>;
  requirements: Record<string, number>;
  evidence: Record<string, unknown>;
  unlockedAt: string | null;
  claimedAt: string | null;
}

export const AISE_DOMAIN_ALLOWLIST: { kind: string; pattern: RegExp }[] = [
  { kind: "gpt", pattern: /^https:\/\/chatgpt\.com\/g\/.+/i },
  { kind: "gpt", pattern: /^https:\/\/chat\.openai\.com\/g\/.+/i },
  { kind: "copilot", pattern: /^https:\/\/copilot\.microsoft\.com\//i },
  { kind: "copilot", pattern: /^https:\/\/github\.com\/marketplace\/copilot\//i },
  { kind: "copilot", pattern: /^https:\/\/github\.com\/copilot\//i },
  { kind: "native_app", pattern: /^https:\/\/(apps\.apple\.com|play\.google\.com|chrome\.google\.com\/webstore|chromewebstore\.google\.com)\//i },
  // SPC-DNA agent — anything else hosted with a TLD passes a basic shape check.
  { kind: "spc_dna_agent", pattern: /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i },
];

export function classifyAiseUrl(url: string): { ok: boolean; kind: string | null } {
  for (const entry of AISE_DOMAIN_ALLOWLIST) {
    if (entry.pattern.test(url)) return { ok: true, kind: entry.kind };
  }
  return { ok: false, kind: null };
}

import { promises as dns } from "node:dns";
import net from "node:net";

/** Block loopback, link-local, private, and metadata-service ranges (basic SSRF guard). */
function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map((n) => Number.parseInt(n, 10));
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return false;
  }
  return true;
}

async function hostResolvesPublic(hostname: string): Promise<boolean> {
  if (net.isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

export async function headOk(url: string, timeoutMs = 5000): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!(await hostResolvesPublic(parsed.hostname))) return false;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    if (r.ok) return true;
    // Some sites 405 HEAD — fall back to GET range
    const g = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
    });
    return g.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function countByType(
  userId: string,
  type:
    | "PROMPT_DIAGNOSTIC"
    | "ATOMIC_PROMPT"
    | "MA_BIRTH_PACKAGE"
    | "MICRO_PDD"
    | "SPC"
    | "ATLAS_PDD"
    | "MVP_PDD",
): Promise<number> {
  const rows = await db
    .select({ c: sql<string>`count(*)` })
    .from(harnessArtifactsTable)
    .where(
      and(eq(harnessArtifactsTable.userId, userId), eq(harnessArtifactsTable.artifactType, type)),
    );
  return Number(rows[0]?.c ?? 0);
}

export async function computeBadgeProgress(userId: string): Promise<BadgeProgress[]> {
  const [spcs, mas, atlas, micro, mvp, stored] = await Promise.all([
    countByType(userId, "SPC"),
    countByType(userId, "MA_BIRTH_PACKAGE"),
    countByType(userId, "ATLAS_PDD"),
    countByType(userId, "MICRO_PDD"),
    countByType(userId, "MVP_PDD"),
    db.select().from(commandCentreBadgesTable).where(eq(commandCentreBadgesTable.userId, userId)),
  ]);

  const byId = new Map(stored.map((b) => [b.badgeId, b]));

  const aspeEligible = spcs >= 3 && mas >= 4;
  const aisaEligible = atlas >= 1 && micro >= 1 && mvp >= 1;
  const aiseRow = byId.get("AISE");
  const aiseEligible = !!aiseRow && aiseRow.status === "CLAIMED";

  function pack(
    badgeId: BadgeId,
    eligible: boolean,
    progress: Record<string, number>,
    requirements: Record<string, number>,
  ): BadgeProgress {
    const row = byId.get(badgeId);
    let status: "LOCKED" | "UNLOCKED" | "CLAIMED" = "LOCKED";
    if (row?.status === "CLAIMED") status = "CLAIMED";
    else if (eligible || row?.status === "UNLOCKED") status = "UNLOCKED";
    return {
      badgeId,
      status,
      eligible,
      progress,
      requirements,
      evidence: (row?.evidence as Record<string, unknown> | undefined) ?? {},
      unlockedAt: row?.unlockedAt ? row.unlockedAt.toISOString() : null,
      claimedAt: row?.claimedAt ? row.claimedAt.toISOString() : null,
    };
  }

  return [
    pack("ASPE", aspeEligible, { spcs, mas }, { spcs: 3, mas: 4 }),
    pack("AISA", aisaEligible, { atlas, micro, mvp }, { atlas: 1, micro: 1, mvp: 1 }),
    pack("AISE", aiseEligible, { verifiedUrls: aiseRow ? 1 : 0 }, { verifiedUrls: 1 }),
  ];
}

/** Returns true iff the user has unlocked (or claimed) the badge. */
export async function hasBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  const all = await computeBadgeProgress(userId);
  const b = all.find((x) => x.badgeId === badgeId);
  return !!b && (b.status === "UNLOCKED" || b.status === "CLAIMED");
}
