import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Bot, Briefcase, Boxes, CornerDownLeft, FileInput, FileOutput, Layers, Loader2 } from "lucide-react";
import { supportErrMessage, useLaunchDeparture, useStageSupportOptions, type SupportTool } from "@/lib/stage-support";
import { BoomerangPanel } from "@/components/boomerang";
import { RETURN_WITH_ARTIFACT_LABEL } from "@/components/boomerang/ReturnedUpgrade";
import { sessionStageHref, spcPlayerOriginHref } from "@/lib/stage-origin";

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

function ToolBox({ id, icon, title, tag, children, tone = "text-primary", status, attention = false }: { id: string; icon: ReactNode; title: string; tag: string; children: ReactNode; tone?: string; status?: ReactNode; attention?: boolean }) {
  return (
    <details className="group rounded-lg border bg-card open:md:col-span-3 open:border-primary/40" data-testid={`tool-${id}`}>
      <summary className={`flex cursor-pointer list-none items-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg ${attention ? "agent-creator-ready" : ""}`}>
        <span className={tone}>{icon}</span>
        {status}
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
const SUPPORT: { tool: SupportTool; title: string; tag: string; icon: ReactNode; tone: string; btn: string; what: string; outcome: string; how: string }[] = [
  { tool: "imprima", title: "IMPRIMA", tag: "document draft", icon: <FileOutput className="h-4 w-4" />, tone: "text-[hsl(272_55%_48%)]", btn: "border-[hsl(272_55%_48%/0.5)] text-[hsl(272_55%_42%)] hover:bg-[hsl(272_55%_48%/0.08)]",
    what: "Renders the saved source of this exact stage into private DOCX, PDF or HTML draft files, optionally with an internal clarity and claims assessment.",
    outcome: "Private, non-releasable DRAFT files referenced from a saved preparation. Returned as a candidate for review; never a certification, Final approval or gate pass.",
    how: "Launch, complete a private or internal preparation for the pre-selected source, then use the return action shown beside that completed preparation." },
  { tool: "agent-creator", title: "AGENT CREATOR", tag: "owned agent", icon: <Bot className="h-4 w-4" />, tone: "text-primary", btn: "border-primary/40 text-primary hover:bg-primary/10",
    what: "Creates an owned agent from this stage's saved MA birth package with its exact Micro PDD, or from its SPC, and lets you run it on text input.",
    outcome: "An internal, text-only agent with model-assessed evaluation, returned as a supporting artifact for your review. No external tools or side effects; not certification, not auto-approval, not a third-party deployment.",
    how: "Available only at F3/F4 with the MA's saved paired Micro PDD, or at F5 with a saved SPC. For SPCs, the Cheat Sheet is saved first, followed by drafting, internal checks and activation. Then use the return action beside the ACTIVE agent." },
  { tool: "ingestion", title: "INGESTION", tag: "seed and summary", icon: <FileInput className="h-4 w-4" />, tone: "text-primary", btn: "border-primary/40 text-primary hover:bg-primary/10",
    what: "Opens the Ingestion Engine prefilled once with this stage's saved source text. Your edits are never overwritten.",
    outcome: "A saved seed prompt and summary, returned to this stage as a candidate requiring review. Normal credit and generation gates still apply.",
    how: "Launch, review or edit the prefilled input, normalise it, then use the return action. Starting a new session from there remains a separate, optional choice." },
  { tool: "cartridge", title: "CARTRIDGE", tag: "scoped package", icon: <Boxes className="h-4 w-4" />, tone: "text-secondary", btn: "border-secondary/50 text-secondary hover:bg-secondary/10",
    what: "Opens Advanced Cartridge with project name and scope prefilled once from this stage's saved source.",
    outcome: "A built cartridge package returned to this stage as a candidate requiring review. Credit and build gates are unchanged.",
    how: "Launch, adjust scope and assets, build the cartridge, then use the return action." },
  { tool: "f0", title: "F0 ADVISORY", tag: "business read", icon: <Briefcase className="h-4 w-4" />, tone: "text-secondary", btn: "border-secondary/50 text-secondary hover:bg-secondary/10",
    what: "Opens F0 Business Intelligence with a new engagement bound to this stage's saved source, created for you on launch. You never pick or re-enter the source.",
    outcome: "A saved advisory report (bear case, range-based financials) returned to this stage as a candidate requiring review. Not automatically adopted; discovery and usage gates are unchanged.",
    how: "Launch, run SOCRATES discovery in the linked engagement, generate a report, then use the return action beside that saved report. Reports from other engagements cannot be returned here." },
];

function SupportLaunch({ sessionId, featureId, stageLabel, isSessionOwner }: Props) {
  const [, setLocation] = useLocation();
  const opts = useStageSupportOptions(sessionId, featureId, isSessionOwner);
  const launch = useLaunchDeparture();
  const [launching, setLaunching] = useState<SupportTool | null>(null);
  const [err, setErr] = useState<{ tool: SupportTool; msg: string } | null>(null);
  const go = (tool: SupportTool) => {
    setErr(null); setLaunching(tool);
    launch.mutate({ sessionId, featureId, tool }, {
      onSuccess: (d) => setLocation(d.launchHref),
      onError: (e) => { setErr({ tool, msg: supportErrMessage(e) }); setLaunching(null); },
    });
  };
  return (
    <>
      {SUPPORT.map((t) => {
        const st = opts.data?.tools.find((x) => x.tool === t.tool);
        const active = isSessionOwner && !!st?.active && (t.tool !== "agent-creator" || [3, 4, 5].includes(featureId));
        const reason = !isSessionOwner ? "Only the session owner can launch origin-bound support." : opts.isLoading ? "Checking stage, saved source and ownership..." : opts.isError ? `Status unavailable: ${supportErrMessage(opts.error)}` : st?.reason ?? "Not offered for this stage.";
        const status = (
          <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${active ? "border-primary/50 text-primary bg-primary/10" : "border-dashed text-muted-foreground"}`} data-testid={`status-tool-${t.tool}`}>
            {opts.isLoading && isSessionOwner ? "checking" : active ? "active" : "inactive"}
          </span>
        );
        return (
          <ToolBox key={t.tool} id={t.tool} icon={t.icon} title={t.title} tag={t.tag} tone={t.tone} status={status} attention={t.tool === "agent-creator" && active && !launch.isPending}>
            <Explain what={t.what} outcome={t.outcome} how={t.how}
              back={`A Back to ${stageLabel} banner stays at the top while you work; it only navigates. When a completed saved result exists, press ${RETURN_WITH_ARTIFACT_LABEL} and confirm. Your session is not replaced.`} />
            <p className={`text-[11px] ${active ? "text-foreground/80" : "text-muted-foreground"}`} data-testid={`text-tool-reason-${t.tool}`}>{reason}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!active || launch.isPending} onClick={() => go(t.tool)}
                className={`inline-flex items-center gap-1 rounded border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50 ${t.btn} ${t.tool === "agent-creator" && active && !launch.isPending ? "agent-creator-ready" : ""}`} data-testid={`button-launch-${t.tool}`}>
                {launching === t.tool ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {launching === t.tool ? "Opening..." : `Launch ${t.title} for ${stageLabel}`} {launching !== t.tool && <ArrowRight className="h-3 w-3" />}
              </button>
              {opts.isError && isSessionOwner && <button type="button" className="text-[11px] underline" onClick={() => opts.refetch()} data-testid={`button-retry-options-${t.tool}`}>Retry status</button>}
            </div>
            {err?.tool === t.tool && <p role="alert" className="text-[11px] text-destructive" data-testid={`text-launch-error-${t.tool}`}>Launch failed: {err.msg}. No departure was recorded.</p>}
          </ToolBox>
        );
      })}
    </>
  );
}

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

        <SupportLaunch sessionId={sessionId} featureId={featureId} stageLabel={stageLabel} isSessionOwner={isSessionOwner} />
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
