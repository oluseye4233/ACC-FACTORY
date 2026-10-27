import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, gt, asc } from "drizzle-orm";
import { db, learningCohortsTable as cohorts, learningMembershipsTable as members } from "@workspace/db";

export const learningCallContext = new AsyncLocalStorage<{ userId: string; membershipId: string; cohortId: string }>();
export async function activeLearningMembership(userId: string, membershipId?: string) {
  const [row] = await db.select({ member: members, cohort: cohorts }).from(members)
    .innerJoin(cohorts, eq(cohorts.id, members.cohortId))
    .where(and(eq(members.userId, userId), eq(members.role, "STUDENT"), eq(members.state, "ACTIVE"),
      eq(cohorts.state, "ACTIVE"), gt(cohorts.endsAt, new Date()), membershipId ? eq(members.id, membershipId) : undefined))
    .orderBy(asc(members.createdAt)).limit(1);
  return row;
}
/** All non-staff routes are denied unless explicitly part of student learning. */
export function learningRouteAllowed(method: string, path: string, active: boolean, lifetimePractitioner = false) {
  if (method === "POST" && path === "/harness/f5-scan" && (active || lifetimePractitioner)) return true;
  // Non-secret planning metadata only. This does not authorize any F10 write,
  // provider connection, release or delivery for a training account.
  if (method === "GET" && path === "/f10/catalog" && (active || lifetimePractitioner)) return true;
  if (/^\/learn(?:\/|$)/.test(path) || path === "/me" || path === "/me/profile") return true;
  if (method === "GET" && /^\/(?:sessions|artifacts|me\/(?:badges|context-craft-badges|ascension|jst|activity|cost-summary)|boomerang|spc-player)(?:\/|$)/.test(path)) return true;
  // Normal credential claims must not gain a new "active course" prerequisite.
  if (method === "POST" && /^\/me\/badges\/(?:aise\/claim|engineer)$/.test(path)) return true;
  // A verified FORGE lifetime grant retains normal owned Practitioner workflows
  // after training closes. Existing tier, ownership, spend and release gates still run.
  // No admin, org management, billing, external delivery or protected F9–F12 bypass.
  if (lifetimePractitioner) {
    if (method === "GET" && path === "/me/usage") return true;
    if (/^\/(?:sessions|artifacts|ingest|cartridge|boomerang|exemplars)(?:\/|$)/.test(path)) return true;
    if (/^\/spc-player(?:\/|$)/.test(path) && !/webhook|deliver/.test(path)) return true;
    if (/^\/harness\/(?:f[1-8](?:-finalize|-vdj|-codedj|-hdj)?|f05|map|atlas-crystallise|pfp|evolve|mathmon|pdd-view)(?:\/|$)/.test(path)) return true;
    if (/^\/harness\/sessions\/[a-f0-9-]+\/pdd-view$/.test(path) ||
      (method === "GET" && path === "/harness/escalations/stream")) return true;
    if (/^\/me\/(?:badges|jst|ascension)(?:\/|$)/.test(path)) return true;
    if (/^\/f0\/(?:engagements|reports)(?:\/|$)/.test(path) ||
      (method === "GET" && path === "/f0/dashboard")) return true;
  }
  if (!active) return false;
  if (method === "GET" && /^\/f0\/(?:dashboard|engagements|reports)(?:\/|$)/.test(path)) return true;
  if (/^\/harness\/sessions\/[a-f0-9-]+\/pdd-view$/.test(path) ||
    (method === "GET" && path === "/harness/escalations/stream")) return true;
  if (/^\/sessions(?:\/|$)/.test(path)) return true;
  if (/^\/(?:ingest|cartridge)(?:\/|$)/.test(path)) return true;
  if (/^\/harness\/(?:f[1-8](?:-finalize|-vdj|-codedj|-hdj)?|f05|map|atlas-crystallise|pfp|evolve|mathmon|pdd-view)(?:\/|$)/.test(path)) return true;
  if (/^\/me\/(?:badges\/(?:aise\/claim|engineer)|jst|ascension)(?:\/|$)/.test(path)) return true;
  if (/^\/boomerang(?:\/|$)/.test(path)) return true;
  if (/^\/spc-player(?:\/|$)/.test(path) && !/webhook|deliver/.test(path)) return true;
  if (/^\/f0\/(?:engagements|reports)(?:\/|$)/.test(path)) return true;
  return false;
}
