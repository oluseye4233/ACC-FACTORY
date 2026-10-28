/** Navigation helpers for the IMPRIMA Portal and Agent Creator. Query context is preserved verbatim. */
/**
 * ARTIFACT and EXEMPLAR are in the generated contract. SPC_PLAYER, IMPRIMA_FILE, PREPARATION_FILE and
 * SPRINT_EXPORT are manual link-only types awaiting backend support; the portal shows them as
 * pending until the server lists them as sources.
 */
export type PortalSourceType = "ARTIFACT" | "EXEMPLAR" | "SPC_PLAYER" | "IMPRIMA_FILE" | "PREPARATION_FILE" | "SPRINT_EXPORT" | "F10_EXPORT";
export const CONTRACT_SOURCE_TYPES: readonly PortalSourceType[] = ["ARTIFACT", "EXEMPLAR", "SPC_PLAYER", "IMPRIMA_FILE", "PREPARATION_FILE", "SPRINT_EXPORT", "F10_EXPORT"];
/** Native-file sources keep their original bytes unchanged beside the stamped cover, so they publish as EDITABLE_ZIP only. */
export const NATIVE_ZIP_SOURCE_TYPES: readonly string[] = ["IMPRIMA_FILE", "PREPARATION_FILE", "F10_EXPORT"];
export function isPortalSourceType(v: string | null | undefined): v is PortalSourceType {
  return !!v && (CONTRACT_SOURCE_TYPES as readonly string[]).includes(v);
}
/** Parse the small exportOptions query param; only a plain JSON object is accepted. */
export function parseExportOptions(raw: string | null): Record<string, unknown> | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype ? (v as Record<string, unknown>) : null;
  } catch { return null; }
}

export interface PortalContext {
  sourceId?: string | null;
  sourceType?: PortalSourceType | null;
  parentId?: string | null;
  kind?: string | null;
  sessionId?: string | null;
  featureId?: number | string | null;
  tab?: "publish" | "intake" | null;
  intake?: "ingest" | "cartridge" | "library" | null;
  exportOptions?: object | null;
}

function q(p: Record<string, string | number | null | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

export function portalHref(p: PortalContext = {}): string {
  return `/imprima-portal${q({ sourceId: p.sourceId, sourceType: p.sourceId ? p.sourceType ?? "ARTIFACT" : null, parentId: p.parentId, kind: p.kind, sessionId: p.sessionId, featureId: p.featureId, tab: p.tab, intake: p.intake, exportOptions: p.exportOptions ? JSON.stringify(p.exportOptions) : null })}`;
}

export function agentCreatorHref(p: { sessionId?: string | null; featureId?: number | string | null; sourceId?: string | null; agentId?: string | null } = {}): string {
  return `/agent-creator${q({ sessionId: p.sessionId, featureId: p.featureId, sourceId: p.sourceId, agentId: p.agentId })}`;
}

/** Legacy /ingest and /cartridge URLs redirect here; every incoming query param (case, return, departure, player run) is kept. */
export function intakeRedirectHref(target: "ingest" | "cartridge", search: string): string {
  const s = new URLSearchParams(search);
  s.set("tab", "intake"); s.set("intake", target);
  return `/imprima-portal?${s.toString()}`;
}

export function newRequestKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function apiErr(e: unknown): string {
  const d = (e as { data?: { error?: string; message?: string } } | null)?.data;
  return d?.error ?? d?.message ?? (e instanceof Error ? e.message : "Request failed");
}
