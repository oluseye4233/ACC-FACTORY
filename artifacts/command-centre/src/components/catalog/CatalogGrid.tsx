import type { ReactNode } from "react";
import { AlertTriangle, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogCardSkeleton } from "./CatalogCard";

export function CatalogGrid({
  isLoading,
  isError,
  onRetry,
  errorText,
  emptyTitle,
  emptyBody,
  children,
  count,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  errorText?: string;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
  count: number;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="catalog-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <CatalogCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" data-testid="catalog-error" className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div>
          <p className="font-display text-xl tracking-wide">Catalog unavailable</p>
          <p className="font-mono text-xs text-muted-foreground">{errorText ?? "The catalog could not be loaded."}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry-catalog">
          Retry
        </Button>
      </div>
    );
  }
  if (count === 0) {
    return (
      <div data-testid="catalog-empty" className="flex flex-col items-center gap-2 rounded-md border border-dashed p-10 text-center">
        <PackageOpen className="h-8 w-8 text-muted-foreground" />
        <p className="font-display text-2xl tracking-wide">{emptyTitle}</p>
        <p className="max-w-md font-mono text-xs text-muted-foreground">{emptyBody}</p>
      </div>
    );
  }
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
