import { useListBoomerangCases, getListBoomerangCasesQueryKey, type ListBoomerangCasesParams } from "@workspace/api-client-react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BoomerangCaseCard } from "./BoomerangCaseCard";
import { BOOMERANG_QUERY, apiError } from "./boomerang-model";

export const BOOMERANG_PAGE = 50;

export function BoomerangCaseList({ params, offset, onOffset, emptyText }: { params: ListBoomerangCasesParams; offset: number; onOffset: (n: number) => void; emptyText: string }) {
  const p = { ...params, offset };
  const q = useListBoomerangCases(p, { query: { queryKey: getListBoomerangCasesQueryKey(p), ...BOOMERANG_QUERY } });
  if (q.isLoading) return <div className="space-y-2" data-testid="loading-boomerang">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (q.isError) return (
    <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/5 rounded p-3 font-mono text-xs text-destructive" data-testid="error-boomerang">
      <AlertTriangle className="h-4 w-4" /> {apiError(q.error).message}
      <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => void q.refetch()} data-testid="button-retry-boomerang"><RefreshCw className="h-3 w-3 mr-1" />Retry</Button>
    </div>
  );
  const rows = q.data ?? [];
  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <div className="border border-dashed rounded p-6 text-center font-mono text-xs text-muted-foreground" data-testid="empty-boomerang">{emptyText}</div>
      ) : rows.map((c) => <BoomerangCaseCard key={c.id} c={c} />)}
      {(offset > 0 || rows.length >= BOOMERANG_PAGE) && (
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <Button size="sm" variant="outline" className="h-7" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - BOOMERANG_PAGE))} data-testid="button-boomerang-prev">Newer</Button>
          <span className="text-muted-foreground">{offset + 1}–{offset + rows.length}</span>
          <Button size="sm" variant="outline" className="h-7" disabled={rows.length < BOOMERANG_PAGE} onClick={() => onOffset(offset + BOOMERANG_PAGE)} data-testid="button-boomerang-next">Older</Button>
        </div>
      )}
    </div>
  );
}
