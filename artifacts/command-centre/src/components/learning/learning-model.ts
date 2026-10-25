import type { QueryClient } from "@tanstack/react-query";
import type {
  LearningAssignment,
  LearningHome,
  LearningLesson,
  LearningMembership,
  LearningSubmission,
  SaveLearningAttemptBody,
  SaveLearningAttemptBodyMode,
} from "@workspace/api-client-react";

export const INVITE_STORAGE_KEY = "ffe-invite";
export const MIN_SUBMIT_CHARS = 20;
export const MAX_SUBMIT_CHARS = 12000;
export const MAX_ARTIFACTS = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalise backend lesson.mode (actual / simulation / reflection, any case) to the closed submit mode. */
export function lessonMode(mode: string): SaveLearningAttemptBodyMode {
  const m = mode.trim().toUpperCase();
  if (m.startsWith("ACTUAL")) return "ACTUAL_PLATFORM";
  if (m.startsWith("SIM")) return "SIMULATION";
  return "REFLECTION";
}

export const MODE_COPY: Record<SaveLearningAttemptBodyMode, { label: string; short: string; explain: string }> = {
  ACTUAL_PLATFORM: {
    label: "Actual platform work",
    short: "ACTUAL",
    explain: "Do this in a real session you own. Attach the artifact IDs it produced; the server checks ownership and artifact type.",
  },
  SIMULATION: {
    label: "Simulation",
    short: "SIM",
    explain: "A rehearsal. Nothing runs on the platform and nothing you write here counts as platform output.",
  },
  REFLECTION: {
    label: "Reflection",
    short: "REFLECT",
    explain: "Written reasoning about the stage. No artifacts are attached.",
  },
};

export function parseArtifactIds(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)));
}

export function submitError(lesson: LearningLesson, text: string, artifactIds: string[]): string | null {
  const t = text.trim();
  if (t.length < MIN_SUBMIT_CHARS) return `Write at least ${MIN_SUBMIT_CHARS} characters (${t.length} so far).`;
  if (t.length > MAX_SUBMIT_CHARS) return `Keep it under ${MAX_SUBMIT_CHARS.toLocaleString()} characters.`;
  const mode = lessonMode(lesson.mode);
  if (mode === "ACTUAL_PLATFORM") {
    if (artifactIds.length === 0) return "Actual-platform lessons need at least one artifact ID you own.";
    if (artifactIds.length > MAX_ARTIFACTS) return `At most ${MAX_ARTIFACTS} artifacts.`;
    const bad = artifactIds.find((id) => !UUID.test(id));
    if (bad) return `"${bad.slice(0, 40)}" is not an artifact UUID.`;
  } else if (artifactIds.length > 0) {
    return `${MODE_COPY[mode].label} lessons do not take artifacts.`;
  }
  return null;
}

export function findAssignment(assignments: LearningAssignment[], membershipId: string, lessonKey: string) {
  return assignments.find((a) => a.membershipId === membershipId && a.lessonKey === lessonKey);
}

export function startPayload(membershipId: string, lessonKey: string, a?: LearningAssignment): SaveLearningAttemptBody {
  return { membershipId, lessonKey, action: "START", expectedVersion: a?.version ?? 0 };
}

export function submitPayload(
  membershipId: string,
  lesson: LearningLesson,
  a: LearningAssignment,
  text: string,
  artifactIds: string[],
): SaveLearningAttemptBody {
  const mode = lessonMode(lesson.mode);
  return {
    membershipId,
    lessonKey: lesson.key,
    action: "SUBMIT",
    expectedVersion: a.version,
    mode,
    text: text.trim(),
    ...(mode === "ACTUAL_PLATFORM" ? { artifactIds } : {}),
  };
}

export function latestSubmission(a: LearningAssignment): LearningSubmission | undefined {
  return a.submissions.reduce<LearningSubmission | undefined>(
    (latest, submission) => !latest || submission.version > latest.version ? submission : latest,
    undefined,
  );
}
export function isLessonDone(a?: LearningAssignment) {
  if (!a) return false;
  const last = latestSubmission(a);
  return Boolean(last && !last.sourceChanged && ["LEARNING_COMPLETE", "COMPLETE"].includes(a.state));
}

export function requiredDone(lessons: LearningLesson[], assignments: LearningAssignment[], m: LearningMembership) {
  const req = lessons.filter((l) => l.required && trackMatches(l.track, m.track));
  const done = req.filter((l) => isLessonDone(findAssignment(assignments, m.id, l.key))).length;
  return { done, total: req.length, all: req.length > 0 && done === req.length };
}

export function trackMatches(lessonTrack: string, memberTrack: string) {
  const l = lessonTrack.toUpperCase();
  const m = memberTrack.toUpperCase();
  return m === "BOTH" || l === "BOTH" || l === "CORE" || l === m;
}

export function inviteLink(token: string) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${window.location.origin}${base}learn?invite=${encodeURIComponent(token)}`;
}

export function readInviteToken(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get("invite");
    if (q) return q;
    return window.sessionStorage.getItem(INVITE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearInviteToken() {
  try {
    window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has("invite")) {
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    }
  } catch {
    /* ignore */
  }
}

export function apiErr(e: unknown): { conflict: boolean; message: string } {
  const err = e as { status?: number; data?: { error?: string; message?: string }; message?: string };
  const conflict = err?.status === 409;
  const message = err?.data?.error || err?.data?.message || err?.message || "Request failed";
  return { conflict, message: conflict ? `${message}. Someone changed this first; the latest version has been reloaded.` : message };
}

export function invalidateLearning(qc: QueryClient) {
  return qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/learn"),
  });
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
export const usd = (n: number) => `$${n.toFixed(2)}`;

/** Quest rules are unchanged and live elsewhere. Lessons never issue credentials. */
export const QUEST_RULES = [
  { badge: "ASPE", rule: "3 SPC + 4 MA from your own sessions", href: "/quests" },
  { badge: "AISA", rule: "1 Atlas PDD + 1 Micro PDD + 1 MVP PDD", href: "/quests" },
  { badge: "AISE", rule: "Existing URL claim process", href: "/ascension" },
] as const;
