import { useState } from "react";
import { Link } from "wouter";
import { CornerDownLeft } from "lucide-react";
import { BoomerangCaseList } from "./BoomerangCaseList";
import { BoomerangCreateForm } from "./BoomerangCreateForm";
import { workspaceHref } from "./boomerang-model";

export interface BoomerangPanelProps {
  originKind: "SESSION" | "F0";
  originId: string;
  stage: string;
  readOnly?: boolean;
}

/** Origin-scoped supporting-work requests. Read-only viewers see no owner data or controls. */
export function BoomerangPanel({ originKind, originId, stage, readOnly }: BoomerangPanelProps) {
  const [offset, setOffset] = useState(0);
  const effStage = originKind === "F0" ? "F0" : stage;
  return (
    <section className="border rounded p-3 bg-card space-y-3" data-testid="panel-boomerang">
      <header className="flex flex-wrap items-baseline gap-2 border-b pb-1.5">
        <CornerDownLeft className="h-3.5 w-3.5 text-secondary self-center" />
        <h4 className="text-lg leading-none">Boomerang · {effStage}</h4>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">supporting work · advisory only</span>
        {!readOnly && <Link href={workspaceHref(originKind, originId, effStage)} className="ml-auto font-mono text-[10px] text-primary underline" data-testid="link-boomerang-workspace">Open workspace</Link>}
      </header>
      {readOnly ? (
        <p className="font-mono text-[11px] text-muted-foreground" data-testid="text-boomerang-readonly">Supporting-work requests are private to the owner of this origin.</p>
      ) : (
        <>
          <BoomerangCreateForm originKind={originKind} originId={originId} stage={effStage} />
          <BoomerangCaseList params={{ originKind, originId, stage: effStage }} offset={offset} onOffset={setOffset} emptyText={`No ${effStage} support requests for this origin yet.`} />
        </>
      )}
    </section>
  );
}

export default BoomerangPanel;
