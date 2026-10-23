import { useMemo, useState } from "react";
import {
  getListCartridgeExemplarsQueryKey,
  useListCartridgeExemplars,
  type CartridgeLibraryOption,
} from "@workspace/api-client-react";
import { Archive, Check, Library, RotateCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const MAX_LIBRARY_SOURCES = 10;

type StatusFilter = "all" | "active" | "archived";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function libraryOriginLabel(source: CartridgeLibraryOption["source"]) {
  return source === "curated" ? "Curated reference" : "Exemplar Library";
}

export function LibrarySourcePicker({ selectedIds, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data, isLoading, isError, refetch, isFetching } = useListCartridgeExemplars({
    query: {
      queryKey: getListCartridgeExemplarsQueryKey(),
      staleTime: 30000,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    },
  });
  const options = useMemo(() => data ?? [], [data]);
  const kinds = useMemo(() => Array.from(new Set(options.map((o) => o.kind))).sort(), [options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        (kind === "all" || o.kind === kind) &&
        (status === "all" || (status === "active" ? o.active : !o.active)) &&
        (!q || o.title.toLowerCase().includes(q) || o.kind.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)),
    );
  }, [options, query, kind, status]);
  const atLimit = selectedIds.length >= MAX_LIBRARY_SOURCES;
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else if (!atLimit) onChange(Array.from(new Set([...selectedIds, id])));
  };

  return (
    <div data-testid="library-source-picker">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
          <Library className="h-3.5 w-3.5" /> EXEMPLAR LIBRARY SOURCES
        </label>
        <span className="text-[10px] font-mono text-muted-foreground" data-testid="text-library-selected-count" aria-live="polite">
          {selectedIds.length} / {MAX_LIBRARY_SOURCES} selected
        </span>
      </div>
      <p className="mt-1 text-xs font-serif text-muted-foreground">
        Optional. Pick curated references, active shared artifacts, or your own archived SPCs. A snapshot of each is
        retained with the cartridge. Archived items are not restored or republished; they are supporting input only,
        never executable authority.
      </p>
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, kind or ID"
            aria-label="Search library sources"
            className="pl-7 font-mono text-xs"
            data-testid="input-library-search"
          />
        </div>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Filter by kind"
          className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
          data-testid="select-library-kind"
        >
          <option value="all">All kinds</option>
          {kinds.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
          data-testid="select-library-status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected library sources">
          {selectedIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                disabled={disabled}
                className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/20 disabled:opacity-60"
                aria-label={`Remove ${byId.get(id)?.title ?? id}`}
                data-testid={`chip-library-selected-${id}`}
              >
                {(byId.get(id)?.title ?? id.slice(0, 8)).slice(0, 40)} ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {atLimit && (
        <p className="mt-1 text-[10px] font-mono text-secondary" data-testid="text-library-limit">
          Limit reached. Deselect a source to choose another.
        </p>
      )}

      <div className="mt-2 max-h-72 overflow-y-auto rounded-md border bg-muted/10">
        {isLoading ? (
          <div className="p-3 space-y-2" data-testid="status-library-loading" aria-busy="true">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : isError ? (
          <div className="p-4 flex items-center justify-between gap-2 text-xs font-mono text-destructive" role="alert" data-testid="status-library-error">
            Could not load library sources.
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-library-retry">
              <RotateCw className="h-3 w-3 mr-1" /> RETRY
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-xs font-serif italic text-muted-foreground" data-testid="status-library-empty">
            {options.length === 0 ? "No library sources are available to you yet." : "No sources match these filters."}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((o) => {
              const selected = selectedIds.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggle(o.id)}
                    disabled={disabled || (!selected && atLimit)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed ${selected ? "bg-primary/5" : ""}`}
                    data-testid={`option-library-${o.id}`}
                  >
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-serif text-foreground truncate">{o.title}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        <span>{o.kind}</span>
                        <span className={o.active ? "text-primary" : "text-secondary inline-flex items-center gap-1"}>
                          {!o.active && <Archive className="h-2.5 w-2.5" />}
                          {o.active ? "Active" : "Archived"}
                        </span>
                        <span>{libraryOriginLabel(o.source)}</span>
                        <span>ID {o.id.slice(0, 8)}</span>
                        <span>{o.characters.toLocaleString()} chars</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
