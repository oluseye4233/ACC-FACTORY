import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CatalogStatusBadge, F0AdvisoryTag } from "./CatalogStatusBadge";
import { KIND_LABEL, discoveryStatus, sourceLabel, type CatalogItem, type CatalogKind } from "@/lib/catalog";

/** Capsule "cover" colours per kind: forest / gold / ink derived from ATANDA brand. */
const COVER: Record<CatalogKind, string> = {
  SPC: "from-[hsl(144_61%_22%)] to-[hsl(150_45%_12%)]",
  MA: "from-[hsl(45_68%_45%)] to-[hsl(32_60%_30%)]",
  MPDD: "from-[hsl(168_35%_30%)] to-[hsl(190_40%_16%)]",
  PDD: "from-[hsl(210_18%_30%)] to-[hsl(220_22%_14%)]",
  F0_REPORT: "from-[hsl(30_20%_40%)] to-[hsl(25_18%_22%)]",
};

export interface CatalogCardProps {
  item: CatalogItem;
  publicOpen?: boolean;
  /** When provided, the title/cover links here. Omit in public context to avoid internal links. */
  href?: string;
  footer?: ReactNode;
  showOwnership?: boolean;
}

export function CatalogCard({ item, publicOpen, href, footer, showOwnership }: CatalogCardProps) {
  const status = discoveryStatus(item, publicOpen);
  const cover = (
    <div
      className={cn(
        "relative h-24 overflow-hidden bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-[1.02]",
        COVER[item.kind],
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 9px)",
        }}
      />
      <span className="absolute left-3 top-2 font-display text-4xl leading-none tracking-wider opacity-90">
        {KIND_LABEL[item.kind]}
      </span>
      <span className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-wider opacity-80">
        {sourceLabel(item)}
      </span>
      {item.jcse !== null && (
        <span className="absolute right-3 top-3 text-right">
          <span className="block font-display text-3xl leading-none">{item.jcse}</span>
          <span className="block font-mono text-[9px] uppercase opacity-80">JCSE / 50</span>
        </span>
      )}
    </div>
  );

  return (
    <article
      data-testid={`card-catalog-${item.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-md border bg-card transition-shadow hover:shadow-[0_6px_24px_-12px_hsl(144_61%_20%/0.45)]",
        item.active === false && "opacity-60",
      )}
    >
      {href ? (
        <Link href={href} className="block overflow-hidden" data-testid={`link-cover-${item.id}`}>
          {cover}
        </Link>
      ) : (
        <div className="overflow-hidden">{cover}</div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <CatalogStatusBadge status={status} />
          {item.qualification?.decision === "APPROVED" && (
            <span className="rounded-sm border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
              Qualified {item.qualification.version}
            </span>
          )}
          {item.qualification?.decision === "REJECTED" && (
            <span className="rounded-sm border border-destructive/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-destructive">
              Review rejected
            </span>
          )}
          {showOwnership && item.isOwner && (
            <span className="rounded-sm bg-foreground/90 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-background">
              Yours
            </span>
          )}
        </div>
        <h3 className="font-display text-xl leading-tight tracking-wide" data-testid={`text-title-${item.id}`}>
          {href ? (
            <Link href={href} className="hover:text-primary">
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.tagline}</p>
        {item.kind === "F0_REPORT" && <F0AdvisoryTag />}
        <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pt-2 font-mono text-[10px] text-muted-foreground">
          {item.certClass && (
            <>
              <dt className="text-primary/80">CLASS</dt>
              <dd className="truncate">{item.certClass}</dd>
            </>
          )}
          {item.disc && (
            <>
              <dt className="text-primary/80">DISC</dt>
              <dd className="truncate" title={item.disc}>
                {item.disc}
              </dd>
            </>
          )}
          <dt className="text-primary/80">SKU</dt>
          <dd className="truncate" title={item.sku}>
            {item.sku}
          </dd>
        </dl>
        {footer && <div className="border-t pt-2">{footer}</div>}
      </div>
    </article>
  );
}

export function CatalogCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="h-24 animate-pulse bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
