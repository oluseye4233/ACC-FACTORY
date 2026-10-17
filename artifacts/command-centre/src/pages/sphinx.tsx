import { useMemo, useState } from "react";
import { getGetSphinxCatalogQueryKey, useGetSphinxCatalog } from "@workspace/api-client-react";
import { Lock } from "lucide-react";
import { CatalogCard } from "@/components/catalog/CatalogCard";
import { CatalogFilters, CatalogSearchBar } from "@/components/catalog/CatalogFilters";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { DEFAULT_FILTERS, applyCatalogFilters, errorMessage, kindCounts, type CatalogFilterState } from "@/lib/catalog";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * Public, metadata-only Sphinx discovery catalog. No staff chrome, no links to
 * internal detail pages or full-body downloads.
 */
export default function Sphinx() {
  useDocumentMeta(
    "Sphinx Marketplace · Artifact discovery",
    "Public discovery catalog of qualified SPC, MA, MPDD and PDD artifacts from ATANDA. Metadata only; commerce is not yet activated.",
  );
  const catalog = useGetSphinxCatalog({
    query: { queryKey: getGetSphinxCatalogQueryKey(), staleTime: 30_000, refetchInterval: 30_000 },
  });
  const [filters, setFilters] = useState<CatalogFilterState>(DEFAULT_FILTERS);
  const items = useMemo(() => catalog.data?.items ?? [], [catalog.data]);
  const visible = useMemo(() => applyCatalogFilters(items, filters), [items, filters]);
  const counts = useMemo(() => kindCounts(items), [items]);
  const open = catalog.data?.publicOpen === true;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="relative overflow-hidden bg-[hsl(150_45%_10%)] text-[hsl(45_40%_92%)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 11px)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">ATANDA presents</p>
            <ThemeToggle />
          </div>
          <h1 className="font-display text-6xl leading-none tracking-wider md:text-7xl">Sphinx</h1>
          <p className="mt-2 max-w-xl text-sm opacity-80">
            Discovery catalog for qualified agent artifacts: SPCs, MAs, MPDDs and PDDs, each internally reviewed against a published baseline.
          </p>
          <p
            className="mt-4 inline-block rounded-sm border border-secondary/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary"
            data-testid="text-commerce-notice"
          >
            Public discovery metadata only · Commerce and checkout are not activated
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {catalog.isLoading ? (
          <CatalogGrid isLoading isError={false} onRetry={() => undefined} count={0} emptyTitle="" emptyBody="">
            {null}
          </CatalogGrid>
        ) : catalog.isError ? (
          <CatalogGrid
            isLoading={false}
            isError
            errorText={errorMessage(catalog.error, "The Sphinx catalog could not be loaded.")}
            onRetry={() => void catalog.refetch()}
            count={0}
            emptyTitle=""
            emptyBody=""
          >
            {null}
          </CatalogGrid>
        ) : !open ? (
          <section data-testid="sphinx-closed" className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <h2 className="font-display text-4xl tracking-wide">Not yet open</h2>
            <p className="text-sm text-muted-foreground">
              The Sphinx discovery catalog has not launched. Artifacts are being qualified and queued. Nothing is for sale, and no payments are accepted here.
            </p>
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-[200px_1fr]" data-testid="sphinx-open">
            <CatalogFilters value={filters} onChange={setFilters} counts={counts} className="md:sticky md:top-4 md:self-start" />
            <div className="min-w-0 space-y-4">
              <CatalogSearchBar value={filters} onChange={setFilters} />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {visible.length} of {items.length} artifacts
              </p>
              <CatalogGrid
                isLoading={false}
                isError={false}
                onRetry={() => undefined}
                count={visible.length}
                emptyTitle={items.length ? "No matches" : "No artifacts listed yet"}
                emptyBody={items.length ? "Try a different search or kind." : "Qualified artifacts will appear here as owners select them."}
              >
                {visible.map((item) => (
                  <CatalogCard key={item.id} item={item} publicOpen />
                ))}
              </CatalogGrid>
            </div>
          </div>
        )}
      </main>
      <footer className="border-t py-6 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Sphinx · metadata catalog · no prices, ratings or sales are shown because none exist yet
      </footer>
    </div>
  );
}
