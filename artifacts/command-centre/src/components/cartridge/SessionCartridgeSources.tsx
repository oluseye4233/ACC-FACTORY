import { getGetSessionCartridgeQueryKey, useGetSessionCartridge } from "@workspace/api-client-react";
import { Library, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RetainedLibrarySources } from "./RetainedLibrarySources";

export function SessionCartridgeSources({ sessionId, origin }: { sessionId: string; origin?: string | null }) {
  const enabled = Boolean(sessionId) && origin === "cartridge";
  const { data, isLoading, isError, refetch } = useGetSessionCartridge(sessionId, {
    query: { enabled, staleTime: 30000, queryKey: getGetSessionCartridgeQueryKey(sessionId) },
  });
  if (!enabled) return null;
  return (
    <details className="mx-4 mt-4 rounded-lg border border-secondary/30 bg-card p-3" data-testid="panel-session-cartridge-sources">
      <summary className="cursor-pointer font-mono text-xs font-bold text-secondary flex items-center gap-2">
        <Library className="h-3.5 w-3.5" /> CARTRIDGE · Retained library sources
        {data && <span className="text-muted-foreground font-normal">({data.librarySources?.length ?? 0})</span>}
      </summary>
      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : isError ? (
          <div role="alert" className="flex items-center justify-between gap-2 text-xs font-mono text-destructive">
            Could not load the cartridge for this session.
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-session-cartridge-retry">
              <RotateCw className="h-3 w-3 mr-1" /> RETRY
            </Button>
          </div>
        ) : (
          <RetainedLibrarySources sources={data?.librarySources ?? []} />
        )}
      </div>
    </details>
  );
}
