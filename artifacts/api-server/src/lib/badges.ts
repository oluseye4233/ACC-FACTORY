import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  commandCentreBadgesTable,
  contextCraftBadgesTable,
  CONTEXT_CRAFT_PILLARS,
  PILLAR_LETTERS,
  type BadgeId,
  type ContextCraftPillar,
} from "@workspace/db";

/**
 * 7 Context Craft Pillars (S/R/I/D/F/E/C) — mini-quest training badges.
 * Auto-award when an F1/F2 artifact's per-pillar JCSE sub-score crosses the
 * threshold (the "precise" band in the rubric). Persistent: once earned,
 * never lost.
 */
export const CONTEXT_CRAFT_THRESHOLD = 6;
const PILLAR_MAX: Record<ContextCraftPillar, number> = {
  SYSTEM: 7,
  ROLE: 7,
  INSTRUCTION: 8,
  DATA: 7,
  FORMAT: 7,
  EXAMPLE: 7,
  CONSTRAINT: 7,
};
// Lowercased keys as they appear in F1/F2 jcse objects.
const JCSE_KEY: Record<ContextCraftPillar, string> = {
  SYSTEM: "system",
  ROLE: "role",
  INSTRUCTION: "instruction",
  DATA: "data",
  FORMAT: "format",
  EXAMPLE: "example",
  CONSTRAINT: "constraint",
};

export interface ContextCraftBadgeProgress {
  pillar: ContextCraftPillar;
  letter: string;
  earned: boolean;
  bestScore: number;
  maxScore: number;
  threshold: number;
  firstEarnedAt: string | null;
  evidenceArtifactId: string | null;
}

/**
 * Inspect a freshly-persisted artifact and upsert any Context Craft badges the
 * pillar sub-scores qualify for. Safe to call on any artifact; only F1/F2 carry
 * a per-pillar `jcse` breakdown. Failures are swallowed (best-effort).
 */
export async function maybeAwardContextCraftBadges(
  userId: string,
  artifactId: string,
  artifactContent: Record<string, unknown>,
): Promise<void> {
  const jcse = (artifactContent.jcse ?? null) as Record<string, unknown> | null;
  if (!jcse || typeof jcse !== "object") return;
  try {
    for (const pillar of CONTEXT_CRAFT_PILLARS) {
      const raw = jcse[JCSE_KEY[pillar]];
      const score = typeof raw === "number" ? raw : null;
      if (score === null || score < CONTEXT_CRAFT_THRESHOLD) continue;
      // INSERT … ON CONFLICT DO UPDATE keeps the original `firstEarnedAt` but
      // bumps `bestScore` and updates the evidence artifact on each new best.
      await db
        .insert(contextCraftBadgesTable)
        .values({
          userId,
          pillar,
          bestScore: score,
          evidenceArtifactId: artifactId,
        })
        .onConflictDoUpdate({
          target: [contextCraftBadgesTable.userId, contextCraftBadgesTable.pillar],
          set: {
            bestScore: sql`GREATEST(${contextCraftBadgesTable.bestScore}, ${score})`,
            evidenceArtifactId: sql`CASE WHEN ${score} > ${contextCraftBadgesTable.bestScore} THEN ${artifactId} ELSE ${contextCraftBadgesTable.evidenceArtifactId} END`,
            updatedAt: new Date(),
          },
        });
    }
  } catch {
    // Best-effort: a badge-write failure must never break an engine response.
  }
}

export async function listContextCraftBadges(
  userId: string,
): Promise<ContextCraftBadgeProgress[]> {
  const rows = await db
    .select()
    .from(contextCraftBadgesTable)
    .where(eq(contextCraftBadgesTable.userId, userId));
  const byPillar = new Map(rows.map((r) => [r.pillar, r]));
  return CONTEXT_CRAFT_PILLARS.map((pillar) => {
    const row = byPillar.get(pillar);
    return {
      pillar,
      letter: PILLAR_LETTERS[pillar],
      earned: Boolean(row),
      bestScore: row?.bestScore ?? 0,
      maxScore: PILLAR_MAX[pillar],
      threshold: CONTEXT_CRAFT_THRESHOLD,
      firstEarnedAt: row?.firstEarnedAt ? row.firstEarnedAt.toISOString() : null,
      evidenceArtifactId: row?.evidenceArtifactId ?? null,
    };
  });
}

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
  const [spcs, mas, atlas, micro, mvp, pwddRows, stored] = await Promise.all([
    countByType(userId, "SPC"),
    countByType(userId, "MA_BIRTH_PACKAGE"),
    countByType(userId, "ATLAS_PDD"),
    countByType(userId, "MICRO_PDD"),
    countByType(userId, "MVP_PDD"),
    db
      .selectDistinct({ sessionId: harnessArtifactsTable.sessionId })
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.userId, userId),
          eq(harnessArtifactsTable.artifactType, "MVP_PDD"),
          isNotNull(harnessArtifactsTable.spartanCert),
        ),
      ),
    db.select().from(commandCentreBadgesTable).where(eq(commandCentreBadgesTable.userId, userId)),
  ]);

  const byId = new Map(stored.map((b) => [b.badgeId, b]));
  const pwdds = pwddRows.length;

  const aspeEligible = spcs >= 3 && mas >= 4;
  const aisaEligible = atlas >= 1 && micro >= 1 && mvp >= 1;
  const aiseRow = byId.get("AISE");
  const aiseEligible = !!aiseRow && aiseRow.status === "CLAIMED";
  const aisaPwddEligible = pwdds >= 3;
  const aiseBuildRow = byId.get("AISE_BUILD");
  const aiseBuildEligible = !!aiseBuildRow && aiseBuildRow.status === "CLAIMED";

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
    pack("AISA_PWDD", aisaPwddEligible, { pwdds }, { pwdds: 3 }),
    pack(
      "AISE_BUILD",
      aiseBuildEligible,
      { verifiedBuilds: aiseBuildRow ? 1 : 0 },
      { verifiedBuilds: 1 },
    ),
  ];
}

/** Returns true iff the user has unlocked (or claimed) the badge. */
export async function hasBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  const all = await computeBadgeProgress(userId);
  const b = all.find((x) => x.badgeId === badgeId);
  return !!b && (b.status === "UNLOCKED" || b.status === "CLAIMED");
}
