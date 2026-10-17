import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATALOG_KINDS,
  DEFAULT_FILTERS,
  KIND_LABEL,
  type CatalogFilterState,
  type CatalogKind,
  type EligibilityFilter,
  type ModeFilter,
  type SortKey,
} from "@/lib/catalog";

export interface CatalogFiltersProps {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  counts: Record<CatalogKind, number>;
  /** Internal-only facets (mode, eligibility, ownership, archived). */
  internal?: boolean;
  className?: string;
}

const SORTS: { v: SortKey; l: string }[] = [
  { v: "relevance", l: "Relevance" },
  { v: "jcse_desc", l: "JCSE: high to low" },
  { v: "newest", l: "Newest" },
  { v: "title", l: "Title A-Z" },
];

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
  testid,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  testid: string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <div className="flex flex-col gap-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            data-testid={`${testid}-${o.v}`}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-sm px-2 py-1 text-left font-mono text-xs transition-colors",
              value === o.v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CatalogSearchBar({
  value,
  onChange,
}: {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search catalog</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search title, tagline, SKU, class, DISC"
          data-testid="input-catalog-search"
          className="h-10 w-full rounded-md border bg-card pl-9 pr-9 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {value.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange({ ...value, q: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Sort
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey })}
          data-testid="select-catalog-sort"
          className="h-10 rounded-md border bg-card px-2 font-mono text-xs normal-case text-foreground"
        >
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CatalogFilters({ value, onChange, counts, internal, className }: CatalogFiltersProps) {
  const toggleKind = (k: CatalogKind) =>
    onChange({ ...value, kinds: value.kinds.includes(k) ? value.kinds.filter((x) => x !== k) : [...value.kinds, k] });
  const dirty =
    value.kinds.length > 0 ||
    value.mode !== "all" ||
    value.eligibility !== "all" ||
    value.mineOnly ||
    value.includeArchived;

  return (
    <aside className={cn("space-y-5", className)} aria-label="Catalog filters">
      <fieldset className="space-y-1.5">
        <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kind</legend>
        {CATALOG_KINDS.map((k) => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-0.5 hover:bg-muted">
            <span className="flex items-center gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={value.kinds.includes(k)}
                onChange={() => toggleKind(k)}
                data-testid={`checkbox-kind-${k}`}
                className="accent-[hsl(144_61%_26%)]"
              />
              {KIND_LABEL[k]}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{counts[k] ?? 0}</span>
          </label>
        ))}
      </fieldset>
      {internal && (
        <>
          <Seg
            label="Artifact mode"
            value={value.mode}
            testid="filter-mode"
            onChange={(mode: ModeFilter) => onChange({ ...value, mode })}
            options={[
              { v: "all", l: "All" },
              { v: "library", l: "Library only" },
              { v: "sphinx", l: "Sphinx selected" },
            ]}
          />
          <Seg
            label="Qualification"
            value={value.eligibility}
            testid="filter-eligibility"
            onChange={(eligibility: EligibilityFilter) => onChange({ ...value, eligibility })}
            options={[
              { v: "all", l: "All" },
              { v: "eligible", l: "Eligible for Sphinx" },
              { v: "approved", l: "Review approved" },
              { v: "not_eligible", l: "Not eligible" },
            ]}
          />
          <fieldset className="space-y-1.5">
            <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scope</legend>
            <label className="flex items-center gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={value.mineOnly}
                onChange={(e) => onChange({ ...value, mineOnly: e.target.checked })}
                data-testid="checkbox-mine-only"
                className="accent-[hsl(144_61%_26%)]"
              />
              My artifacts only
            </label>
            <label className="flex items-center gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={value.includeArchived}
                onChange={(e) => onChange({ ...value, includeArchived: e.target.checked })}
                data-testid="checkbox-include-archived"
                className="accent-[hsl(144_61%_26%)]"
              />
              Include archived
            </label>
          </fieldset>
        </>
      )}
      {dirty && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS, q: value.q, sort: value.sort })}
          data-testid="button-reset-filters"
          className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
        >
          Reset filters
        </button>
      )}
    </aside>
  );
}
