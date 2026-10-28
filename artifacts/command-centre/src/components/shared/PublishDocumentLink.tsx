import { Link } from "wouter";
import { Bot, FileOutput } from "lucide-react";
import { agentCreatorHref, portalHref } from "@/lib/portal";

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
    <Link href={props.sourceId && props.sourceKind !== "F95_LIVING_PDD" ? portalHref({ sourceId: props.sourceId, sourceType: "ARTIFACT", sessionId: props.sessionId }) : portalHref({ sessionId: props.sessionId })} className={cls} data-testid="link-publish-document">
      <FileOutput className="h-3.5 w-3.5" /> {props.label ?? "Publish via IMPRIMA Portal"}
    </Link>
  );
}

export function ShortSprintsLink({ sessionId }: { sessionId: string }) {
  return (
    <Link href={agentCreatorHref({ sessionId })} className={cls} data-testid="link-agent-creator">
      <Bot className="h-3.5 w-3.5" /> Open Agent Creator
    </Link>
  );
}
