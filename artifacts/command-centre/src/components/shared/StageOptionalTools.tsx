import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Briefcase, CornerDownLeft, Layers } from "lucide-react";
import { BoomerangPanel } from "@/components/boomerang";
import { RETURN_WITH_ARTIFACT_LABEL } from "@/components/boomerang/ReturnedUpgrade";
import { f0OriginHref, sessionStageHref, spcPlayerOriginHref } from "@/lib/stage-origin";

interface Props {
  sessionId: string;
  featureId: number;
  stageLabel: string;
  isSessionOwner: boolean;
}

function Explain({ what, outcome, how, back }: { what: string; outcome: string; how: string; back: string }) {
  const rows: [string, string][] = [["What it does", what], ["Outcome", outcome], ["How to use", how], ["Return to this stage", back]];
  return (
    <dl className="space-y-2 text-xs leading-relaxed">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd className="text-foreground/90">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ToolBox({ id, icon, title, tag, children }: { id: string; icon: ReactNode; title: string; tag: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border bg-card open:md:col-span-3 open:border-primary/40" data-testid={`tool-${id}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        <span className="text-primary">{icon}</span>
        <span className="font-mono text-xs font-bold uppercase tracking-wider">{title}</span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tag}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  );
}

/**
 * Optional, advisory-only tools for a session stage. Nothing here advances,
 * certifies, or clears a stage gate; returns always require explicit review.
 */
export function StageOptionalTools({ sessionId, featureId, stageLabel, isSessionOwner }: Props) {
  return (
    <section id="stage-optional-tools" aria-labelledby="stage-optional-tools-title" className="mx-auto w-full max-w-5xl px-4 pb-8 pt-6">
      <div className="mb-3 text-center">
        <h2 id="stage-optional-tools-title" className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Optional tools · {stageLabel}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Advisory only. None of these advance, certify or clear this stage.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ToolBox id="boomerang" icon={<CornerDownLeft className="h-4 w-4" />} title="Boomerang" tag="supporting work">
          <Explain
            what={`Requests supporting work bound to ${stageLabel} of this session, then tracks its return.`}
            outcome="Returned work appears for your explicit review. Accepting it records that you reviewed supporting input; it is not injected into prompts and does not pass the gate."
            how="Describe the support you need below and submit. Open the workspace to follow cases across stages."
            back={`Requests made here stay on this page. If you open the workspace, use your browser Back button or the link below to return to ${stageLabel}.`}
          />
          {isSessionOwner ? (
            <BoomerangPanel key={`${sessionId}:${featureId}`} originKind="SESSION" originId={sessionId} stage={stageLabel} />
          ) : (
            <p className="text-[11px] text-muted-foreground" data-testid="text-boomerang-readonly">Supporting-work requests are private to the session owner.</p>
          )}
          {isSessionOwner && (
            <p className="text-[11px] text-muted-foreground">
              F9.5 custody and F12 support live in the{" "}
              <Link href={`/boomerang?originKind=SESSION&originId=${encodeURIComponent(sessionId)}&stage=F9.5`} className="text-primary underline">process-wide workspace</Link>. Supporting work does not activate those operations.
            </p>
          )}
        </ToolBox>

        <ToolBox id="spc-player" icon={<Layers className="h-4 w-4" />} title="SPC Player" tag="plan-only package">
          <Explain
            what={`Runs a deck of SPC cards against the saved ${stageLabel} artifact. The source is locked to this exact stage.`}
            outcome={`A plan-only JSON package. After you confirm return, it attaches to ${stageLabel} as an Upgraded candidate awaiting fresh evaluation; it never certifies or advances the stage.`}
            how="Open the SPC Player, write a brief, pick cards, register, then execute the run."
            back={`On the completed run, press ${RETURN_WITH_ARTIFACT_LABEL}. Confirm the return: the package is saved first, then you are taken to its artifact at ${stageLabel} for review and fresh evaluation. A plain Back link navigates without returning work.`}
          />
          {isSessionOwner ? (
            <Link href={spcPlayerOriginHref(sessionId, featureId)} className="inline-flex items-center gap-1 rounded border border-primary/40 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10" data-testid="link-open-spc-player">
              Open SPC Player for {stageLabel} <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <p className="text-[11px] text-muted-foreground">Only the session owner can start an origin-bound run.</p>
          )}
        </ToolBox>

        <ToolBox id="f0" icon={<Briefcase className="h-4 w-4" />} title="F0 Advisory" tag="business read">
          <Explain
            what="Opens F0 Business Intelligence to pressure-test viability, positioning and financials alongside this stage."
            outcome="An advisory report with a bear case and range-based financials. F0 reports are not automatically adopted into this session."
            how="Open F0, start or select an engagement, run SOCRATES discovery and generate a report. To use findings here, copy the relevant report text into a Boomerang request at this stage and review it on return."
            back={`F0 shows a Return to ${stageLabel} banner at the top for as long as you stay in it. Press it to come straight back to this stage.`}
          />
          <Link href={f0OriginHref(sessionId, featureId)} className="inline-flex items-center gap-1 rounded border border-secondary/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-secondary hover:bg-secondary/10" data-testid="link-open-f0-advisory">
            Open F0 Advisory <ArrowRight className="h-3 w-3" />
          </Link>
        </ToolBox>
      </div>
    </section>
  );
}

export function ReturnToStageBanner({ sessionId, featureId, stageLabel, note }: { sessionId: string; featureId: number; stageLabel: string; note: string }) {
  return (
    <div className="border-b border-primary/30 bg-primary/5" role="region" aria-label="Return to originating stage" data-testid="banner-return-to-stage">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2 md:px-8">
        <Link href={sessionStageHref(sessionId, featureId)} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-return-to-stage">
          <ArrowLeft className="h-3 w-3" /> Return to {stageLabel}
        </Link>
        <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          Opened from session {sessionId.slice(0, 8)} at {stageLabel}. {note}
        </p>
      </div>
    </div>
  );
}
