import { cn } from "@/lib/utils";
import type { DiscoveryStatus } from "@/lib/catalog";

const TONE: Record<DiscoveryStatus["tone"], string> = {
  public: "bg-primary text-primary-foreground border-primary",
  queued: "bg-secondary/15 text-[hsl(40_70%_30%)] border-secondary/50 border-dashed",
  library: "bg-muted text-muted-foreground border-border",
  archived: "bg-transparent text-muted-foreground/70 border-border line-through",
};

export function CatalogStatusBadge({ status, className }: { status: DiscoveryStatus; className?: string }) {
  return (
    <span
      data-testid="status-discovery"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap",
        TONE[status.tone],
        className,
      )}
    >
      {status.tone === "public" && <span className="h-1.5 w-1.5 rounded-full bg-secondary" />}
      {status.label}
    </span>
  );
}

export function F0AdvisoryTag({ className }: { className?: string }) {
  return (
    <p
      data-testid="text-f0-advisory"
      className={cn("font-mono text-[9px] font-bold uppercase tracking-wider text-[hsl(40_70%_32%)]", className)}
    >
      F0 advisory report · not a certification
    </p>
  );
}
