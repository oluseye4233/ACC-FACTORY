import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCreatedAgentQueryKey,
  getListCreatedAgentRunsQueryKey,
  getListCreatedAgentsQueryKey,
  getGetImprimaPortalQueryKey,
  useCreateGovernedAgent,
  useGetCreatedAgent,
  useGetImprimaPortal,
  useHarnessF4,
  useListCreatedAgentRuns,
  useListCreatedAgents,
  useRunCreatedAgent,
  type CreatedAgent,
} from "@workspace/api-client-react";
import { ArrowLeft, Bot, FileOutput, Loader2, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionStageHref, stageLabel } from "@/lib/stage-origin";
import { apiErr, newRequestKey, portalHref } from "@/lib/portal";
import { StageSupportBanner, StageSupportReturnAction, useStageSupportCase } from "@/components/shared/StageSupportReturn";
import type { Departure } from "@/lib/stage-support";

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const sel = "h-9 w-full rounded-md border bg-background px-2 font-mono text-xs";
const fmt = (s: string) => new Date(s).toLocaleString();
/** MA sources are MA birth packages; MICRO_PDD is only ever the paired companion. */
const MA_TYPE = "MA_BIRTH_PACKAGE";
/** parentSourceArtifactId is the MA a Micro PDD was converted from (artifactContent.sourceArtifactId). Read defensively until codegen lands. */
const parentOf = (s: { parentSourceArtifactId?: string | null }) => s.parentSourceArtifactId ?? null;

const STATE_TONE: Record<string, string> = {
  ACTIVE: "border-primary/50 text-primary bg-primary/10",
  BUILDING: "border-secondary/60 text-secondary bg-secondary/10 animate-pulse",
  NEEDS_REWORK: "border-secondary/60 text-secondary bg-secondary/5",
  FAILED: "border-destructive/50 text-destructive bg-destructive/10",
};

export function AgentState({ state }: { state: string }) {
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${STATE_TONE[state] ?? "border-border text-muted-foreground"}`} data-testid={`status-agent-${state}`}>{state}</span>;
}

function Disclosure() {
  return (
    <div className="rounded-md border border-secondary/50 bg-secondary/5 p-3 text-xs leading-relaxed" data-testid="text-runtime-disclosure">
      <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-secondary"><ShieldAlert className="h-3.5 w-3.5" /> Internal text-only runtime</p>
      <p className="mt-1 text-foreground/85">Agents run here on text input only. No external tools, network actions or side effects. Evaluation is internal model-assessed, not independent certification, and this is not an F12 or third-party deployment.</p>
    </div>
  );
}

function CreatePanel({ initialSource, sessionId, onCreated }: { initialSource: string; sessionId: string; onCreated: (a: CreatedAgent) => void }) {
  const qc = useQueryClient();
  const portal = useGetImprimaPortal();
  const create = useCreateGovernedAgent();
  const f4 = useHarnessF4();
  const [sourceId, setSourceId] = useState(initialSource);
  const [microId, setMicroId] = useState("");
  const [costOk, setCostOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f4Err, setF4Err] = useState<string | null>(null);
  // One stable key per attempt; a manual retry of the same inputs reuses it so the server can deduplicate.
  const attemptKey = useRef(newRequestKey());
  // A departure from F4 arrives with the Micro PDD as source: select its exact parent MA and keep that Micro.
  const seeded = useRef(false);
  const keepMicro = useRef<string | null>(null);

  const artifacts = useMemo(() => (portal.data?.sources ?? []).filter((s) => s.sourceType === "ARTIFACT"), [portal.data]);
  const eligible = artifacts.filter((s) => s.type === MA_TYPE || s.type === "SPC");
  const source = artifacts.find((s) => s.id === sourceId);
  const isMa = source?.type === MA_TYPE;
  // Exact pairing only: the companion must have been converted from this MA, in the same session.
  const micros = artifacts.filter((s) => s.type === "MICRO_PDD" && !!sourceId && parentOf(s) === sourceId && (!source?.sessionId || s.sessionId === source.sessionId));
  const initial = artifacts.find((s) => s.id === initialSource);
  const orphanMicro = initial?.type === "MICRO_PDD" && !parentOf(initial);

  useEffect(() => {
    if (seeded.current || !portal.data) return;
    seeded.current = true;
    const init = portal.data.sources.find((s) => s.sourceType === "ARTIFACT" && s.id === initialSource);
    const parent = init && init.type === "MICRO_PDD" ? parentOf(init) : null;
    if (init && parent) { keepMicro.current = init.id; setSourceId(parent); setMicroId(init.id); }
  }, [portal.data, initialSource]);
  useEffect(() => { attemptKey.current = newRequestKey(); setErr(null); }, [sourceId, microId]);
  const lastSource = useRef(sourceId);
  useEffect(() => {
    if (lastSource.current === sourceId) return; // mount or no change
    lastSource.current = sourceId;
    if (keepMicro.current) { keepMicro.current = null; return; }
    setMicroId(""); setCostOk(false); setF4Err(null);
  }, [sourceId]);

  const ready = !!sourceId && (!isMa || !!microId) && !create.isPending;

  const submit = async () => {
    setErr(null);
    try {
      const a = await create.mutateAsync({ data: { sourceArtifactId: sourceId, ...(isMa ? { microPddArtifactId: microId } : {}), requestKey: attemptKey.current } });
      attemptKey.current = newRequestKey();
      void qc.invalidateQueries({ queryKey: getListCreatedAgentsQueryKey() });
      onCreated(a);
    } catch (e) { setErr(apiErr(e)); }
  };

  const convert = async () => {
    if (!source?.sessionId) return;
    setF4Err(null);
    try {
      const m = await f4.mutateAsync({ data: { sessionId: source.sessionId, sourceArtifactId: source.id } });
      void qc.invalidateQueries({ queryKey: getGetImprimaPortalQueryKey() });
      if (m.artifactId) setMicroId(m.artifactId);
      else setF4Err("Conversion finished but no saved Micro PDD ID was returned. Refresh sources and select it manually.");
    } catch (e) { setF4Err(`${apiErr(e)}. Your MA ${source.id.slice(0, 8)} is unchanged and still selected.`); }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3" data-testid="panel-create-agent">
      <h2 className="font-display text-xl tracking-wider">Create an owned agent</h2>
      <p className="text-xs text-muted-foreground">Source: an MA with its exact paired Micro PDD, or an SPC. Only artifacts you own are listed.</p>
      {portal.isLoading ? <Skeleton className="h-9 w-full" /> : portal.isError ? (
        <p role="alert" className="text-xs text-destructive">Sources unavailable: {apiErr(portal.error)} <button className="underline" onClick={() => void portal.refetch()}>Retry</button></p>
      ) : (
        <label className="block space-y-1">
          <span className={lab}>Source artifact (MA or SPC)</span>
          <select className={sel} value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="select-agent-source">
            <option value="">Select a source</option>
            {eligible.map((s) => <option key={s.id} value={s.id}>{s.type === MA_TYPE ? "MA" : s.type} · {s.title}</option>)}
            {initialSource && initial?.type !== "MICRO_PDD" && !eligible.some((s) => s.id === initialSource) && <option value={initialSource}>Linked {initialSource.slice(0, 8)} (not listed as MA/SPC)</option>}
          </select>
        </label>
      )}
      {portal.data?.protectedSourcesStatus && portal.data.protectedSourcesStatus !== "AVAILABLE" && <p role="alert" className="text-xs text-destructive" data-testid="text-agent-sources-unavailable">Some protected sources are unavailable ({portal.data.protectedSourcesStatus}); this list may be incomplete.</p>}
      {orphanMicro && <p role="alert" className="text-xs text-destructive" data-testid="text-micro-no-parent">The linked Micro PDD {initialSource.slice(0, 8)} has no recorded parent MA, so it cannot be paired. Select an MA and its exact companion.</p>}
      {portal.data && eligible.length === 0 && portal.data.protectedSourcesStatus !== "UNAVAILABLE_PROTECTED_WORKFLOWS" && <p className="text-xs text-muted-foreground" data-testid="text-no-agent-sources">No saved MA or SPC artifacts yet. Complete F3 or F5 in a session first.</p>}
      {isMa && (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <label className="block space-y-1">
            <span className={lab}>Paired Micro PDD (converted from this MA)</span>
            <select className={sel} value={microId} onChange={(e) => setMicroId(e.target.value)} data-testid="select-agent-micro">
              <option value="">Select the exact Micro PDD</option>
              {micros.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              {microId && !micros.some((m) => m.id === microId) && <option value={microId}>New Micro PDD {microId.slice(0, 8)}</option>}
            </select>
          </label>
          {micros.length === 0 && !microId && (
            <div className="space-y-2" data-testid="panel-f4-offer">
              <p className="text-xs">This MA has no paired Micro PDD. You can run the existing F4 conversion now. <b>F4 is a paid model call</b> billed like any F4 run; it is not retried automatically.</p>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={costOk} onChange={(e) => setCostOk(e.target.checked)} data-testid="check-f4-cost" /> I accept the F4 conversion cost</label>
              <Button size="sm" variant="outline" disabled={!costOk || f4.isPending || !source?.sessionId} onClick={convert} data-testid="button-run-f4">
                {f4.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Convert MA to Micro PDD (F4)
              </Button>
              {!source?.sessionId && <p className="text-[11px] text-muted-foreground">No session is recorded for this MA, so F4 cannot run here.</p>}
              {f4Err && <p role="alert" className="text-[11px] text-destructive" data-testid="text-f4-error">{f4Err}</p>}
            </div>
          )}
        </div>
      )}
      {sessionId && <p className="text-[11px] text-muted-foreground">Opened from session {sessionId.slice(0, 8)}.</p>}
      <Button className="w-full" disabled={!ready} onClick={submit} data-testid="button-create-agent">
        {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />} {err ? "Retry this attempt" : "Create agent"}
      </Button>
      {err && <p role="alert" className="text-xs text-destructive" data-testid="text-create-error">Creation failed: {err}. Retrying reuses the same request key; nothing was resubmitted automatically.</p>}
    </section>
  );
}

function AgentDetail({ agentId, departure }: { agentId: string; departure: Departure | null }) {
  const qc = useQueryClient();
  const agent = useGetCreatedAgent(agentId);
  const runs = useListCreatedAgentRuns(agentId);
  const run = useRunCreatedAgent();
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newRequestKey());
  useEffect(() => { key.current = newRequestKey(); }, [input]);

  if (agent.isLoading) return <Skeleton className="h-64 w-full" />;
  if (agent.isError || !agent.data) return <p role="alert" className="text-sm text-destructive">Agent unavailable. <button className="underline" onClick={() => void agent.refetch()}>Retry</button></p>;
  const a = agent.data;
  const ev = a.evaluation;

  const submit = async () => {
    setErr(null);
    try {
      await run.mutateAsync({ agentId, data: { input: input.trim(), requestKey: key.current } });
      setInput("");
      void qc.invalidateQueries({ queryKey: getListCreatedAgentRunsQueryKey(agentId) });
      void qc.invalidateQueries({ queryKey: getGetCreatedAgentQueryKey(agentId) });
    } catch (e) { setErr(apiErr(e)); }
  };

  return (
    <div className="space-y-4" data-testid={`panel-agent-${a.id}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl tracking-wider">{a.title}</h2>
        <AgentState state={a.state} />
        {a.kind && <span className="font-mono text-[10px] text-muted-foreground">{a.kind}</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { void agent.refetch(); void runs.refetch(); }} data-testid="button-refresh-agent"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </header>
      {a.error && <p className="rounded border border-destructive/40 p-2 text-xs text-destructive" data-testid="text-agent-error">{a.error}</p>}
      {ev && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="panel-evaluation">
          <div className="rounded border p-2"><div className={lab}>JCSE</div><div className="font-mono text-lg">{ev.jcse}</div></div>
          <div className="rounded border p-2"><div className={lab}>MATHMON</div><div className="font-mono text-lg">{ev.mathmon}</div></div>
          <div className="rounded border p-2"><div className={lab}>Eligible</div><div className="font-mono text-lg">{ev.eligible ? "YES" : "NO"}</div></div>
          <div className="rounded border p-2"><div className={lab}>Basis</div><div className="font-mono text-[11px]">{ev.basis.replace(/_/g, " ")}</div></div>
          {ev.blocks.length > 0 && <ul className="col-span-full list-disc pl-5 text-xs text-secondary">{ev.blocks.map((b) => <li key={b}>{b}</li>)}</ul>}
        </div>
      )}
      {a.cheatSheet && <details className="rounded border p-3"><summary className="cursor-pointer font-mono text-xs uppercase">Cheat sheet</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{a.cheatSheet}</pre></details>}
      <Disclosure />
      {a.state === "ACTIVE" ? (
        <div className="space-y-2">
          <Textarea rows={4} maxLength={8000} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text input for this agent" data-testid="input-agent-run" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">{input.length}/8000</span>
            <Button className="ml-auto" disabled={!input.trim() || run.isPending} onClick={submit} data-testid="button-run-agent">
              {run.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />} {err ? "Retry this run" : "Run"}
            </Button>
          </div>
          {err && <p role="alert" className="text-xs text-destructive" data-testid="text-run-error">Run failed: {err}. Saved attempt kept; retry reuses its request key.</p>}
        </div>
      ) : <p className="text-xs text-muted-foreground" data-testid="text-run-unavailable">Runs open only when the agent is ACTIVE. Current state: {a.state}.</p>}
      <section className="space-y-2">
        <h3 className={lab}>Run history</h3>
        {runs.isLoading ? <Skeleton className="h-16 w-full" /> : (runs.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground" data-testid="text-no-runs">No runs yet.</p> : (
          <ol className="space-y-2">
            {runs.data!.map((r) => (
              <li key={r.id} className="rounded border p-3 text-xs" data-testid={`row-run-${r.id}`}>
                <div className="flex gap-2 font-mono text-[10px] text-muted-foreground"><span>{r.state}</span><span className="ml-auto">{fmt(r.createdAt)}</span></div>
                <p className="mt-1 whitespace-pre-wrap text-foreground/80">{r.input}</p>
                {r.output && <p className="mt-2 whitespace-pre-wrap border-l-2 border-primary pl-2">{r.output}</p>}
                {r.disclosure && <p className="mt-1 text-[10px] text-muted-foreground">{r.disclosure}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
      {departure && (
        <div className="space-y-1 rounded border border-primary/40 p-3" data-testid="agent-stage-return">
          <p className="text-[11px] text-muted-foreground">Returns this agent to {departure.stageLabel} as a supporting artifact for your review. It is not approved or adopted automatically.</p>
          <StageSupportReturnAction departure={departure} resultId={a.id} compact blockedReason={a.state !== "ACTIVE" ? `Only an ACTIVE agent can be returned. Current state: ${a.state}.` : null} />
        </div>
      )}
      <section className="rounded border border-dashed p-3 text-xs space-y-1" data-testid="panel-next-steps">
        <h3 className={lab}>Qualified next steps</h3>
        {a.artifactId && <Link href={portalHref({ sourceId: a.artifactId, sessionId: a.sessionId })} className="flex items-center gap-1 text-primary underline" data-testid="link-agent-portal"><FileOutput className="h-3 w-3" /> Prepare a publication in IMPRIMA Portal</Link>}
        <Link href={`/session/${a.sessionId}`} className="block text-primary underline" data-testid="link-agent-session">Open the originating session</Link>
        <Link href="/f10" className="block text-primary underline" data-testid="link-agent-f10">F10 release review (separate process; nothing is activated by this agent)</Link>
      </section>
    </div>
  );
}

export default function AgentCreator() {
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const support = useStageSupportCase();
  const departure = support.departure?.tool === "agent-creator" ? support.departure : null;
  const sessionId = params.get("sessionId") ?? departure?.sessionId ?? "";
  const featureId = Number(params.get("featureId") ?? departure?.featureId ?? "");
  const selected = params.get("agentId") ?? "";
  const agents = useListCreatedAgents();
  const ctx = { sessionId, featureId: Number.isFinite(featureId) && featureId > 0 ? featureId : null, sourceId: params.get("sourceId") ?? departure?.sourceId ?? null };
  // Keep every incoming query param (including supportCaseId) when selecting an agent.
  const pick = (id: string) => { const next = new URLSearchParams(search); next.set("agentId", id); setLocation(`${location}?${next.toString()}`); };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav />
      <StageSupportBanner {...support} />
      {!support.caseId && sessionId && ctx.featureId && (
        <div className="border-b border-primary/30 bg-primary/5 px-4 py-2" data-testid="banner-agent-origin">
          <Link href={sessionStageHref(sessionId, ctx.featureId)} className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-primary" data-testid="link-return-stage"><ArrowLeft className="h-3 w-3" /> Back to {stageLabel(ctx.featureId)}</Link>
          <span className="ml-3 text-[11px] text-muted-foreground">Navigation only; this does not return an agent to the stage. Launch from the stage tools to get a return action.</span>
        </div>
      )}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <p className={lab}>Owned MA / SPC agents</p>
          <h1 className="font-display text-4xl tracking-wider">Agent Creator</h1>
        </header>
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <CreatePanel key={ctx.sourceId ?? ""} initialSource={ctx.sourceId ?? ""} sessionId={sessionId} onCreated={(a) => pick(a.id)} />
            <section className="space-y-2">
              <h2 className={lab}>Your agents</h2>
              {agents.isLoading ? <Skeleton className="h-24 w-full" /> : agents.isError ? (
                <p role="alert" className="text-xs text-destructive">Could not load agents. <button className="underline" onClick={() => void agents.refetch()}>Retry</button></p>
              ) : (agents.data ?? []).length === 0 ? <p className="rounded border border-dashed p-4 text-xs text-muted-foreground" data-testid="text-no-agents">No agents yet. Choose a source above.</p> : (
                <ul className="space-y-1">
                  {agents.data!.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => pick(a.id)} className={`flex w-full items-center gap-2 rounded border p-2 text-left text-xs hover:bg-muted/50 ${selected === a.id ? "border-primary" : ""}`} data-testid={`button-agent-${a.id}`}>
                        <span className="truncate">{a.title}</span><span className="ml-auto"><AgentState state={a.state} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div>{selected ? <AgentDetail key={selected} agentId={selected} departure={departure} /> : (
            <div className="space-y-3 rounded-lg border border-dashed p-8 text-sm text-muted-foreground"><Bot className="h-6 w-6" /><p>Select or create an agent to run it.</p><Disclosure /></div>
          )}</div>
        </div>
      </main>
    </div>
  );
}
