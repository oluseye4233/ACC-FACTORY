import type { BoomerangCase, BoomerangOriginKind } from "@workspace/api-client-react";
import { ENGINES } from "@/lib/constants";

/** Session stage labels, in display order. F labels are NOT canonical engine IDs. */
export const SESSION_STAGES = ["F1", "F2", "F3", "F4", "F5", "F6", "F6-VDJ", "F7", "F8", "F9", "F9.5", "F10", "F11", "F12", "MM"] as const;
export const F0_STAGES = ["F0"] as const;

/** F-label -> canonical engine id (from ENGINES in lib/constants). null = no engine row. */
export const STAGE_ENGINE_ID: Record<string, number | null> = Object.fromEntries([
  ...ENGINES.map((e) => [e.name, e.id] as const),
  ["F0", null],
  ["F9.5", null],
  ["F12", null],
]);

export function stagesFor(kind: BoomerangOriginKind, serverStages?: string[]): string[] {
  const base: readonly string[] = kind === "F0" ? F0_STAGES : SESSION_STAGES;
  return serverStages && serverStages.length ? base.filter((s) => serverStages.includes(s)) : [...base];
}

export function stageNote(stage: string): string | null {
  if (stage === "F12") return "F12: support-only. Full F12 operation is not activated.";
  if (stage === "F0") return "F0 origins accept F0 support requests only.";
  return null;
}

export const OPEN_STATES = new Set(["REQUESTED", "REVISION_REQUESTED"]);
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RESULT_MIN = 10;
export const RESULT_MAX = 40000;

export type CaseControls = { canReturn: boolean; canReview: boolean; canCancel: boolean; driftBlocked: boolean };

export function controlsFor(c: BoomerangCase): CaseControls {
  const open = OPEN_STATES.has(c.state);
  return {
    canReturn: open && !c.sourceChanged,
    canReview: c.state === "RETURNED",
    canCancel: open,
    driftBlocked: c.sourceChanged && (open || c.state === "RETURNED"),
  };
}

/** Validate RETURN payload: exactly one of resultText / spcPlayerRunId. */
export function returnError(text: string, runId: string): string | null {
  const t = text.trim();
  const r = runId.trim();
  if (t && r) return "Provide either returned text or an SPC run id, not both.";
  if (!t && !r) return "Paste returned work or enter a completed SPC Player run id.";
  if (r && !UUID_RE.test(r)) return "SPC run id must be a UUID.";
  if (t && t.length < RESULT_MIN) return `Returned text needs at least ${RESULT_MIN} characters.`;
  if (t.length > RESULT_MAX) return `Returned text exceeds ${RESULT_MAX.toLocaleString()} characters.`;
  return null;
}

export const shortHash = (h: string | null | undefined) => (!h ? "—" : h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h);
export const fmtTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : "—");

export function workspaceHref(kind: string, id: string, stage?: string) {
  const p = new URLSearchParams({ originKind: kind, originId: id });
  if (stage) p.set("stage", stage);
  return `/boomerang?${p.toString()}`;
}

export function downloadCaseJson(c: BoomerangCase) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `boomerang-${c.stage}-${c.id.slice(0, 8)}-v${c.version}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function apiError(e: unknown): { message: string; conflict: boolean } {
  const o = (e ?? {}) as { status?: unknown; data?: unknown; message?: unknown };
  const status = typeof o.status === "number" ? o.status : null;
  const d = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  const base = (typeof d.error === "string" && d.error) || (typeof d.message === "string" && d.message) || (typeof o.message === "string" && o.message) || "Request failed";
  return { message: status ? `${base} (${status})` : base, conflict: status === 409 };
}

export const BOOMERANG_QUERY = { staleTime: 20_000, refetchOnWindowFocus: true } as const;
