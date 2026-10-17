import type { ExemplarSummary } from "@workspace/api-client-react";

export type CatalogItem = ExemplarSummary;
export type CatalogKind = ExemplarSummary["kind"];

export const CATALOG_KINDS: CatalogKind[] = ["SPC", "MA", "MPDD", "PDD", "F0_REPORT"];

export const KIND_LABEL: Record<CatalogKind, string> = {
  SPC: "SPC",
  MA: "MA",
  MPDD: "MPDD",
  PDD: "PDD",
  F0_REPORT: "F0 Report",
};

export type ModeFilter = "all" | "library" | "sphinx";
export type EligibilityFilter = "all" | "eligible" | "approved" | "not_eligible";
export type SortKey = "relevance" | "jcse_desc" | "newest" | "title";

export interface CatalogFilterState {
  q: string;
  kinds: CatalogKind[];
  mode: ModeFilter;
  eligibility: EligibilityFilter;
  mineOnly: boolean;
  includeArchived: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: CatalogFilterState = {
  q: "",
  kinds: [],
  mode: "all",
  eligibility: "all",
  mineOnly: false,
  includeArchived: false,
  sort: "relevance",
};

export const isSphinx = (i: CatalogItem) => i.artifactMode === "SPHINX_ARTIFACT";
export const isArchived = (i: CatalogItem) => i.active === false;
export const isApproved = (i: CatalogItem) => i.qualification?.decision === "APPROVED";
export const isCurated = (i: CatalogItem) => i.marketplace === "curated";

function score(item: CatalogItem, q: string): number {
  if (!q) return 0;
  const t = item.title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 60;
  if (t.includes(q)) return 40;
  if (item.tagline.toLowerCase().includes(q)) return 20;
  return 10;
}

export function matchesQuery(item: CatalogItem, q: string): boolean {
  if (!q) return true;
  const hay = [item.title, item.tagline, item.sku, item.kind, item.certClass ?? "", item.disc ?? ""]
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

export function applyCatalogFilters(items: CatalogItem[], f: CatalogFilterState): CatalogItem[] {
  const q = f.q.trim().toLowerCase();
  const out = items.filter((i) => {
    if (!f.includeArchived && isArchived(i)) return false;
    if (f.mineOnly && !i.isOwner) return false;
    if (f.kinds.length && !f.kinds.includes(i.kind)) return false;
    if (f.mode === "sphinx" && !isSphinx(i)) return false;
    if (f.mode === "library" && isSphinx(i)) return false;
    if (f.eligibility === "eligible" && !i.eligibility?.eligible) return false;
    if (f.eligibility === "not_eligible" && i.eligibility?.eligible) return false;
    if (f.eligibility === "approved" && !isApproved(i)) return false;
    return matchesQuery(i, q);
  });
  const byTitle = (a: CatalogItem, b: CatalogItem) => a.title.localeCompare(b.title);
  const sorted = [...out];
  switch (f.sort) {
    case "jcse_desc":
      sorted.sort((a, b) => (b.jcse ?? -1) - (a.jcse ?? -1) || byTitle(a, b));
      break;
    case "newest":
      sorted.sort(
        (a, b) =>
          (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0) ||
          byTitle(a, b),
      );
      break;
    case "title":
      sorted.sort(byTitle);
      break;
    default:
      if (q) sorted.sort((a, b) => score(b, q) - score(a, q) || byTitle(a, b));
  }
  return sorted;
}

export function kindCounts(items: CatalogItem[]): Record<CatalogKind, number> {
  const c = { SPC: 0, MA: 0, MPDD: 0, PDD: 0, F0_REPORT: 0 } as Record<CatalogKind, number>;
  for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
  return c;
}

export type DiscoveryStatus =
  | { tone: "archived"; label: string }
  | { tone: "public"; label: string }
  | { tone: "queued"; label: string }
  | { tone: "library"; label: string };

/** Honest public-discovery status. Never claims "for sale". */
export function discoveryStatus(item: CatalogItem, publicOpen: boolean | undefined): DiscoveryStatus {
  if (isArchived(item)) return { tone: "archived", label: "Archived" };
  if (isSphinx(item)) {
    if (item.eligibility && !item.eligibility.eligible) {
      return { tone: "queued", label: "Needs requalification - not public" };
    }
    if (publicOpen === undefined) return { tone: "queued", label: "Sphinx selected - status unavailable" };
    return publicOpen
      ? { tone: "public", label: "Publicly discoverable" }
      : { tone: "queued", label: "Sphinx queued - not public" };
  }
  return { tone: "library", label: "Library only" };
}

export function sourceLabel(item: CatalogItem): string {
  if (item.marketplace === "open") return "Contributor";
  if (item.source === "canonical") return "Canonical";
  if (item.source === "hand_authored") return "Hand-authored";
  return "Generated";
}

export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e && typeof e === "object") {
    const anyE = e as { data?: { error?: string; message?: string }; message?: string };
    return anyE.data?.error || anyE.data?.message || anyE.message || fallback;
  }
  return fallback;
}

export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function toInt(v: string): number {
  if (!/^\d+$/.test(v.trim())) return NaN;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) ? n : NaN;
}
