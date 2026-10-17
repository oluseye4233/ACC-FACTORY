import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useFieldArray, useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetXvlWorkspaceQueryKey,
  useGetXvlWorkspace,
  useRegisterXvlEvalset,
  useRunXvlVerification,
  XvlEvalsetInputStage,
  XvlRuleOperator,
  type XvlRun,
  type XvlRule,
} from "@workspace/api-client-react";
import { ArrowLeft, Download, Plus, RefreshCw, Trash2, ShieldAlert, FileCheck2, Lock } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { ShortSprintPreflightPanel } from "@/components/verification/ShortSprintPreflightPanel";
import { PublishDocumentLink, ShortSprintsLink } from "@/components/shared/PublishDocumentLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { JSON_TYPE_NAMES, describeRule, parseRuleDraft, runEligibility, type RuleDraft } from "@/lib/xvl";

type FormValues = { stage: XvlEvalsetInputStage; title: string; rules: RuleDraft[] };

const errMsg = (e: unknown) => {
  const status = (e as { status?: number } | null)?.status;
  const msg = e instanceof Error ? e.message : "Request failed";
  if (status === 409) return `${msg} (409: contract/artifact combination rejected by server; regenerate the artifact in the cockpit after registration)`;
  return msg;
};
const short = (h: string) => (h.length > 16 ? `${h.slice(0, 12)}…${h.slice(-4)}` : h);
const fmt = (s: string) => new Date(s).toLocaleString();

function OutcomeTag({ outcome }: { outcome: XvlRun["outcome"] }) {
  const cls =
    outcome === "PASS"
      ? "border-primary/50 text-primary bg-primary/10"
      : outcome === "FAIL"
        ? "border-destructive/50 text-destructive bg-destructive/10"
        : "border-secondary/50 text-secondary bg-secondary/10";
  return (
    <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${cls}`} data-testid={`status-outcome-${outcome}`}>
      {outcome === "PASS" ? "CONTRACT PASS" : outcome}
    </span>
  );
}

function SectionHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 border-b pb-2 mb-4">
      <span className="font-mono text-[10px] text-muted-foreground">{n}</span>
      <h2 className="text-2xl leading-none">{title}</h2>
      {note && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{note}</span>}
    </div>
  );
}

export default function SessionVerification() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const queryKey = getGetXvlWorkspaceQueryKey(sessionId);
  const ws = useGetXvlWorkspace(sessionId, { query: { queryKey, refetchInterval: 15000 } });
  const register = useRegisterXvlEvalset();
  const run = useRunXvlVerification();
  const data = ws.isError ? undefined : ws.data; // no stale green on query errors

  const [evalsetId, setEvalsetId] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: { stage: "F1", title: "", rules: [{ path: "/title", operator: "exists", expected: "" }] },
  });
  const rules = useFieldArray({ control: form.control, name: "rules" });

  const evalset = data?.evalsets.find((e) => e.id === evalsetId);
  const artifact = data?.artifacts.find((a) => a.id === artifactId);
  const elig = runEligibility(artifact, evalset);
  const evalsetById = useMemo(() => new Map((data?.evalsets ?? []).map((e) => [e.id, e])), [data]);
  const artifactById = useMemo(() => new Map((data?.artifacts ?? []).map((a) => [a.id, a])), [data]);

  const onRegister = (v: FormValues) => {
    setRegError(null);
    const parsed: XvlRule[] = [];
    let bad = false;
    v.rules.forEach((r, i) => {
      const res = parseRuleDraft(r);
      if ("error" in res) {
        bad = true;
        form.setError(`rules.${i}.expected`, { message: res.error });
      } else parsed.push(res.rule);
    });
    const title = v.title.trim();
    if (!title || title.length > 120) {
      form.setError("title", { message: "Title 1-120 characters" });
      bad = true;
    }
    if (bad) return;
    register.mutate(
      { sessionId, data: { stage: v.stage, title, rules: parsed } },
      {
        onSuccess: (e) => {
          qc.invalidateQueries({ queryKey });
          toast({ title: "Contract registered", description: `${e.stage} · ${short(e.contentHash)}` });
          form.reset({ stage: v.stage, title: "", rules: [{ path: "/title", operator: "exists", expected: "" }] });
          setEvalsetId(e.id);
        },
        onError: (e) => setRegError(errMsg(e)),
      },
    );
  };

  const onRun = () => {
    setRunError(null);
    run.mutate(
      { sessionId, data: { artifactId, evalsetId } },
      {
        onSuccess: (r) => {
          qc.invalidateQueries({ queryKey });
          setOpenRun(r.id);
          toast({ title: `Track E: ${r.outcome}`, description: "Advisory only. Stage and release gates unchanged." });
        },
        onError: (e) => setRunError(errMsg(e)),
      },
    );
  };

  const download = () => {
    if (!data) return;
    const payload = {
      kind: "partial-contract-evidence",
      disclaimer:
        "Owner-only advisory Track E deterministic JSON contract evidence. Not a PDD Evidence Pack, not FORGE certification, not stage conformance.",
      exportedAt: new Date().toISOString(),
      workspace: data,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `xvl-partial-evidence-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <header className="border-b bg-card px-4 py-3 grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Link href={`/session/${sessionId}`} className="text-muted-foreground hover:text-foreground" aria-label="Back to session" data-testid="link-back-session">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Verification workbench · Track E</div>
          <h1 className="text-3xl leading-none truncate" data-testid="text-session-name">
            {data?.session.name ?? (ws.isLoading ? "…" : "Session")}
          </h1>
        </div>
        <div className="col-span-2 md:col-span-1 flex flex-wrap justify-end items-center gap-2 min-w-0">
          {ws.isFetching && <span className="font-mono text-[10px] text-muted-foreground">syncing</span>}
          <Button variant="outline" size="sm" onClick={() => ws.refetch()} data-testid="button-refresh">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!data || ws.isError} data-testid="button-download-evidence">
            <Download className="h-3.5 w-3.5 mr-1" /> Partial evidence JSON
          </Button>
        </div>
      </header>

      <div className="border-b bg-secondary/10 px-4 py-2 font-mono text-[11px] text-foreground/80" data-testid="text-scope-banner">
        Advisory only. A PASS means the stated contract passed against a hash-bound artifact; floor selectors and other tracks remain
        pending. Verdicts are derived server-side by a no-LLM deterministic adapter at I2. Stage status and release gates do not change.
        {data && <> Scope: <b>{data.scope}</b>. Histories show latest {data.historyLimit} per category.</>}
      </div>

      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-7xl w-full mx-auto [overflow-wrap:anywhere]">
        {ws.isError ? (
          <div className="border border-destructive/40 bg-destructive/5 rounded p-6 flex flex-col items-start gap-3" data-testid="status-workspace-error">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <p className="font-mono text-sm">Workspace unavailable: {errMsg(ws.error)}. No verdicts are shown while the workspace cannot be read.</p>
            <Button size="sm" onClick={() => ws.refetch()} data-testid="button-retry">Retry</Button>
          </div>
        ) : ws.isLoading || !data ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : (
          <>
          <div className="mb-8 space-y-3"><div className="flex justify-end"><ShortSprintsLink sessionId={sessionId} /><PublishDocumentLink sessionId={sessionId} sourceId={sessionId} sourceKind="F95_LIVING_PDD" label="Publish F9.5 working snapshot" /></div><p className="font-mono text-[10px] text-muted-foreground text-right">F9.5 snapshot is a dated working copy of the living PDD; it is not sealed or certified.</p><ShortSprintPreflightPanel sessionId={sessionId} /></div>
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8">
            <div className="space-y-8 min-w-0">
              <section>
                <SectionHead n="01" title="Tracks" />
                <ul className="space-y-1.5">
                  {data.tracks.map((t) => (
                    <li key={t.id} className={`flex gap-3 border rounded px-3 py-2 ${t.available ? "border-primary/40" : "border-dashed opacity-80"}`} data-testid={`row-track-${t.id}`}>
                      <span className="font-mono text-xs font-bold w-6">{t.id}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{t.name} <span className="font-mono text-[10px] text-muted-foreground">{t.independence}</span></div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t.reason}</div>
                      </div>
                      <span className={`font-mono text-[10px] self-center ${t.available ? "text-primary" : "text-muted-foreground"}`}>
                        {t.available ? "AVAILABLE" : "UNAVAILABLE"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionHead n="02" title="Register contract" note="immutable once registered" />
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onRegister)} className="space-y-3">
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] sm:grid-cols-[110px_minmax(0,1fr)] gap-3">
                      <FormField control={form.control} name="stage" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-[10px] uppercase">Stage</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger data-testid="select-stage"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.values(XvlEvalsetInputStage).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-[10px] uppercase">Title</FormLabel>
                          <FormControl><Input maxLength={120} placeholder="F2 atomic prompt has title and steps" {...field} data-testid="input-title" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="space-y-2">
                      {rules.fields.map((f, i) => {
                        const op = form.watch(`rules.${i}.operator`);
                        return (
                          <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto] gap-2 items-start border-l-2 border-primary/40 pl-2">
                            <FormField control={form.control} name={`rules.${i}.path`} render={({ field }) => (
                              <FormItem><FormControl><Input className="font-mono text-xs" placeholder="/items/0 (empty = root)" {...field} data-testid={`input-rule-path-${i}`} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`rules.${i}.operator`} render={({ field }) => (
                              <FormItem>
                                <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue(`rules.${i}.expected`, v === "type" ? "string" : ""); form.clearErrors(`rules.${i}.expected`); }}>
                                  <FormControl><SelectTrigger className="font-mono text-xs" data-testid={`select-rule-operator-${i}`}><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{Object.values(XvlRuleOperator).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`rules.${i}.expected`} render={({ field }) => (
                              <FormItem>
                                {op === "exists" ? (
                                  <div className="h-9 flex items-center font-mono text-[10px] text-muted-foreground">no expected value</div>
                                ) : op === "type" ? (
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger className="font-mono text-xs" data-testid={`select-rule-type-${i}`}><SelectValue placeholder="type" /></SelectTrigger></FormControl>
                                    <SelectContent>{JSON_TYPE_NAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                  </Select>
                                ) : (
                                  <FormControl>
                                    <Input className="font-mono text-xs" placeholder={op === "equals" ? '"draft" | 3 | true | null' : "0"} {...field} data-testid={`input-rule-expected-${i}`} />
                                  </FormControl>
                                )}
                                <FormMessage className="text-[10px]" />
                              </FormItem>
                            )} />
                            <Button type="button" variant="ghost" size="icon" disabled={rules.fields.length <= 1} onClick={() => rules.remove(i)} aria-label="Remove rule" data-testid={`button-remove-rule-${i}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={rules.fields.length >= 100} onClick={() => rules.append({ path: "", operator: "exists", expected: "" })} data-testid="button-add-rule">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Rule
                      </Button>
                      <span className="font-mono text-[10px] text-muted-foreground">{rules.fields.length}/100</span>
                      <Button type="submit" size="sm" className="ml-auto" disabled={register.isPending} data-testid="button-register-contract">
                        <Lock className="h-3.5 w-3.5 mr-1" /> {register.isPending ? "Registering…" : "Register immutable contract"}
                      </Button>
                    </div>
                    {regError && <p className="font-mono text-xs text-destructive" data-testid="text-register-error">{regError}</p>}
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Only artifacts of this stage created after registration can be checked. Existing older artifacts must be regenerated in the cockpit.
                    </p>
                  </form>
                </Form>
              </section>

              <section>
                <SectionHead n="03" title="Contracts" note={`${data.evalsets.length}`} />
                {data.evalsets.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-4">No contracts registered. Write one above before regenerating the stage.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.evalsets.map((e) => (
                      <li key={e.id} className="border rounded p-3" data-testid={`card-evalset-${e.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-muted rounded">{e.stage}</span>
                          <span className="text-sm font-medium truncate">{e.title}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fmt(e.registeredAt)}</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-1">hash {short(e.contentHash)}</div>
                        <ol className="mt-1 font-mono text-[11px] list-decimal pl-5">
                          {e.rules.map((r, i) => <li key={i}>{describeRule(r)}</li>)}
                        </ol>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="space-y-8 min-w-0">
              <section>
                <SectionHead n="04" title="Run check" />
                <div className="border rounded p-4 space-y-3 bg-card">
                  <Select value={evalsetId} onValueChange={(v) => { setEvalsetId(v); setRunError(null); }}>
                    <SelectTrigger data-testid="select-run-evalset"><SelectValue placeholder="Contract" /></SelectTrigger>
                    <SelectContent>
                      {data.evalsets.map((e) => <SelectItem key={e.id} value={e.id}>{e.stage} · {e.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={artifactId} onValueChange={(v) => { setArtifactId(v); setRunError(null); }}>
                    <SelectTrigger data-testid="select-run-artifact"><SelectValue placeholder="Artifact" /></SelectTrigger>
                    <SelectContent>
                      {data.artifacts.map((a) => {
                        const ok = runEligibility(a, evalset).ok;
                        return (
                          <SelectItem key={a.id} value={a.id} disabled={!!evalset && !ok}>
                            {a.stage} · {a.name ?? a.id.slice(0, 8)} · {fmt(a.createdAt)}{evalset && !ok ? " (ineligible)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {data.artifacts.length === 0 && <p className="font-mono text-[11px] text-muted-foreground">No artifacts yet. Generate one in the cockpit.</p>}
                  {!elig.ok && (evalsetId || artifactId) && (
                    <p className="font-mono text-[11px] text-secondary" data-testid="text-run-ineligible">{elig.reason}</p>
                  )}
                  <Button onClick={onRun} disabled={!elig.ok || run.isPending} className="w-full" data-testid="button-run-check">
                    <FileCheck2 className="h-4 w-4 mr-1" /> {run.isPending ? "Running deterministic checks…" : "Run Track E check"}
                  </Button>
                  {runError && <p className="font-mono text-xs text-destructive" data-testid="text-run-error">{runError}</p>}
                </div>
              </section>

              <section>
                <SectionHead n="05" title="Evidence" note={`${data.runs.length} runs`} />
                {data.runs.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-4">No runs recorded. Nothing has been tested yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.runs.map((r) => {
                      const es = evalsetById.get(r.evalsetId);
                      const art = artifactById.get(r.artifactId);
                      const open = openRun === r.id;
                      return (
                        <li key={r.id} className="border rounded" data-testid={`card-run-${r.id}`}>
                          <button type="button" className="w-full text-left px-3 py-2 flex flex-wrap items-center gap-2" onClick={() => setOpenRun(open ? null : r.id)} data-testid={`button-toggle-run-${r.id}`}>
                            <OutcomeTag outcome={r.outcome} />
                            <span className="font-mono text-[10px] bg-muted px-1.5 rounded">{r.stage}</span>
                            <span className="text-sm truncate">{es?.title ?? r.evalsetId.slice(0, 8)}</span>
                            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fmt(r.createdAt)}</span>
                          </button>
                          {open && (
                            <div className="border-t px-3 py-2 space-y-2 font-mono text-[11px]">
                              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                                <span>track {r.track} · {r.independence}</span>
                                <span>adapter {r.adapterId}@{r.adapterVersion}</span>
                                <span>artifact {art?.name ?? r.artifactId.slice(0, 8)} {short(r.artifactHash)}</span>
                                <span>contract {short(r.evalsetHash)}</span>
                                <span>evidence {short(r.evidenceHash)}</span>
                                <span>model calls {r.evidence.modelCalls}</span>
                              </div>
                              <p>{r.evidence.reason}</p>
                              <ol className="space-y-0.5">
                                {r.evidence.results.map((res) => (
                                  <li key={res.index} className="flex gap-2">
                                    <span className={res.passed ? "text-primary" : "text-destructive"}>{res.passed ? "pass" : "fail"}</span>
                                    <span>#{res.index + 1} {es?.rules[res.index] ? describeRule(es.rules[res.index]) : ""}</span>
                                  </li>
                                ))}
                              </ol>
                              <details>
                                <summary className="cursor-pointer text-[10px] uppercase">Raw evidence</summary>
                                <pre className="mt-1 max-h-64 overflow-auto bg-muted/40 p-2 rounded text-[10px]">{JSON.stringify(r.evidence, null, 2)}</pre>
                              </details>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <SectionHead n="06" title="Failure cases" note="metadata only" />
                <p className="font-mono text-[10px] text-muted-foreground mb-2">
                  Opened automatically on FAIL or INCONCLUSIVE. Cases cannot be closed or repaired here; no repair approval, export or corpus consent is implied.
                </p>
                {data.failureCases.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-4">No failure cases open.</p>
                ) : (
                  <ul className="divide-y border rounded">
                    {data.failureCases.map((f) => (
                      <li key={f.id} className="px-3 py-2 flex flex-wrap gap-2 items-center font-mono text-[11px]" data-testid={`row-failure-${f.id}`}>
                        <span className="text-destructive font-bold">{f.state}</span>
                        <span className="bg-muted px-1.5 rounded">{f.stage}</span>
                        <button type="button" className="underline" onClick={() => setOpenRun(f.runId)} data-testid={`button-failure-run-${f.id}`}>run {f.runId.slice(0, 8)}</button>
                        <span className="text-muted-foreground">rejected output: {f.rejectedOutputOrigin}</span>
                        <span className="ml-auto text-muted-foreground">{fmt(f.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
          </>
        )}
      </main>
    </div>
  );
}
