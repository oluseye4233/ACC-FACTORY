import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  harnessArtifactsTable,
  harnessEngineRunsTable,
  jstAssessmentsTable,
  readerOnboardingTable,
  type JstBand,
  type OnboardingTrack,
} from "@workspace/db";
import { listContextCraftBadges } from "./badges";
import { loadMembershipsForUser } from "./orgs";

/**
 * JST (Jobs / Skills / Talent) self-assessment scoring. Three 1-10 axes are
 * summed (3-30) and projected onto a 0-100 composite. The band is derived
 * server-side — the reader's self-reported composite is never trusted.
 */
export function scoreJst(
  jobs: number,
  skills: number,
  talent: number,
): { composite: number; band: JstBand } {
  const sum = jobs + skills + talent; // 3..30
  // Normalise the 3..30 domain onto a true 0..100 scale (min sum 3 -> 0,
  // max sum 30 -> 100), rounded to 2dp.
  const composite = Math.round(((sum - 3) / 27) * 100 * 100) / 100;
  let band: JstBand;
  if (composite < 40) band = "SEEKER";
  else if (composite < 60) band = "BUILDER";
  else if (composite < 80) band = "OPERATOR";
  else band = "ASCENDANT";
  return { composite, band };
}

export interface OnboardingState {
  track: OnboardingTrack;
  readerCode: string | null;
  startedAt: string;
}

/** Read (or lazily create) the user's onboarding row. */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const rows = await db
    .select()
    .from(readerOnboardingTable)
    .where(eq(readerOnboardingTable.userId, userId))
    .limit(1);
  if (rows.length > 0) {
    const r = rows[0]!;
    return {
      track: r.track,
      readerCode: r.readerCode,
      startedAt: r.startedAt.toISOString(),
    };
  }
  const [created] = await db
    .insert(readerOnboardingTable)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return {
      track: created.track,
      readerCode: created.readerCode,
      startedAt: created.startedAt.toISOString(),
    };
  }
  // Lost a race — re-read.
  const again = await db
    .select()
    .from(readerOnboardingTable)
    .where(eq(readerOnboardingTable.userId, userId))
    .limit(1);
  const r = again[0]!;
  return {
    track: r.track,
    readerCode: r.readerCode,
    startedAt: r.startedAt.toISOString(),
  };
}

export interface AscensionRung {
  index: number;
  key: string;
  title: string;
  role: string;
  engine: string;
  chapter: string;
  blurb: string;
  complete: boolean;
  current: boolean;
  progress: number;
  target: number;
  actionLabel: string;
  actionHref: string;
}

export interface AscensionJourney {
  track: OnboardingTrack;
  readerCode: string | null;
  completedCount: number;
  totalCount: number;
  band: JstBand | null;
  rungs: AscensionRung[];
}

async function countArtifacts(userId: string, type: string): Promise<number> {
  const rows = await db
    .select({ c: sql<string>`count(*)` })
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, type as never),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

async function countCertifiedMvp(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<string>`count(*)` })
    .from(harnessArtifactsTable)
    .where(
      and(
        eq(harnessArtifactsTable.userId, userId),
        eq(harnessArtifactsTable.artifactType, "MVP_PDD" as never),
        isNotNull(harnessArtifactsTable.spartanCert),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

/** Map engineId -> total run count for the user (one pass). */
async function engineRunCounts(userId: string): Promise<Map<number, number>> {
  const rows = await db
    .select({
      engineId: harnessEngineRunsTable.engineId,
      c: sql<string>`count(*)`,
    })
    .from(harnessEngineRunsTable)
    .where(eq(harnessEngineRunsTable.userId, userId))
    .groupBy(harnessEngineRunsTable.engineId);
  return new Map(rows.map((r) => [r.engineId, Number(r.c)]));
}

/**
 * Compose the ordered Ascension Protocol ladder from real platform signals.
 * Each rung is anchored to a chapter of *The Atomic Prompt* and proven by an
 * actual engine run, artifact, badge, or membership — never self-reported.
 */
export async function computeAscension(userId: string): Promise<AscensionJourney> {
  const [
    onboarding,
    jstRows,
    pillars,
    diagnostics,
    atomicPrompts,
    spcs,
    atlasPdds,
    certifiedMvp,
    engineCounts,
    memberships,
  ] = await Promise.all([
    getOnboardingState(userId),
    db
      .select({ band: jstAssessmentsTable.band })
      .from(jstAssessmentsTable)
      .where(eq(jstAssessmentsTable.userId, userId))
      .orderBy(sql`${jstAssessmentsTable.createdAt} DESC`),
    listContextCraftBadges(userId),
    countArtifacts(userId, "PROMPT_DIAGNOSTIC"),
    countArtifacts(userId, "ATOMIC_PROMPT"),
    countArtifacts(userId, "SPC"),
    countArtifacts(userId, "ATLAS_PDD"),
    countCertifiedMvp(userId),
    engineRunCounts(userId),
    loadMembershipsForUser(userId),
  ]);

  const jstCount = jstRows.length;
  const latestBand = (jstRows[0]?.band as JstBand | undefined) ?? null;
  const pillarsEarned = pillars.filter((p) => p.earned).length;
  const vdjRuns = engineCounts.get(6) ?? 0;
  const f8Runs = engineCounts.get(9) ?? 0;
  const pfpRuns = engineCounts.get(11) ?? 0;
  const deRuns = engineCounts.get(8) ?? 0;
  const orgCount = memberships.length;

  const defs: Array<Omit<AscensionRung, "index" | "complete" | "current">> = [
    {
      key: "know-your-number",
      title: "Know Your Number",
      role: "Seeker",
      engine: "JST self-assessment",
      chapter: "Prologue · The JST Equation",
      blurb:
        "Score your Jobs, Skills and Talent honestly. Your number is the baseline the whole ascent is measured against.",
      progress: Math.min(jstCount, 1),
      target: 1,
      actionLabel: "Take the JST",
      actionHref: "/ascension#jst",
    },
    {
      key: "monster-hunter",
      title: "Monster Hunter",
      role: "Diagnostician",
      engine: "F1 · Prompt Diagnostic",
      chapter: "Ch.1 · Naming the Monster",
      blurb: "Run F1 on a raw prompt to expose the monsters hiding in vague intent.",
      progress: Math.min(diagnostics, 1),
      target: 1,
      actionLabel: "Run F1",
      actionHref: "/session/new",
    },
    {
      key: "atom-smith",
      title: "Atom Smith",
      role: "Prompt Smith",
      engine: "F2 · Atomic Prompt",
      chapter: "Ch.2 · The Atomic Prompt",
      blurb: "Forge a single, indivisible Atomic Prompt — the unit the book is named for.",
      progress: Math.min(atomicPrompts, 1),
      target: 1,
      actionLabel: "Run F2",
      actionHref: "/sessions",
    },
    {
      key: "floor-manager",
      title: "Floor Manager",
      role: "Systems Builder",
      engine: "F3–F5 · CELL → Micro PDD → SPC",
      chapter: "Ch.3 · Running the Floor",
      blurb: "Grow a Micro Agent and crystallise your first full SPC.",
      progress: Math.min(spcs, 1),
      target: 1,
      actionLabel: "Continue a session",
      actionHref: "/sessions",
    },
    {
      key: "pillar-architect",
      title: "Pillar Architect",
      role: "Context Craftsman",
      engine: "Context Craft · 7 Pillars",
      chapter: "Ch.4 · The Seven Pillars (Context Craft)",
      blurb: "Earn all seven Context Craft pillar badges by scoring high on each dimension.",
      progress: pillarsEarned,
      target: 7,
      actionLabel: "View pillars",
      actionHref: "/quests",
    },
    {
      key: "atlas-bearer",
      title: "Atlas Bearer",
      role: "PDD Author",
      engine: "F6 · ATLAS PDD",
      chapter: "Ch.5 · Carrying the Atlas",
      blurb: "Draft a 4-Part ATLAS PDD — the architectural spine of your product.",
      progress: Math.min(atlasPdds, 1),
      target: 1,
      actionLabel: "Run F6",
      actionHref: "/sessions",
    },
    {
      key: "tool-dj",
      title: "Tool DJ",
      role: "Vibe Curator",
      engine: "F6-VDJ · VIBE recommendation",
      chapter: "Ch.6 · Mixing the Toolchain",
      blurb: "Run the VIBE ORACLE on your ATLAS PDD to get a curated IDE + tool recommendation.",
      progress: Math.min(vdjRuns >= 2 ? 1 : 0, 1),
      target: 1,
      actionLabel: "Run VIBE ORACLE",
      actionHref: "/sessions",
    },
    {
      key: "spartan",
      title: "Spartan",
      role: "Certified Operator",
      engine: "F7 · SPARTAN MVP-PDD + verify URL",
      chapter: "Ch.7 · The Spartan Cut",
      blurb: "Compress to a SPARTAN-certified MVP-PDD with a public verification URL.",
      progress: Math.min(certifiedMvp, 1),
      target: 1,
      actionLabel: "Run F7",
      actionHref: "/sessions",
    },
    {
      key: "code-dj",
      title: "Code ORACLE",
      role: "Builder",
      engine: "F8 · Code ORACLE scaffold",
      chapter: "Ch.8 · Dropping the Code",
      blurb: "Scaffold a runnable codebase from your certified spec (Architect tier+).",
      progress: Math.min(f8Runs, 1),
      target: 1,
      actionLabel: "Run F8",
      actionHref: "/sessions",
    },
    {
      key: "drift-guardian",
      title: "Drift Guardian",
      role: "Quality Sentinel",
      engine: "PFP · Drift detector",
      chapter: "Ch.9 · Guarding Against Drift",
      blurb: "Run the PFP drift detector to keep your build faithful to its spec.",
      progress: Math.min(pfpRuns, 1),
      target: 1,
      actionLabel: "Run PFP",
      actionHref: "/sessions",
    },
    {
      key: "bonsai-cultivator",
      title: "BONSAI Cultivator",
      role: "Evolver",
      engine: "DE-SPC · Auto-evolution",
      chapter: "Ch.10 · Cultivating the Bonsai",
      blurb: "Trigger DE-SPC auto-evolution to grow your spec with disciplined pruning.",
      progress: Math.min(deRuns, 1),
      target: 1,
      actionLabel: "Run DE-SPC",
      actionHref: "/sessions",
    },
    {
      key: "jst-ascendant",
      title: "JST Ascendant",
      role: "Ascendant",
      engine: "JST re-assessment",
      chapter: "Ch.11 · The Second Number",
      blurb: "Re-take the JST after building. Growth between your two numbers is the proof of ascent.",
      progress: Math.min(jstCount >= 2 ? 1 : 0, 1),
      target: 1,
      actionLabel: "Re-take the JST",
      actionHref: "/ascension#jst",
    },
    {
      key: "hive-builder",
      title: "Hive Builder",
      role: "Architect of Teams",
      engine: "Orgs · Team seats",
      chapter: "Ch.12 · Building the Hive",
      blurb: "Bring others in — create or join a team to multiply the protocol across an org.",
      progress: Math.min(orgCount, 1),
      target: 1,
      actionLabel: "Open Teams",
      actionHref: "/orgs",
    },
  ];

  let currentAssigned = false;
  const rungs: AscensionRung[] = defs.map((d, index) => {
    const complete = d.progress >= d.target;
    const current = !complete && !currentAssigned;
    if (current) currentAssigned = true;
    return { ...d, index, complete, current };
  });

  return {
    track: onboarding.track,
    readerCode: onboarding.readerCode,
    completedCount: rungs.filter((r) => r.complete).length,
    totalCount: rungs.length,
    band: latestBand,
    rungs,
  };
}
