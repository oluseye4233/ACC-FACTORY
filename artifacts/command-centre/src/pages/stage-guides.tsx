import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import {
  getGetStageGuidesQueryKey,
  useGenerateStageGuide,
  usePublishStageGuide,
  useSaveStageGuide,
  useSyncStageGuide,
  type StageGuide,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { GUIDE_DISCLAIMER, GuideViewer, useViewerStageGuides, STAGE_GUIDE_KEYS, guideErrMessage } from "@/components/shared/StageGuidePanel";

const MAX_CHARS = 1800;
const MAX_WORDS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const revKey = (g: StageGuide) => `${g.id ?? "default"}:${g.kind}:${g.version}`;

const STATE_TONE: Record<string, string> = {
  DRAFT: "border-dashed text-muted-foreground",
  SUBMITTING: "border-secondary/50 text-secondary",
  GENERATING: "border-secondary/50 text-secondary",
  COMPLETE: "border-primary/50 text-primary",
  FAILED: "border-destructive/50 text-destructive",
  UNKNOWN: "border-destructive/50 text-destructive",
};

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-[11px]" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" data-testid={`checkbox-${id}`} />
      <span>{children}</span>
    </label>
  );
}

const btn = "inline-flex items-center gap-1 rounded border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50";

/** Admin editor for one selected revision. Remounted (form reset) when the revision changes. */
export function GuideManager({ guide, configured, onSaved }: { guide: StageGuide; configured: boolean; onSaved: (g: StageGuide) => void }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetStageGuidesQueryKey() });
  const save = useSaveStageGuide({ mutation: { retry: false } });
  const generate = useGenerateStageGuide({ mutation: { retry: false } });
  const sync = useSyncStageGuide({ mutation: { retry: false } });
  const publish = usePublishStageGuide({ mutation: { retry: false } });

  const [script, setScript] = useState(guide.script);
  const [scriptReviewed, setScriptReviewed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [creditsAccepted, setCreditsAccepted] = useState(false);
  const [recoverId, setRecoverId] = useState("");
  const [contentReviewed, setContentReviewed] = useState(false);
  const [sharingAccepted, setSharingAccepted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = script !== guide.script;
  const words = wordCount(script);
  const tooLong = script.length > MAX_CHARS || words > MAX_WORDS;
  const looksHtml = /<[a-z/!][^>]*>/i.test(script);
  const busy = save.isPending || generate.isPending || sync.isPending || publish.isPending;
  const inFlight = guide.state === "SUBMITTING" || guide.state === "GENERATING" || guide.state === "UNKNOWN";
  const canGenerate = configured && !!guide.id && !dirty && guide.state === "DRAFT";
  const isFailed = guide.state === "FAILED";
  const canPublish = !!guide.id && guide.state === "COMPLETE" && !guide.isTest && !guide.published;
  const fail = (e: unknown) => { setErr(guideErrMessage(e)); setNotice(null); };
  const ok = (msg: string) => { setErr(null); setNotice(msg); void invalidate(); };

  return (
    <section className="space-y-4 rounded-lg border border-secondary/40 bg-card p-4" aria-label="Manage guide revision" data-testid="panel-guide-manager">
      <header className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-secondary" aria-hidden />
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Manage {guide.stageKey} · v{guide.version}</h3>
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${STATE_TONE[guide.state] ?? ""}`} data-testid="status-guide-state">{guide.state}</span>
        {guide.isTest && <span className="rounded border border-dashed px-1.5 py-0.5 font-mono text-[9px] uppercase" data-testid="badge-test">test render</span>}
        {guide.published && <span className="rounded border border-primary/50 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">published</span>}
        {!guide.id && <span className="font-mono text-[9px] uppercase text-muted-foreground">reviewed default, not yet saved</span>}
      </header>

      <div>
        <label htmlFor="guide-script" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Script (plain text)</label>
        <textarea id="guide-script" value={script} onChange={(e) => setScript(e.target.value)} rows={9} className="w-full rounded border bg-background p-2 text-xs leading-relaxed" data-testid="input-guide-script" />
        <p className={`font-mono text-[10px] ${tooLong ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-script-count">
          {script.length}/{MAX_CHARS} chars · {words}/{MAX_WORDS} words{dirty ? " · unsaved edits" : ""}
        </p>
        {looksHtml && <p className="text-[11px] text-destructive">Use plain text only; markup is not accepted.</p>}
        <button type="button" className={`${btn} mt-2 border-primary/40 text-primary hover:bg-primary/10`} disabled={(!dirty && !isFailed) || tooLong || looksHtml || script.trim().length < 40 || busy}
          onClick={() => save.mutate({ data: { stageKey: guide.stageKey, kind: guide.kind, script } }, { onSuccess: (g) => { ok(`Saved as new draft v${g.version}. Published versions stay live.`); onSaved(g); }, onError: fail })}
          data-testid="button-save-script">
          {save.isPending ? "Saving..." : isFailed && !dirty ? "Save as new revision" : "Save new version"}
        </button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Render (private)</p>
        <p className="text-[11px] text-muted-foreground" data-testid="text-render-caps">Limits: at most 2 renders in progress at once, and 4 renders (test or paid) per 15 minutes across the platform. Submissions are never retried automatically.</p>
        {isFailed && <p className="text-[11px] text-destructive" data-testid="text-failed-resave">This render failed. Use Save as new revision above (the script can stay unchanged) to create a fresh draft, then render that draft.</p>}
        {!configured && <p className="text-[11px] text-muted-foreground">Rendering is disabled until the Synthesia key is configured.</p>}
        {inFlight && <p className="text-[11px]" data-testid="text-inflight">A submission is {guide.state.toLowerCase()}. New renders are blocked until it resolves; refresh status{guide.state === "UNKNOWN" ? " or recover it by provider video ID" : ""}.</p>}
        {canGenerate && (
          <>
            <Check id="script-reviewed" checked={scriptReviewed} onChange={setScriptReviewed}>I reviewed this exact saved script.</Check>
            <Check id="paid-render" checked={paid} onChange={(v) => { setPaid(v); if (!v) setCreditsAccepted(false); }}>Request a paid production render instead of a watermarked test.</Check>
            {paid && <Check id="credits-accepted" checked={creditsAccepted} onChange={setCreditsAccepted}>I accept this consumes Synthesia credits on the platform account.</Check>}
          </>
        )}
        <button type="button" className={`${btn} border-secondary/50 text-secondary hover:bg-secondary/10`}
          disabled={!canGenerate || !scriptReviewed || (paid && !creditsAccepted) || busy}
          onClick={() => guide.id && generate.mutate({ id: guide.id, data: { test: !paid, scriptReviewed, creditsAccepted: paid && creditsAccepted } }, { onSuccess: () => ok("Submitted. Check status manually; nothing retries automatically."), onError: fail })}
          data-testid="button-generate">
          {generate.isPending ? "Submitting..." : paid ? "Generate paid render" : "Generate test video"}
        </button>
        {dirty && <p className="text-[11px] text-muted-foreground">Save the edited script before rendering.</p>}
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btn} hover:bg-muted`} disabled={!guide.id || busy || guide.state === "DRAFT" || guide.state === "UNKNOWN"}
            onClick={() => guide.id && sync.mutate({ id: guide.id, data: {} }, { onSuccess: (g) => ok(`Status: ${g.state}.`), onError: fail })} data-testid="button-sync">
            <RefreshCw className="h-3 w-3" /> {sync.isPending ? "Refreshing..." : "Refresh status"}
          </button>
          <a href="https://app.synthesia.io/" target="_blank" rel="noopener noreferrer" className={`${btn} hover:bg-muted`} data-testid="link-synthesia-studio">
            Review in Synthesia Studio <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {guide.providerVideoId && <p className="font-mono text-[10px] text-muted-foreground">Provider video {guide.providerVideoId}</p>}
        {guide.state === "UNKNOWN" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px]">Recover by provider video UUID
              <input value={recoverId} onChange={(e) => setRecoverId(e.target.value.trim())} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1 block w-80 max-w-full rounded border bg-background px-2 py-1 font-mono text-[11px]" data-testid="input-recover-id" />
            </label>
            <button type="button" className={`${btn} border-secondary/50 text-secondary`} disabled={!UUID_RE.test(recoverId) || busy || !guide.id}
              onClick={() => guide.id && sync.mutate({ id: guide.id, data: { providerVideoId: recoverId } }, { onSuccess: (g) => ok(`Recovered. Status: ${g.state}.`), onError: fail })} data-testid="button-recover">
              Recover submission
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Publish</p>
        {guide.isTest && <p className="text-[11px] text-muted-foreground" data-testid="text-test-unpublishable">Test renders cannot be published. Generate a paid render to share.</p>}
        {canPublish ? (
          <>
            <Check id="content-reviewed" checked={contentReviewed} onChange={setContentReviewed}>I watched the finished video in Synthesia Studio and its content matches the script.</Check>
            <Check id="public-sharing" checked={sharingAccepted} onChange={setSharingAccepted}>I consent to making this video publicly shareable to all subscribers.</Check>
            <button type="button" className={`${btn} border-primary/50 bg-primary text-primary-foreground`} disabled={!contentReviewed || !sharingAccepted || busy}
              onClick={() => guide.id && publish.mutate({ id: guide.id, data: { contentReviewed, publicSharingAccepted: sharingAccepted } }, { onSuccess: () => ok("Published. Subscribers now see this version."), onError: fail })} data-testid="button-publish">
              {publish.isPending ? "Publishing..." : "Publish"}
            </button>
          </>
        ) : !guide.isTest && !guide.published && <p className="text-[11px] text-muted-foreground">Publishing becomes available once a paid render is COMPLETE.</p>}
      </div>

      {err && <p role="alert" className="text-[11px] text-destructive" data-testid="text-manage-error">{err}</p>}
      {notice && <p role="status" className="text-[11px] text-primary" data-testid="text-manage-notice">{notice}</p>}
    </section>
  );
}

export default function StageGuidesPage() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("stage");
  const [stage, setStage] = useState<string>(initial && (STAGE_GUIDE_KEYS as readonly string[]).includes(initial) ? initial : "F0");
  const [selected, setSelected] = useState<string | null>(null);
  const v = useViewerStageGuides();
  const q = v.q;
  const canManage = v.canManage;
  const lib = q.data;

  const guides = useMemo(() => (lib?.guides ?? []).filter((g) => g.stageKey === stage), [lib, stage]);
  const revisions = useMemo(() => [...(lib?.guides ?? []), ...(lib?.history ?? [])].filter((g) => g.stageKey === stage), [lib, stage]);
  const current = revisions.find((g) => revKey(g) === selected) ?? guides[0];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">
        <header className="mb-6 border-b pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-secondary">Production floor · teaching reel</p>
          <h1 className="font-display text-3xl">Stage guides</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">One stage at a time, F0 to F12. {GUIDE_DISCLAIMER}</p>
        </header>

        {lib && !lib.configured && (
          <div className="mb-6 flex gap-3 rounded border border-dashed p-3 text-[12px]" data-testid="banner-not-configured">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>Video rendering is not configured; transcripts remain fully usable.{canManage && " Admin setup: add SYNTHESIA_API_KEY in Secrets (Synthesia Pro/Enterprise, Legacy v2 API scope)."}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
          <nav aria-label="Stages" className="flex gap-1 overflow-x-auto md:flex-col">
            {STAGE_GUIDE_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => { setStage(k); setSelected(null); }} aria-current={stage === k ? "true" : undefined}
                className={`shrink-0 rounded px-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-wider ${stage === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                data-testid={`button-stage-${k}`}>{k}</button>
            ))}
          </nav>

          <div className="min-w-0 space-y-4">
            {v.identityError && <p role="alert" className="text-sm text-destructive">Could not confirm your account. <button type="button" className="underline" onClick={() => void v.refetchIdentity()} data-testid="button-retry-identity">Retry</button></p>}
            {v.isLoading && <div className="space-y-3"><div className="h-40 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded bg-muted" /></div>}
            {q.isError && (
              <p role="alert" className="text-sm text-destructive">Could not load guides: {guideErrMessage(q.error)}{" "}
                <button type="button" className="underline" onClick={() => void q.refetch()} data-testid="button-retry-guides">Retry</button></p>
            )}
            {lib && guides.length === 0 && <p className="rounded border border-dashed p-6 text-sm text-muted-foreground">No guide exists for {stage} yet.</p>}
            {guides.map((g, i) => <GuideViewer key={revKey(g)} guide={g} idSuffix={`${stage}-${g.kind}-${i}`} />)}

            {canManage && revisions.length > 0 && current && (
              <div className="space-y-3">
                <label className="block text-[11px]">Revision
                  <select value={revKey(current)} onChange={(e) => setSelected(e.target.value)} className="mt-1 block rounded border bg-background px-2 py-1 font-mono text-[11px]" data-testid="select-revision">
                    {revisions.map((g) => <option key={revKey(g)} value={revKey(g)}>{g.kind} v{g.version} · {g.state}{g.published ? " · published" : ""}{g.isTest ? " · test" : ""}</option>)}
                  </select>
                </label>
                <GuideManager key={revKey(current)} guide={current} configured={Boolean(lib?.configured)} onSaved={(g) => setSelected(revKey(g))} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
