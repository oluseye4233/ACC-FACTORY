import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetArtifactOperationsQueryKey,
  getGetArtifactPreparationsQueryKey,
  useGetArtifactPreparations,
  useGetArtifactOperations,
  useRunArtifactOperation,
  type ArtifactOperationWorkflow,
  type ArtifactOperationsWorkspace,
} from "@workspace/api-client-react";
import { AlertTriangle, Download, FileOutput, RefreshCw, Rocket, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { GuardStatus, PreparationLane } from "@/components/operations/PreparationLane";
import { operationsHref } from "@/components/shared/PublishDocumentLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MANIFEST_FIELDS,
  MANIFEST_SAMPLE,
  downloadFrom,
  errMessage,
  filenamePreview,
  imprimaView,
  isActiveState,
  isRec,
  overridePolicy,
  parseKind,
  rec,
  ssView,
  str,
  strArr,
  type OpsKind,
} from "@/lib/artifact-ops";

type RunFn = (action: string, opts: Record<string, unknown>, extra?: { wf?: ArtifactOperationWorkflow; sourceId?: string; sourceKind?: string; sessionId?: string }) => Promise<boolean>;

const short = (h: string | null | undefined) => (!h ? "—" : h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h);
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : "—");
const PAGE = 50;
const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const sel = "h-9 w-full rounded-md border bg-background px-2 font-mono text-xs";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={lab}>{label}</span>
      {children}
    </label>
  );
}

function Choice({ label, value, options, onChange, testId }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; testId: string }) {
  return (
    <Field label={label}>
      <select className={sel} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function StateTag({ state }: { state: string }) {
  const s = state.toUpperCase();
  const tone = isActiveState(s)
    ? "border-secondary/60 text-secondary bg-secondary/10 animate-pulse"
    : /FAIL|REJECT|CANCEL|WITHDRAW|ERROR|NO\b/.test(s)
      ? "border-destructive/50 text-destructive bg-destructive/10"
      : /PUBLISH|APPROV|SEAL|RELEAS|PROMOT/.test(s)
        ? "border-primary/50 text-primary bg-primary/10"
        : "border-border text-foreground/80 bg-muted/40";
  return <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${tone}`} data-testid={`status-state-${s}`}>{s}</span>;
}

function Report({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="border rounded p-3 bg-card min-w-0">
      <div className="flex items-baseline gap-2 border-b pb-1 mb-2">
        <h4 className="text-lg leading-none">{title}</h4>
        {note && <span className={`${lab} ml-auto`}>{note}</span>}
      </div>
      <div className="font-mono text-[11px] space-y-1">{children}</div>
    </section>
  );
}

function NotRun() {
  return <span className="text-muted-foreground border border-dashed px-1.5 rounded">NOT RUN</span>;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">not recorded</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  return <pre className="max-h-56 overflow-auto bg-muted/40 p-2 rounded text-[10px] whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
}

/* ---------------- IMPRIMA ---------------- */

const FORMATS = ["DOCX", "PDF", "HTML"] as const;

function ImprimaCreate({ ws, run, pending, initial }: { ws: ArtifactOperationsWorkspace; run: RunFn; pending: boolean; initial: { sourceId: string; sourceKind: string } }) {
  const [sourceId, setSourceId] = useState(initial.sourceId);
  const [formats, setFormats] = useState<string[]>(["DOCX", "PDF"]);
  const [audience, setAudience] = useState("TECHNICAL");
  const [mode, setMode] = useState("DRAFT");
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [author, setAuthor] = useState("");
  const [confidentiality, setConf] = useState("INTERNAL");
  const [provider, setProvider] = useState("claude");
  const [riskDomain, setRisk] = useState("GENERAL");
  const [changeNote, setChangeNote] = useState("");
  const source = ws.sources.find((s) => s.id === sourceId);
  const sourceKind = source?.kind ?? (sourceId === initial.sourceId ? initial.sourceKind : "");
  const ok = !!sourceId && !!sourceKind && formats.length > 0 && title.trim() && author.trim();

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        await run("CREATE", {
          formats, audience, mode, title: title.trim(), project: project.trim(), author: author.trim(), authorIsHuman: true,
          timezone: "America/Chicago", confidentiality, provider, riskDomain, changeNote: changeNote.trim(),
        }, { sourceId, sourceKind, sessionId: source?.sessionId ?? undefined });
      }}
    >
      <Field label="Source artifact">
        <select className={sel} value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="select-imprima-source">
          <option value="">Select a saved F3/F4/F5/F6/F7 or SPC/F0 output</option>
          {ws.sources.map((s) => <option key={s.id} value={s.id}>{s.kind} · {s.label}</option>)}
          {initial.sourceId && !ws.sources.some((s) => s.id === initial.sourceId) && (
            <option value={initial.sourceId}>{initial.sourceKind || "linked"} · {initial.sourceId.slice(0, 8)} (not in your source list)</option>
          )}
        </select>
      </Field>
      {sourceKind === "F95_LIVING_PDD" && <p className="font-mono text-[10px] text-secondary" data-testid="text-f95-note">F9.5 session snapshot: a dated working snapshot of the living PDD. Not sealed, not certified.</p>}
      {sourceId && !source && <p className="font-mono text-[10px] text-secondary">Linked source is not listed by the server; it may be rejected as out of scope.</p>}
      <fieldset>
        <legend className={lab}>Formats</legend>
        <div className="flex gap-3 mt-1">
          {FORMATS.map((f) => (
            <label key={f} className="flex items-center gap-1.5 font-mono text-xs">
              <input type="checkbox" checked={formats.includes(f)} onChange={(e) => setFormats(e.target.checked ? [...formats, f] : formats.filter((x) => x !== f))} data-testid={`check-format-${f}`} /> {f}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Choice label="Audience" value={audience} options={["EXECUTIVE", "TECHNICAL", "CLIENT", "PUBLIC"]} onChange={setAudience} testId="select-audience" />
        <Choice label="Mode" value={mode} options={["DRAFT", "FINAL"]} onChange={setMode} testId="select-mode" />
        <Choice label="Confidentiality" value={confidentiality} options={["PUBLIC", "INTERNAL", "CONFIDENTIAL"]} onChange={setConf} testId="select-confidentiality" />
        <Choice label="Risk domain" value={riskDomain} options={["GENERAL", "LEGAL", "FINANCIAL", "HEALTH"]} onChange={setRisk} testId="select-risk" />
        <Choice label="Provider" value={provider} options={["claude", "openai", "gemini"]} onChange={setProvider} testId="select-provider" />
        <Field label="Timezone"><Input value="America/Chicago" readOnly className="font-mono text-xs" /></Field>
      </div>
      <Field label="Title"><Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="input-doc-title" /></Field>
      <Field label="Project"><Input value={project} maxLength={120} onChange={(e) => setProject(e.target.value)} data-testid="input-doc-project" /></Field>
      <Field label="Author (human)"><Input value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} data-testid="input-doc-author" /></Field>
      <Field label="Change note"><Textarea rows={2} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} data-testid="input-change-note" /></Field>
      <div className="border-l-2 border-secondary pl-2">
        <div className={lab}>Filename preview</div>
        <div className="font-mono text-xs break-all" data-testid="text-filename-preview">{filenamePreview({ project, title, audience, mode })}.{(formats[0] ?? "docx").toLowerCase()}</div>
      </div>
      <Button type="submit" className="w-full" disabled={!ok || pending} data-testid="button-imprima-create">
        <FileOutput className="h-4 w-4 mr-1" /> {pending ? "Submitting…" : "Queue document"}
      </Button>
    </form>
  );
}

function ImprimaDetail({ wf, run, pending }: { wf: ArtifactOperationWorkflow; run: RunFn; pending: boolean }) {
  const v = imprimaView(wf.result);
  const pol = overridePolicy(v);
  const allowed = new Set(wf.allowedActions);
  const approved = !!v.approval?.at;
  const [checks, setChecks] = useState({ confirmHuman: false, accessibilityReviewed: false, layoutReviewed: false });
  const [overrideReason, setOverride] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const handoff = [...wf.events].reverse().find((e) => e.action === "HANDOFF");
  const canApprove = checks.confirmHuman && checks.accessibilityReviewed && checks.layoutReviewed && !!v.contentHash && (!pol.needed || (pol.allowed && overrideReason.trim().length >= 10));

  return (
    <div className="space-y-4">
      {v.error && <p className="border border-destructive/40 bg-destructive/5 rounded p-2 font-mono text-xs text-destructive" data-testid="text-job-error">Job error: {v.error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <Report title="Clarity" note={v.clarity?.method ?? "method unrecorded"}>
          <div>clarity: {v.clarity?.score ?? <NotRun />}</div>
          <div>truthfulness: {v.clarity?.truthfulness ?? <NotRun />}</div>
          <div>detectability: {v.clarity?.detectability ?? <NotRun />}</div>
        </Report>
        <Report title="Review" note={v.review?.verdict ?? "pending"}>
          {v.review ? (
            <>
              <div>verdict: <b>{v.review.verdict ?? "—"}</b></div>
              <div>flags: {v.review.flags.length ? v.review.flags.join(", ") : "none"}</div>
              {v.review.rationale && <p className="text-muted-foreground">{v.review.rationale}</p>}
            </>
          ) : <NotRun />}
        </Report>
        <Report title="Design" note={v.design?.scope ?? undefined}>
          {v.design ? (
            <>
              <div>score: {v.design.score ?? <NotRun />}</div>
              {Object.entries(v.design.dimensions).map(([k, val]) => <div key={k}>{k}: {typeof val === "object" ? JSON.stringify(val) : String(val)}</div>)}
            </>
          ) : <NotRun />}
        </Report>
        <Report title="Changes" note={`${v.changes.length}`}>
          {v.changes.length ? <ul className="list-disc pl-4">{v.changes.map((c, i) => <li key={i}>{c}</li>)}</ul> : <span className="text-muted-foreground">none recorded</span>}
        </Report>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground flex flex-wrap gap-x-4">
        <span>content {short(v.contentHash)}</span>
        <span>GRO {v.groState ?? "—"}</span>
        <span>approval {approved ? `${v.approval?.name ?? v.approval?.actorId} · ${fmt(v.approval?.at)}` : "none"}</span>
      </div>

      <Report title="Files" note={approved ? "approved" : "review copies"}>
        {wf.files.length === 0 ? <span className="text-muted-foreground">No files rendered yet.</span> : (
          <ul className="divide-y">
            {wf.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-1.5" data-testid={`row-file-${f.id}`}>
                <span className="bg-muted px-1.5 rounded">{f.format}</span>
                <span className="truncate">{f.filename}</span>
                {!approved && <span className="text-secondary border border-secondary/50 px-1 rounded">REVIEW · not approved</span>}
                <span className="text-muted-foreground">{f.variant} · {(f.size / 1024).toFixed(1)} KB · {short(f.fileHash)}</span>
                <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => downloadFrom(f.downloadPath, f.filename).then(() => setDlErr(null), (e) => setDlErr(errMessage(e).message))} data-testid={`button-download-${f.id}`}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              </li>
            ))}
          </ul>
        )}
        {dlErr && <p className="text-destructive">{dlErr}</p>}
        <p className="text-muted-foreground">Files are private to your account.</p>
      </Report>

      {allowed.has("APPROVE") && (
        <Report title="Approve" note={`binds ${short(v.contentHash)}`}>
          {(["confirmHuman", "accessibilityReviewed", "layoutReviewed"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} data-testid={`check-${k}`} />
              {k === "confirmHuman" ? "I am a human approver and read this version" : k === "accessibilityReviewed" ? "Accessibility reviewed" : "Layout reviewed"}
            </label>
          ))}
          {pol.needed && (
            <div className="border border-secondary/50 rounded p-2 space-y-1">
              <p className="text-secondary">{pol.reason}</p>
              {pol.allowed && <Textarea rows={2} placeholder="Explicit override reason (min 10 chars)" value={overrideReason} onChange={(e) => setOverride(e.target.value)} data-testid="input-override-reason" />}
            </div>
          )}
          <Button size="sm" disabled={!canApprove || pending} onClick={() => run("APPROVE", { expectedContentHash: v.contentHash, confirmHuman: true, accessibilityReviewed: true, layoutReviewed: true, ...(pol.needed && pol.allowed ? { overrideReason: overrideReason.trim() } : {}) }, { wf })} data-testid="button-approve">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Approve this version
          </Button>
        </Report>
      )}

      {allowed.has("HANDOFF") && (
        <Report title="Handoff" note="published final only">
          <Input placeholder="https://receiver.example/intake" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} data-testid="input-handoff-url" />
          <label className="flex items-center gap-2"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="check-handoff-consent" /> I consent to send this published document to that URL</label>
          <Button size="sm" disabled={!consent || !/^https:\/\//.test(targetUrl) || pending} onClick={() => run("HANDOFF", { targetUrl, consent: true }, { wf })} data-testid="button-handoff">Send handoff</Button>
          <p className="text-muted-foreground">Records the receiver response only. It does not deploy or publish anything downstream.</p>
        </Report>
      )}
      {handoff && <Report title="Handoff receipt" note={fmt(handoff.createdAt)}><JsonBlock value={handoff.data} /></Report>}

      <div className="flex flex-wrap gap-2">
        {allowed.has("RETRY") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("RETRY", {}, { wf })} data-testid="button-retry-job">Retry as new version</Button>}
        {allowed.has("CANCEL") && <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={() => run("CANCEL", {}, { wf })} data-testid="button-cancel-job">Cancel</Button>}
      </div>
    </div>
  );
}

/* ---------------- SHORT SPRINTS ---------------- */

function ManifestEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const [raw, setRaw] = useState(false);
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const listField = (k: string) => k === "tools" || k === "constraints" || k === "evalsetHashes";
  const badHashes = strArr(value.evalsetHashes).filter((h) => !/^[0-9a-f]{64}$/.test(h));
  const jsonField = (k: string) => k === "inputContract" || k === "outputContract";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={lab}>Agent package manifest (proposal, not verified)</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto h-7" onClick={() => { setText(JSON.stringify(MANIFEST_SAMPLE, null, 2)); onChange({ ...MANIFEST_SAMPLE }); }} data-testid="button-load-sample">Load sample</Button>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => { setRaw(!raw); setText(JSON.stringify(value, null, 2)); setErr(null); }} data-testid="button-toggle-json">{raw ? "Guided form" : "JSON"}</Button>
      </div>
      {badHashes.length > 0 && <p className="font-mono text-[10px] text-destructive" data-testid="text-bad-hashes">evalsetHashes must be 64-char lowercase hex: {badHashes.join(", ")}</p>}
      <p className="font-mono text-[10px] text-muted-foreground">evalsetHashes: existing preregistered source-specific contract hashes. Required for SC_TWO SASS provenance at the pack gate.</p>
      {raw ? (
        <>
          <Textarea rows={12} className="font-mono text-[11px]" value={text} onChange={(e) => {
            setText(e.target.value);
            try { const p: unknown = JSON.parse(e.target.value); if (!isRec(p)) throw new Error("Manifest must be an object"); onChange(p); setErr(null); } catch (x) { setErr(x instanceof Error ? x.message : "Invalid JSON"); }
          }} data-testid="input-manifest-json" />
          {err && <p className="font-mono text-[10px] text-destructive">{err}</p>}
        </>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-auto pr-1">
          {MANIFEST_FIELDS.map((k) => {
            const cur = value[k];
            const display = listField(k) ? strArr(cur).join("\n") : jsonField(k) ? (cur === undefined ? "" : typeof cur === "string" ? cur : JSON.stringify(cur)) : typeof cur === "string" ? cur : "";
            const long = ["systemPrompt", "mission", "inputContract", "outputContract", "tools", "constraints", "groRules", "failClosedRules", "promotionNotes", "evalsetHashes"].includes(k);
            return (
              <Field key={k} label={listField(k) ? `${k} (one per line)` : k}>
                {long ? (
                  <Textarea rows={2} className="font-mono text-[11px]" value={display} onChange={(e) => {
                    const t = e.target.value;
                    let next: unknown = t;
                    if (listField(k)) next = t.split("\n").map((s) => s.trim()).filter(Boolean);
                    else if (jsonField(k)) { try { next = JSON.parse(t); } catch { next = t; } }
                    onChange({ ...value, [k]: next });
                  }} data-testid={`input-manifest-${k}`} />
                ) : (
                  <Input className="font-mono text-xs" value={display} onChange={(e) => onChange({ ...value, [k]: e.target.value })} data-testid={`input-manifest-${k}`} />
                )}
              </Field>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShortSprintCreate({ ws, run, pending, sessionId, initialSource }: { ws: ArtifactOperationsWorkspace; run: RunFn; pending: boolean; sessionId: string; initialSource: string }) {
  const [sid, setSid] = useState(sessionId);
  const [sourceId, setSourceId] = useState(initialSource);
  const [circuit, setCircuit] = useState("SC_ONE");
  const [target, setTarget] = useState("SOFTWARE");
  const [profile, setProfile] = useState("STANDARD");
  const [hostTarget, setHost] = useState("");
  const [manifest, setManifest] = useState<Record<string, unknown>>({});
  const sources = ws.sources.filter((s) => !sid || s.sessionId === sid);
  const source = ws.sources.find((s) => s.id === sourceId);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!sid) return;
      await run("CREATE", { circuit, target, profile, hostTarget: hostTarget.trim(), manifest }, { sessionId: sid, sourceId: sourceId || undefined, sourceKind: source?.kind });
    }}>
      <Field label="Session ID (required)"><Input className="font-mono text-xs" value={sid} onChange={(e) => setSid(e.target.value.trim())} data-testid="input-ss-session" /></Field>
      <Field label="Source (optional, defaults to latest F4/F5)">
        <select className={sel} value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="select-ss-source">
          <option value="">Latest F4/F5 for session</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.kind} · {s.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Choice label="Circuit" value={circuit} options={["SC_ONE", "SC_TWO"]} onChange={setCircuit} testId="select-circuit" />
        <Choice label="Target" value={target} options={["SOFTWARE", "FIRMWARE"]} onChange={setTarget} testId="select-target" />
        <Choice label="Profile" value={profile} options={["PROTOTYPE_LIGHT", "STANDARD", "REGULATED"]} onChange={setProfile} testId="select-profile" />
      </div>
      {target === "FIRMWARE" && <p className="font-mono text-[10px] text-secondary">FIRMWARE may be routed to the full route while the MECHA short-route decision is unresolved.</p>}
      <Field label="Host target"><Input className="font-mono text-xs" value={hostTarget} onChange={(e) => setHost(e.target.value)} data-testid="input-host-target" /></Field>
      <ManifestEditor value={manifest} onChange={setManifest} />
      {circuit === "SC_TWO" && strArr(manifest.evalsetHashes).length === 0 && <p className="font-mono text-[10px] text-secondary">SC_TWO: the pack gate will require manifest evalsetHashes for SASS provenance.</p>}
      <Button type="submit" className="w-full" disabled={!sid || pending || strArr(manifest.evalsetHashes).some((h) => !/^[0-9a-f]{64}$/.test(h))} data-testid="button-ss-create"><Rocket className="h-4 w-4 mr-1" /> {pending ? "Submitting…" : "Open sprint"}</Button>
    </form>
  );
}

const GATE_ACTIONS = ["YES", "NO", "DEFER", "WITHDRAW"] as const;

function ShortSprintDetail({ wf, run, pending }: { wf: ArtifactOperationWorkflow; run: RunFn; pending: boolean }) {
  const v = ssView(wf.result);
  const allowed = new Set(wf.allowedActions);
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState("");
  const [rErr, setRErr] = useState<string | null>(null);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const reasonOk = reason.trim().length >= 3;
  const importEvidence = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(receipt); } catch { setRErr("Receipt is not valid JSON"); return; }
    if (!isRec(parsed)) { setRErr("Receipt must be a signed JSON object"); return; }
    setRErr(null);
    if (await run("IMPORT_EVIDENCE", { receipt: parsed }, { wf })) setReceipt("");
  };
  return (
    <div className="space-y-4">
      <div className={`border rounded p-3 ${v.missing.length ? "border-secondary/60 bg-secondary/5" : "border-primary/40"}`} data-testid="panel-missing">
        <div className={lab}>Missing requirements</div>
        {v.missing.length ? <ul className="font-mono text-[11px] list-disc pl-4 mt-1">{v.missing.map((m, i) => <li key={i}>{m}</li>)}</ul> : <p className="font-mono text-[11px] mt-1">None reported by server.</p>}
      </div>
      {v.tracks.length > 0 && (
        <Report title="Evidence per track" note="external evidence only">
          <ul className="divide-y">
            {v.tracks.map((t, i) => (
              <li key={i} className="py-1 flex flex-wrap gap-2">
                <b>{str(t.id) ?? str(t.track) ?? `#${i + 1}`}</b>
                <span>{str(t.status) ?? "UNKNOWN"}</span>
                <span className="text-muted-foreground">{str(t.reason) ?? ""}</span>
              </li>
            ))}
          </ul>
        </Report>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {v.sections.map((s) => <Report key={s.key} title={s.key}><JsonBlock value={s.value} /></Report>)}
      </div>
      {(() => {
        const rel = rec(rec(wf.result).release);
        const sealed = str(rel.sealedManifestHash) ?? str(rec(wf.result).sealedManifestHash);
        const packHash = str(rec(rec(wf.result).pack).packHash) ?? str(rel.packHash);
        return (sealed || packHash) ? (
          <Report title="Receipt binding" note="downstream receipts">
            <div>sealedManifestHash {sealed ?? "not sealed"}</div>
            <div>packHash {packHash ?? "no pack"}</div>
            <p className="text-muted-foreground">Downstream F95 / P / F10 / F11 / F12 receipts must bind both hashes. F11 receipts require a HUMAN-mechanism authority. F12 advances 5 to 25 to 100 percent as separate actions, each backed by a real reported health window; this UI does not change traffic. Any LIVE status is provider-reported.</p>
          </Report>
        ) : null;
      })()}
      {wf.files.length > 0 && (
        <Report title="Release package files" note="exact text · SHA-256">
          <ul className="divide-y">
            {wf.files.map((f) => (
              <li key={f.id} className="py-1.5 flex flex-wrap items-center gap-2" data-testid={`row-ss-file-${f.id}`}>
                <span className="bg-muted px-1.5 rounded">{f.format}</span>
                <span className="truncate">{f.filename}</span>
                <span className="text-muted-foreground break-all">sha256 {f.fileHash}</span>
                <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => downloadFrom(f.downloadPath, f.filename).then(() => setDlErr(null), (e) => setDlErr(errMessage(e).message))} data-testid={`button-ss-download-${f.id}`}><Download className="h-3 w-3 mr-1" /> Download</Button>
              </li>
            ))}
          </ul>
        </Report>
      )}
      <Report title="Manifest proposal" note="not a verification fact"><JsonBlock value={rec(wf.config).manifest} /></Report>

      {allowed.has("IMPORT_EVIDENCE") && (
        <Report title="Import signed evidence" note={`bound to source ${short(wf.sourceHash)}`}>
          <label className="inline-flex items-center gap-1.5 cursor-pointer underline">
            <Upload className="h-3 w-3" /> Load JSON file
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReceipt(await f.text()); e.target.value = ""; }} data-testid="input-receipt-file" />
          </label>
          <Textarea rows={6} className="font-mono text-[10px]" placeholder='{"payload": {...}, "signature": "...", "authorityId": "..."}' value={receipt} onChange={(e) => setReceipt(e.target.value)} data-testid="input-receipt" />
          {rErr && <p className="text-destructive">{rErr}</p>}
          <Button size="sm" disabled={!receipt.trim() || pending} onClick={importEvidence} data-testid="button-import-evidence">Import receipt</Button>
        </Report>
      )}

      {(GATE_ACTIONS.some((a) => allowed.has(a)) || allowed.has("PROMOTE")) && (
        <Report title="Decision" note="reason required">
          <Textarea rows={2} placeholder="Reason recorded with the decision" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-gate-reason" />
          <div className="flex flex-wrap gap-2">
            {[...GATE_ACTIONS, "PROMOTE"].filter((a) => allowed.has(a)).map((a) => (
              <Button key={a} size="sm" variant={a === "YES" || a === "PROMOTE" ? "default" : "outline"} disabled={!reasonOk || pending} onClick={async () => { if (await run(a, { reason: reason.trim() }, { wf })) setReason(""); }} data-testid={`button-gate-${a}`}>{a}</Button>
            ))}
          </div>
        </Report>
      )}

      <div className="flex flex-wrap gap-2 items-start">
        {allowed.has("RUN_PACK") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("RUN_PACK", {}, { wf })} data-testid="button-run-pack">Validate signed receipts (pack)</Button>}
        {allowed.has("SEAL") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("SEAL", {}, { wf })} data-testid="button-seal">Seal (requires custody evidence)</Button>}
        {allowed.has("RELEASE") && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("RELEASE", {}, { wf })} data-testid="button-release">Record release receipts</Button>}
        {allowed.has("CANCEL") && <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={() => run("CANCEL", {}, { wf })} data-testid="button-ss-cancel">Cancel</Button>}
        {allowed.has("EXPORT") && (
          <Button size="sm" variant="outline" onClick={() => downloadFrom(`/api/artifact-operations/short-sprints/${encodeURIComponent(wf.id)}/export`, `short-sprint-release-package-${wf.id.slice(0, 8)}.json`).then(() => setDlErr(null), (e) => setDlErr(errMessage(e).message))} data-testid="button-ss-export">
            <Download className="h-3.5 w-3.5 mr-1" /> Export release package (JSON)
          </Button>
        )}
      </div>
      {dlErr && <p className="font-mono text-xs text-destructive">{dlErr}</p>}
      <p className="font-mono text-[10px] text-muted-foreground">
        Pack validates approved, signed external receipts from registered authorities; it does not run BUGMXT or MECHA and no tests run in this browser. Release records verified downstream receipts and does not change traffic. Nothing here certifies or activates an agent.
      </p>
    </div>
  );
}

const SCOPES = ["SOURCE_CERTIFICATION", "E", "R", "J", "S", "C", "H", "P", "F9", "F95", "F10", "F11", "F12"] as const;
const MECH_NOTE: Record<string, string> = {
  DETERMINISTIC: "I2 · deterministic checker",
  CROSS_MODEL: "I1 · must be a different model family",
  HUMAN: "I3 · approved independent reviewer",
};

function Authorities({ ws, run, pending }: { ws: ArtifactOperationsWorkspace; run: RunFn; pending: boolean }) {
  const [name, setName] = useState("");
  const [publicKey, setKey] = useState("");
  const [mechanism, setMech] = useState("DETERMINISTIC");
  const [scopes, setScopes] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const pemOk = /-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----/.test(publicKey);
  return (
    <section className="space-y-3" data-testid="panel-authorities">
      <h3 className="text-xl leading-none">Verifier authorities</h3>
      {ws.verifiers.length === 0 ? <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-3">No authorities registered. Evidence cannot be accepted until an admin registers one.</p> : (
        <ul className="divide-y border rounded font-mono text-[11px]">
          {ws.verifiers.map((raw, i) => {
            const a = rec(raw);
            const id = str(a.id) ?? `v${i}`;
            const revoked = !!str(a.revokedAt) || str(a.status) === "REVOKED";
            return (
              <li key={id} className="px-3 py-2 flex flex-wrap items-center gap-2" data-testid={`row-authority-${id}`}>
                <span className={revoked ? "text-destructive font-bold" : "text-primary font-bold"}>{revoked ? "REVOKED" : "ACTIVE"}</span>
                <span>{str(a.name) ?? id}</span>
                <span className="text-muted-foreground">{str(a.mechanism) ?? ""} · {strArr(a.scopes).join(", ")}</span>
                {ws.mayRegisterVerifier && !revoked && (
                  <Button size="sm" variant="ghost" className="ml-auto h-7 text-destructive" disabled={pending} onClick={() => run("REVOKE_VERIFIER", { authorityId: id })} data-testid={`button-revoke-${id}`}>Revoke</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <details className="border rounded p-3 font-mono text-[11px]" data-testid="guide-h-approvals">
        <summary className={`${lab} cursor-pointer`}>Guide: auxiliary H approvals</summary>
        <ul className="list-disc pl-4 mt-2 space-y-1">
          <li><b>SPHINX_PROMOTION_APPROVED</b> + current packHash routes an auxiliary H_PROMOTION receipt.</li>
          <li><b>VTE_RESOLUTION_APPROVED</b> + caseId + current passing packHash closes the actual VTE failure case.</li>
          <li>These auxiliary H receipts do not replace ordinary regulated Track H evidence.</li>
          <li>F11 receipts require a HUMAN-mechanism authority. Receipts are imported as signed JSON.</li>
          <li>Protocol: docs/upgrade-program/short-sprints-verifier-protocol.md</li>
        </ul>
      </details>
      {ws.mayRegisterVerifier && (
        <form className="border rounded p-3 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run("REGISTER_VERIFIER", { name: name.trim(), publicKey: publicKey.trim(), mechanism, scopes, governanceNote: note.trim() });
          if (ok) { setName(""); setKey(""); setScopes([]); setNote(""); }
        }}>
          <div className={lab}>Register authority (admin) · public key only</div>
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-authority-name" />
          <Textarea rows={4} className="font-mono text-[10px]" placeholder={"-----BEGIN PUBLIC KEY-----\n(Ed25519)\n-----END PUBLIC KEY-----"} value={publicKey} onChange={(e) => setKey(e.target.value)} data-testid="input-authority-key" />
          {/PRIVATE KEY/.test(publicKey) && <p className="font-mono text-[10px] text-destructive">That is a private key. Never paste private signing keys here.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Choice label="Mechanism" value={mechanism} options={["DETERMINISTIC", "CROSS_MODEL", "HUMAN"]} onChange={setMech} testId="select-mechanism" />
            <p className="font-mono text-[10px] text-muted-foreground self-end">{MECH_NOTE[mechanism]}</p>
          </div>
          <fieldset><legend className={lab}>Scopes</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {SCOPES.map((sc) => (
                <label key={sc} className="flex items-center gap-1 font-mono text-[11px]">
                  <input type="checkbox" checked={scopes.includes(sc)} onChange={(e) => setScopes(e.target.checked ? [...scopes, sc] : scopes.filter((x) => x !== sc))} data-testid={`check-scope-${sc}`} />{sc}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="font-mono text-[10px] text-muted-foreground">Signing protocol: docs/upgrade-program/short-sprints-verifier-protocol.md</p>
          <Textarea rows={2} placeholder="Governance note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-authority-note" />
          <Button size="sm" type="submit" disabled={!name.trim() || !pemOk || /PRIVATE KEY/.test(publicKey) || scopes.length === 0 || pending} data-testid="button-register-authority">Register authority</Button>
        </form>
      )}
    </section>
  );
}

/* ---------------- Page ---------------- */

export default function Operations() {
  const search = useSearch();
  const q = useMemo(() => new URLSearchParams(search), [search]);
  const kind: OpsKind = parseKind(q.get("kind"));
  const sessionId = q.get("sessionId") ?? "";
  const sourceId = q.get("sourceId") ?? "";
  const sourceKind = q.get("sourceKind") ?? "";
  const [offset, setOffset] = useState(0);
  const params = sessionId || offset ? { ...(sessionId ? { sessionId } : {}), ...(offset ? { offset } : {}) } : undefined;
  const queryKey = getGetArtifactOperationsQueryKey(kind, params);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [prepOffset, setPrepOffset] = useState(0);
  const prepParams = sessionId || prepOffset ? { ...(sessionId ? { sessionId } : {}), ...(prepOffset ? { offset: prepOffset } : {}) } : undefined;
  const prep = useGetArtifactPreparations(kind, prepParams, { query: { queryKey: getGetArtifactPreparationsQueryKey(kind, prepParams) } });
  const guardsReady = prep.data?.databaseProtection.ready === true;
  const [view, setView] = useState<"prep" | "internal" | "full">("prep");
  const ws = useGetArtifactOperations(kind, params, {
    query: { queryKey, enabled: guardsReady, refetchInterval: (query) => ((query.state.data?.items ?? []).some((w) => isActiveState(w.state)) ? 4000 : false) },
  });
  const mut = useRunArtifactOperation();
  const [selected, setSelected] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<{ message: string; conflict: boolean } | null>(null);
  const data = ws.isError ? undefined : ws.data;

  useEffect(() => { setSelected(null); setActionErr(null); setOffset(0); setPrepOffset(0); }, [kind, sessionId]);
  const [pinned, setPinned] = useState<ArtifactOperationWorkflow | null>(null);
  const wantId = selected ?? data?.selectedId ?? null;
  const wf = data?.items.find((w) => w.id === wantId) ?? (pinned && pinned.id === wantId ? pinned : undefined) ?? data?.items[0];

  const run: RunFn = async (action, options, extra) => {
    setActionErr(null);
    try {
      const next = await mut.mutateAsync({
        kind,
        data: {
          action, options,
          ...(extra?.wf ? { workflowId: extra.wf.id, revision: extra.wf.revision } : {}),
          ...(extra?.sessionId ? { sessionId: extra.sessionId } : {}),
          ...(extra?.sourceId ? { sourceId: extra.sourceId } : {}),
          ...(extra?.sourceKind ? { sourceKind: extra.sourceKind } : {}),
        },
      });
      qc.setQueryData(queryKey, next);
      const keepId = extra?.wf?.id ?? next.selectedId ?? null;
      setSelected(keepId);
      setPinned(next.items.find((w) => w.id === keepId) ?? null);
      toast({ title: `${action} accepted`, description: "Server recorded the action. Review state below." });
      return true;
    } catch (e) {
      const m = errMessage(e);
      setActionErr(m);
      if (m.conflict) qc.invalidateQueries({ queryKey });
      return false;
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <header className="border-b bg-card px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className={lab}>Operations · owner-scoped</div>
          <h1 className="text-3xl leading-none">{kind === "imprima" ? "IMPRIMA documents" : "SHORT SPRINTS"}</h1>
        </div>
        <nav className="flex gap-1 ml-auto" aria-label="Operation kind">
          {(["imprima", "short-sprints"] as const).map((k) => (
            <Link key={k} href={operationsHref(k, { sessionId, sourceId, sourceKind })}
              className={`px-3 h-8 inline-flex items-center rounded border font-mono text-[10px] uppercase tracking-wider ${k === kind ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              aria-current={k === kind ? "page" : undefined} data-testid={`tab-${k}`}>
              {k === "imprima" ? "IMPRIMA" : "SHORT SPRINTS"}
            </Link>
          ))}
        </nav>
        {sessionId && <Link href={`/session/${sessionId}/verification`} className="font-mono text-[10px] underline" data-testid="link-session-verification">session verification</Link>}
        <Button variant="outline" size="sm" onClick={() => { prep.refetch(); if (guardsReady) ws.refetch(); }} data-testid="button-refresh"><RefreshCw className={`h-3.5 w-3.5 mr-1 ${ws.isFetching || prep.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
      </header>

      {prep.data && prep.data.notices.length > 0 && (
        <div className="border-b bg-muted/40 px-4 py-2 font-mono text-[11px]" data-testid="text-prep-notices">{prep.data.notices.map((n, i) => <p key={i}>{n}</p>)}</div>
      )}
      {guardsReady && view === "full" && data && data.notices.length > 0 && (
        <div className="border-b bg-secondary/10 px-4 py-2 font-mono text-[11px]" data-testid="text-notices">{data.notices.map((n, i) => <p key={i}>{n}</p>)}</div>
      )}

      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-7xl w-full mx-auto [overflow-wrap:anywhere]">
        {actionErr && (
          <div className={`mb-4 border rounded p-3 flex flex-wrap items-center gap-2 font-mono text-xs ${actionErr.conflict ? "border-secondary/60 bg-secondary/10" : "border-destructive/40 bg-destructive/5 text-destructive"}`} data-testid="text-action-error">
            <AlertTriangle className="h-4 w-4" />
            {actionErr.conflict ? `Conflict: this workflow changed since you loaded it. ${actionErr.message}` : actionErr.message}
            {actionErr.conflict && <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => { setActionErr(null); ws.refetch(); }} data-testid="button-conflict-refresh">Reload latest revision</Button>}
          </div>
        )}
        {prep.isError ? (
          <div className="border border-destructive/40 bg-destructive/5 rounded p-6 flex flex-col items-start gap-3" data-testid="status-prep-error">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <p className="font-mono text-sm">Preparation workspace unavailable: {errMessage(prep.error).message}.</p>
            <Button size="sm" onClick={() => prep.refetch()} data-testid="button-prep-retry">Retry</Button>
          </div>
        ) : prep.isLoading || !prep.data ? (
          <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
        ) : (
          <div className="space-y-6">
            <GuardStatus ws={prep.data} />
            <nav className="flex flex-wrap gap-1" aria-label="Workspace lane">
              <button type="button" onClick={() => setView("prep")} className={`px-3 h-8 rounded border font-mono text-[10px] uppercase tracking-wider ${view === "prep" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`} aria-pressed={view === "prep"} data-testid="tab-lane-prep">Private preparation</button>
              <button type="button" onClick={() => setView("internal")} className={`px-3 h-8 rounded border font-mono text-[10px] uppercase tracking-wider ${view === "internal" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`} aria-pressed={view === "internal"} data-testid="tab-lane-internal">{kind === "imprima" ? "IMPRIMA Internal" : "SHORT SPRINT Internal"}</button>
              <button type="button" disabled={!guardsReady} onClick={() => setView("full")} className={`px-3 h-8 rounded border font-mono text-[10px] uppercase tracking-wider disabled:opacity-50 ${view === "full" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`} data-testid="tab-lane-full">
                Protected workflow {guardsReady ? "· available" : "· unavailable"}
              </button>
            </nav>
            {view === "internal" ? (
              <PreparationLane internal key={`internal:${kind}:${sessionId}:${sourceId}`} kind={kind} ws={prep.data} params={prepParams} offset={prepOffset} setOffset={setPrepOffset} fetching={prep.isFetching} initial={{ sourceId, sourceKind, sessionId }} />
            ) : view === "prep" || !guardsReady ? (
              <PreparationLane key={`${kind}:${sessionId}:${sourceId}`} kind={kind} ws={prep.data} params={prepParams} offset={prepOffset} setOffset={setPrepOffset} fetching={prep.isFetching} initial={{ sourceId, sourceKind, sessionId }} />
            ) : (
              <>
        {ws.isError ? (
          <div className="border border-destructive/40 bg-destructive/5 rounded p-6 flex flex-col items-start gap-3" data-testid="status-ops-error">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <p className="font-mono text-sm">Workspace unavailable: {errMessage(ws.error).message}. No states are shown while it cannot be read.</p>
            <Button size="sm" onClick={() => ws.refetch()} data-testid="button-retry">Retry</Button>
          </div>
        ) : ws.isLoading || !data ? (
          <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] gap-8">
            <aside className="space-y-8 min-w-0">
              <section className="border rounded p-4 bg-card">
                <h2 className="text-2xl leading-none mb-3">{kind === "imprima" ? "New document" : "New sprint"}</h2>
                {kind === "imprima"
                  ? <ImprimaCreate key={sourceId} ws={data} run={run} pending={mut.isPending} initial={{ sourceId, sourceKind }} />
                  : <ShortSprintCreate key={sessionId} ws={data} run={run} pending={mut.isPending} sessionId={sessionId} initialSource={sourceId} />}
              </section>
              {kind === "short-sprints" && <Authorities ws={data} run={run} pending={mut.isPending} />}
            </aside>

            <div className="space-y-6 min-w-0">
              <section>
                <div className="flex items-baseline border-b pb-2 mb-3 gap-2">
                  <h2 className="text-2xl leading-none">Workflows</h2>
                  <span className={`${lab} ml-auto`}>{offset + 1}–{offset + data.items.length}</span>
                  <Button size="sm" variant="outline" className="h-7" disabled={offset === 0 || ws.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE))} data-testid="button-page-prev">Newer</Button>
                  <Button size="sm" variant="outline" className="h-7" disabled={!data.hasMore || ws.isFetching} onClick={() => setOffset(offset + PAGE)} data-testid="button-page-next">Older</Button>
                </div>
                {data.items.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-6" data-testid="text-empty">
                    Nothing saved yet. {kind === "imprima" ? "Pick a saved artifact and queue a document." : "Open a sprint against a session to begin collecting gate evidence."}
                  </p>
                ) : (
                  <ul className="flex gap-2 overflow-x-auto pb-1">
                    {data.items.map((w) => (
                      <li key={w.id}>
                        <button type="button" onClick={() => setSelected(w.id)} className={`text-left border rounded px-3 py-2 min-w-[200px] ${wf?.id === w.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} data-testid={`button-workflow-${w.id}`}>
                          <div className="flex items-center gap-2"><StateTag state={w.state} /><span className="font-mono text-[10px] text-muted-foreground">r{w.revision}</span></div>
                          <div className="text-sm truncate mt-1">{w.title}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{fmt(w.updatedAt)}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {wf && (
                <section className="space-y-4" data-testid={`panel-workflow-${wf.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl leading-none">{wf.title}</h3>
                    <StateTag state={wf.state} />
                    <span className="font-mono text-[10px] text-muted-foreground ml-auto">rev {wf.revision} · source {short(wf.sourceHash)}</span>
                  </div>
                  {isActiveState(wf.state) && <p className="font-mono text-[11px] text-secondary">Job in progress. Polling every 4s.</p>}
                  {wf.allowedActions.length === 0 && <p className="font-mono text-[11px] text-muted-foreground">No actions available to you in this state.</p>}
                  {kind === "imprima"
                    ? <ImprimaDetail key={`${wf.id}:${wf.revision}`} wf={wf} run={run} pending={mut.isPending} />
                    : <ShortSprintDetail key={`${wf.id}:${wf.revision}`} wf={wf} run={run} pending={mut.isPending} />}
                  <details className="border rounded p-3">
                    <summary className={`${lab} cursor-pointer`}>Event log ({wf.events.length}) and config</summary>
                    <ol className="mt-2 space-y-1 font-mono text-[11px]">
                      {wf.events.map((e, i) => <li key={i}><b>{e.action}</b> r{e.revision} · {e.actorId.slice(0, 8)} · {fmt(e.createdAt)}</li>)}
                    </ol>
                    <div className="mt-2"><JsonBlock value={wf.config} /></div>
                  </details>
                </section>
              )}
            </div>
          </div>
        )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
