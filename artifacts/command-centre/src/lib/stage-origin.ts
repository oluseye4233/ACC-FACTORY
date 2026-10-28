import { ENGINES } from "@/lib/constants";

export interface StageOrigin {
  sessionId: string;
  featureId: number;
  stageLabel: string;
}

const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Parse an explicit originSessionId/originFeatureId pair. Returns null unless both are valid. */
export function parseStageOrigin(search: string): StageOrigin | null {
  const params = new URLSearchParams(search);
  const sessionId = params.get("originSessionId") ?? "";
  const featureId = Number(params.get("originFeatureId"));
  if (!SESSION_ID.test(sessionId)) return null;
  const engine = ENGINES.find((e) => e.id === featureId);
  if (!Number.isInteger(featureId) || !engine) return null;
  return { sessionId, featureId, stageLabel: engine.name };
}

export function stageLabel(featureId: number): string {
  return ENGINES.find((e) => e.id === featureId)?.name ?? `stage ${featureId}`;
}

/** Link back to the exact stage page in the session cockpit. */
export function sessionStageHref(sessionId: string, featureId: number): string {
  return `/session/${encodeURIComponent(sessionId)}?featureId=${featureId}#stage-optional-tools`;
}

export function originQuery(origin: { sessionId: string; featureId: number }): string {
  return `originSessionId=${encodeURIComponent(origin.sessionId)}&originFeatureId=${origin.featureId}`;
}

export function f0OriginHref(sessionId: string, featureId: number): string {
  return `/f0?${originQuery({ sessionId, featureId })}`;
}

export function spcPlayerOriginHref(sessionId: string, featureId: number): string {
  return `/spc-player/new?sourceSessionId=${encodeURIComponent(sessionId)}&originFeatureId=${featureId}`;
}
