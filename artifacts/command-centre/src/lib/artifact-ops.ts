// Guarded view-model helpers for SHORT SPRINTS / IMPRIMA workflow JSON.
// Config/result payloads are unknown records; never assume shape.

export type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
export const rec = (v: unknown): Rec => (isRec(v) ? v : {});
export const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const strArr = (v: unknown): string[] =>
  arr(v).map((x) => (typeof x === "string" ? x : isRec(x) ? str(x.message) ?? str(x.id) ?? JSON.stringify(x) : String(x)));

export const ACTIVE_STATES = ["NORMALISING", "CLARIFYING", "INTERROGATING", "RENDERING", "VALIDATING", "QUEUED"] as const;
export const isActiveState = (s: string) => (ACTIVE_STATES as readonly string[]).includes(s.toUpperCase());

export type OpsKind = "imprima" | "short-sprints";
export const parseKind = (v: string | null): OpsKind => (v === "short-sprints" ? "short-sprints" : "imprima");

/** Host-absolute /api paths are used as-is (matches lib/api.ts); relative paths are rejected. */
export function safeDownloadUrl(path: string): string | null {
  if (!path.startsWith("/api/") || path.includes("..") || path.includes("//")) return null;
  return path;
}

export async function downloadFrom(path: string, fallbackName: string) {
  const url = safeDownloadUrl(path);
  if (!url) throw new Error("Download path rejected (not a server /api route)");
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw Object.assign(new Error(`Download failed (${res.status})`), { status: res.status });
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cd);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = m?.[1] ?? fallbackName;
  a.click();
  URL.revokeObjectURL(href);
}

export function errMessage(e: unknown): { message: string; conflict: boolean; status: number | null } {
  const status = num((e as { status?: unknown } | null)?.status);
  const data = rec((e as { data?: unknown } | null)?.data);
  const base = str(data.error) ?? str(data.message) ?? (e instanceof Error ? e.message : "Request failed");
  return { message: status ? `${base} (${status})` : base, conflict: status === 409, status };
}

/** Five-token filename preview: project_title_audience_mode_date */
export function filenamePreview(o: { project: string; title: string; audience: string; mode: string }, now = new Date()) {
  const slug = (s: string, d: string) =>
    (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || d);
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return [slug(o.project, "project"), slug(o.title, "document"), o.audience.toLowerCase(), o.mode.toLowerCase(), date].join("_");
}

export type ImprimaView = {
  contentHash: string | null;
  groState: string | null;
  clarity: { score: number | null; truthfulness: number | null; detectability: number | null; method: string | null } | null;
  review: { verdict: string | null; flags: string[]; rationale: string | null } | null;
  changes: string[];
  design: { score: number | null; dimensions: Rec; scope: string | null } | null;
  approval: { name: string | null; at: string | null; actorId: string | null } | null;
  error: string | null;
};

export function imprimaView(result: unknown): ImprimaView {
  const r = rec(result);
  const c = isRec(r.clarity) ? r.clarity : null;
  const rv = isRec(r.review) ? r.review : null;
  const d = isRec(r.design) ? r.design : null;
  const ap = isRec(r.approval) ? r.approval : null;
  return {
    contentHash: str(r.contentHash),
    groState: str(r.groState),
    clarity: c ? { score: num(c.clarity), truthfulness: num(c.truthfulness), detectability: num(c.detectability), method: str(c.method) } : null,
    review: rv ? { verdict: str(rv.verdict), flags: strArr(rv.flags), rationale: str(rv.rationale) } : null,
    changes: strArr(r.changes),
    design: d ? { score: num(d.score), dimensions: rec(d.dimensions), scope: str(d.scope) } : null,
    approval: ap ? { name: str(ap.name), at: str(ap.at), actorId: str(ap.actorId) } : null,
    error: str(r.error) ?? (isRec(r.error) ? str(r.error.message) : null),
  };
}

/** Override is only available on review HOLD / CONTAINMENT injection, never for secrets. */
export function overridePolicy(v: ImprimaView): { needed: boolean; allowed: boolean; reason: string } {
  const verdict = (v.review?.verdict ?? "").toUpperCase();
  const flags = (v.review?.flags ?? []).map((f) => f.toUpperCase());
  const secret = flags.some((f) => f.includes("SECRET"));
  const containment = flags.some((f) => f.includes("CONTAINMENT") || f.includes("INJECTION"));
  const needed = verdict === "HOLD" || containment;
  if (secret) return { needed: true, allowed: false, reason: "Secret material flagged. Secrets are never overridable; fix the source and retry." };
  return { needed, allowed: needed, reason: needed ? "Review HOLD or containment flag: approval requires an explicit override reason." : "" };
}

export const SS_SECTIONS = ["eligibility", "pack", "failureCase", "route", "gateDecision", "sass", "custody", "release", "promotion"] as const;

export function ssView(result: unknown) {
  const r = rec(result);
  return {
    sections: SS_SECTIONS.map((k) => ({ key: k, value: r[k] })),
    missing: strArr(r.missingRequirements),
    tracks: arr(rec(r.pack).tracks).filter(isRec),
  };
}

export const MANIFEST_SAMPLE = {
  name: "intake-triage-agent",
  mission: "Classify inbound requests and route them to the correct queue.",
  systemPrompt: "You are a triage assistant. Return only the JSON contract.",
  inputContract: { type: "object", required: ["text"] },
  outputContract: { type: "object", required: ["queue", "confidence"] },
  tools: ["lookup_customer"],
  constraints: ["No outbound email", "No PII in logs"],
  groRules: "Refuse when confidence below threshold.",
  failClosedRules: "On any tool error, return queue=HUMAN_REVIEW.",
  deployment: "container",
  model: "",
  provider: "claude",
  dataHandling: "INTERNAL; retain 30 days",
  monitoring: "error rate, refusal rate",
  version: "0.1.0",
  promotionNotes: "",
  evalsetHashes: [] as string[],
};

export const MANIFEST_FIELDS = Object.keys(MANIFEST_SAMPLE) as (keyof typeof MANIFEST_SAMPLE)[];

/** Preparation-only template: records absent infrastructure, never invents it. */
export const PREPARATION_MANIFEST_SAMPLE = {
  ...MANIFEST_SAMPLE,
  model: "NOT_CONFIGURED",
  provider: "NOT_CONFIGURED",
  tools: [],
  deployment: "Not deployed — private preparation only",
  monitoring: "Not connected",
  dataHandling: "Private preparation; no retention policy configured",
  promotionNotes: "Not promoted — preparation only",
};
