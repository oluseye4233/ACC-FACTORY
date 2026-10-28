import { Link } from "wouter";
import { FileOutput } from "lucide-react";
import { portalHref, type PortalSourceType } from "@/lib/portal";

const cls = "inline-flex items-center gap-1 h-8 px-3 rounded-md border border-input bg-background font-mono text-xs hover:bg-muted/60 transition-colors";

/**
 * Project artifacts leave the platform only through the IMPRIMA Portal. This replaces
 * former in-browser Blob/attachment downloads with a link bound to the exact source ID.
 */
export function PortalArtifactLink({ sourceId, sourceType = "ARTIFACT", parentId, kind, sessionId, label = "Publish via Portal", testId, missingReason = "Save this output first; it has no artifact ID to publish yet.", className, exportOptions }: {
  sourceId?: string | null; sourceType?: PortalSourceType; parentId?: string | null; kind?: string | null; sessionId?: string | null;
  label?: string; testId: string; missingReason?: string; className?: string; exportOptions?: object | null;
}) {
  if (!sourceId) return <span className="font-mono text-[10px] text-muted-foreground" data-testid={`${testId}-unavailable`}>{missingReason}</span>;
  return (
    <Link href={portalHref({ sourceId, sourceType, parentId, kind, sessionId, exportOptions })} className={`${cls} ${className ?? ""}`} data-testid={testId}>
      <FileOutput className="h-3 w-3" /> {label}
    </Link>
  );
}
