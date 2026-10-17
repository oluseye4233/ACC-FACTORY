import { Link } from "wouter";
import { FileOutput, Rocket } from "lucide-react";

export function operationsHref(kind: "imprima" | "short-sprints", p: { sessionId?: string | null; sourceId?: string | null; sourceKind?: string | null }) {
  const q = new URLSearchParams({ kind });
  if (p.sessionId) q.set("sessionId", p.sessionId);
  if (p.sourceId) q.set("sourceId", p.sourceId);
  if (p.sourceKind) q.set("sourceKind", p.sourceKind);
  return `/operations?${q.toString()}`;
}

const cls =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-secondary/50 bg-secondary/5 font-mono text-[10px] uppercase tracking-wider text-foreground hover:bg-secondary/15 transition-colors";

export function PublishDocumentLink(props: { sourceId?: string | null; sourceKind?: string | null; sessionId?: string | null; label?: string }) {
  return (
    <Link href={operationsHref("imprima", props)} className={cls} data-testid="link-publish-document">
      <FileOutput className="h-3.5 w-3.5" /> {props.label ?? "Publish document"}
    </Link>
  );
}

export function ShortSprintsLink({ sessionId }: { sessionId: string }) {
  return (
    <Link href={operationsHref("short-sprints", { sessionId })} className={cls} data-testid="link-short-sprints">
      <Rocket className="h-3.5 w-3.5" /> Manage SHORT SPRINTS
    </Link>
  );
}
