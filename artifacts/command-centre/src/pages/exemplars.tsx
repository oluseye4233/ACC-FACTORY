import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  getGetSphinxMarketplaceStatusQueryKey,
  getListExemplarsQueryKey,
  useGetSphinxMarketplaceStatus,
  useListExemplars,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { CatalogCard } from "@/components/catalog/CatalogCard";
import { CatalogFilters, CatalogSearchBar } from "@/components/catalog/CatalogFilters";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";
import { ArtifactModeSwitch } from "@/components/exemplars/ArtifactModeSwitch";
import { MarketplaceLaunchControl } from "@/components/exemplars/MarketplaceLaunchControl";
import { UploadBar } from "@/components/exemplars/UploadBar";
import { ExemplarDetail } from "@/components/exemplars/ExemplarDetail";
import { CATALOG_STALE_MS } from "@/components/exemplars/invalidate";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { DEFAULT_FILTERS, applyCatalogFilters, errorMessage, isSphinx, kindCounts, type CatalogFilterState } from "@/lib/catalog";

export default function Exemplars() {
  const [matchedDetail, params] = useRoute<{ id: string }>("/exemplars/:id");
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <TopNav />
      <main className="container mx-auto flex-1 max-w-7xl px-4 py-8 md:px-6">
        {matchedDetail && params?.id ? <ExemplarDetail id={params.id} /> : <ExemplarCatalog />}
      </main>
    </div>
  );
}

export function ExemplarCatalog() {
  useDocumentMeta(
    "Exemplar Library · ATANDA",
    "Internal ATANDA Exemplar Library: discover, download, fork and qualify SPCs, MAs, MPDDs and PDDs for Sphinx discovery.",
  );
  const list = useListExemplars({
    query: { queryKey: getListExemplarsQueryKey(), staleTime: CATALOG_STALE_MS, refetchInterval: CATALOG_STALE_MS },
  });
  const status = useGetSphinxMarketplaceStatus({
    query: { queryKey: getGetSphinxMarketplaceStatusQueryKey(), staleTime: CATALOG_STALE_MS, refetchInterval: CATALOG_STALE_MS },
  });
  const [filters, setFilters] = useState<CatalogFilterState>(DEFAULT_FILTERS);
  const items = useMemo(() => list.data ?? [], [list.data]);
  const visible = useMemo(() => applyCatalogFilters(items, filters), [items, filters]);
  const counts = useMemo(() => kindCounts(items.filter((i) => i.active !== false)), [items]);
  const mine = items.filter((i) => i.isOwner).length;
  const sphinxCount = items.filter((i) => isSphinx(i) && i.active !== false).length;
  const publicOpen = status.data?.publicOpen;

  return (
    <div className="space-y-6">
      <header className="grid gap-4 border-b pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Supply catalog · Sphinx</p>
          <h1 className="font-display text-5xl leading-none tracking-wider">Exemplar Library</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Internal artifacts are available to authenticated staff to read, download and fork. Qualified owner artifacts can be selected for public Sphinx discovery. The public catalog exposes metadata only; commerce and checkout are not activated.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span data-testid="text-total-count">{items.length} artifacts</span>
            <span>{mine} yours</span>
            <span>{sphinxCount} Sphinx selected</span>
            <span data-testid="text-public-state">
              Public catalog: {status.data ? (publicOpen ? "open" : "closed") : "unknown"}
            </span>
            <Link href="/sphinx" className="text-primary hover:underline" data-testid="link-public-sphinx">
              View public /sphinx
            </Link>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground/70" data-testid="text-exemplar-filename-convention">
            DOWNLOAD FORMAT: TYPE.NAME.ID.MM.DD.YY.H-MM-SSAM.ext (LOCAL TIME)
          </p>
        </div>
        <UploadBar />
      </header>

      {status.data && <MarketplaceLaunchControl status={status.data} sphinxCount={sphinxCount} />}

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <CatalogFilters value={filters} onChange={setFilters} counts={counts} internal className="md:sticky md:top-4 md:self-start" />
        <div className="min-w-0 space-y-4">
          <CatalogSearchBar value={filters} onChange={setFilters} />
          {!list.isLoading && !list.isError && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="text-result-count">
              {visible.length} of {items.length} shown
            </p>
          )}
          <CatalogGrid
            isLoading={list.isLoading}
            isError={list.isError}
            errorText={errorMessage(list.error, "The library could not be loaded.")}
            onRetry={() => void list.refetch()}
            count={visible.length}
            emptyTitle={items.length ? "No matches" : "Library is empty"}
            emptyBody={
              items.length
                ? "Nothing matches these filters. Loosen the kind, mode or qualification facets."
                : "Upload an SPC, MA, MPDD or PDD file or folder to seed the library."
            }
          >
            {visible.map((item) => (
              <CatalogCard
                key={item.id}
                item={item}
                publicOpen={publicOpen}
                href={`/exemplars/${item.id}`}
                showOwnership
                footer={<ArtifactModeSwitch item={item} publicOpen={publicOpen} compact />}
              />
            ))}
          </CatalogGrid>
        </div>
      </div>
    </div>
  );
}
