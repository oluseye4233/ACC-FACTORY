import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetArtifactPreparationsQueryKey,
  useCreateArtifactPreparation,
  type ArtifactPreparation,
  type ArtifactPreparationWorkspace,
  type GetArtifactPreparationsParams,
} from "@workspace/api-client-react";
import { Archive, Download, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MANIFEST_FIELDS, PREPARATION_MANIFEST_SAMPLE, downloadFrom, errMessage, isRec, type OpsKind } from "@/lib/artifact-ops";

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const sel = "h-9 w-full rounded-md border bg-background px-2 font-mono text-xs";
const fmt = (s: string) => new Date(s).toLocaleString();
const PAGE = 50;

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

export function GuardStatus({ ws }: { ws: ArtifactPreparationWorkspace }) {
  const p = ws.databaseProtection;
  return (
    <div className={`border rounded p-3 font-mono text-[11px] ${p.ready ? "border-primary/40" : "border-secondary/60 bg-secondary/5"}`} data-testid="status-db-protection">
      <div className="flex items-center gap-2">
        {p.ready ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldAlert className="h-4 w-4 text-secondary" />}
        <b>{p.ready ? "Protected workflow guards ready" : "Protected workflow unavailable: database guards not installed"}</b>
      </div>
      <ul className="mt-2 grid sm:grid-cols-2 gap-x-4">
        {p.checks.map((c) => (
          <li key={c.id} data-testid={`status-check-${c.id}`}>
            <span className={c.ready ? "text-primary" : "text-destructive"}>{c.ready ? "READY" : "MISSING"}</span> {c.id}
          </li>
        ))}
      </ul>
      {!p.ready && <p className="mt-2 text-muted-foreground">The full guarded workflow is not loaded. The private preparation lane below works independently.</p>}
    </div>
  );
}

function PrepCard({ p }: { p: ArtifactPreparation }) {
  const [err, setErr] = useState<string | null>(null);
  const dl = (path: string, name: string) => downloadFrom(path, name).then(() => setErr(null), (e) => setErr(errMessage(e).message));
  const zip = p.files.find((f) => f.format.toUpperCase() === "ZIP" || f.filename.endsWith(".zip"));
  return (
    <li className="border rounded p-3 bg-card space-y-2" data-testid={`card-prep-${p.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-muted/40" data-testid={`status-prep-${p.id}`}>{p.state}</span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-secondary/50 text-secondary">PRIVATE · NOT RELEASABLE</span>
        <h4 className="text-lg leading-none">{p.title}</h4>
        <span className="font-mono text-[10px] text-muted-foreground ml-auto">{fmt(p.createdAt)}</span>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground space-y-0.5 break-all">
        <div>source {p.sourceKind} · {p.sourceId}</div>
        <div>session {p.sessionId}</div>
        <div data-testid={`text-source-hash-${p.id}`}>sourceHash {p.sourceHash}</div>
        <div data-testid={`text-manifest-hash-${p.id}`}>manifestHash {p.manifestHash}</div>
      </div>
      {p.notices.length > 0 && <ul className="font-mono text-[10px] list-disc pl-4">{p.notices.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {zip && (
        <Button size="sm" className="h-7" onClick={() => dl(zip.downloadPath, zip.filename)} data-testid={`button-prep-zip-${p.id}`}>
          <Archive className="h-3 w-3 mr-1" /> Download ZIP
        </Button>
      )}
      <ul className="divide-y border-t font-mono text-[11px]">
        {p.files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 py-1.5" data-testid={`row-prep-file-${f.id}`}>
            <span className="bg-muted px-1.5 rounded">{f.format}</span>
            <span className="truncate">{f.filename}</span>
            <span className="text-muted-foreground">{f.size.toLocaleString()} bytes</span>
            <span className="text-muted-foreground break-all w-full">sha256 {f.fileHash}</span>
            <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => dl(f.downloadPath, f.filename)} data-testid={`button-prep-download-${f.id}`}>
              <Download className="h-3 w-3 mr-1" /> Download
            </Button>
          </li>
        ))}
      </ul>
      {err && <p className="font-mono text-xs text-destructive">{err}</p>}
    </li>
  );
}

type Props = {
  kind: OpsKind;
  ws: ArtifactPreparationWorkspace;
  params: GetArtifactPreparationsParams | undefined;
  offset: number;
  setOffset: (n: number) => void;
  fetching: boolean;
  initial: { sourceId: string; sourceKind: string; sessionId: string };
};

export function PreparationLane({ kind, ws, params, offset, setOffset, fetching, initial }: Props) {
  const qc = useQueryClient();
  const mut = useCreateArtifactPreparation();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOk] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState(initial.sourceId);
  // imprima
  const [formats, setFormats] = useState<string[]>(["DOCX", "PDF"]);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [audience, setAudience] = useState("TECHNICAL");
  const [conf, setConf] = useState("INTERNAL");
  const [human, setHuman] = useState(false);
  // short sprints
  const [circuit, setCircuit] = useState("SC_ONE");
  const [target, setTarget] = useState("SOFTWARE");
  const [profile, setProfile] = useState("STANDARD");
  const [hostTarget, setHost] = useState("");
  const [mText, setMText] = useState(JSON.stringify(PREPARATION_MANIFEST_SAMPLE, null, 2));

  const sources = ws.sources.filter((s) => !initial.sessionId || kind === "imprima" || s.sessionId === initial.sessionId || s.id === initial.sourceId);
  const source = ws.sources.find((s) => s.id === sourceId);
  const sourceKind = source?.kind ?? (sourceId === initial.sourceId ? initial.sourceKind : "");
  let manifest: Record<string, unknown> | null = null;
  let mErr: string | null = null;
  if (kind === "short-sprints") {
    try { const p: unknown = JSON.parse(mText); if (!isRec(p)) throw new Error("Manifest must be a JSON object"); manifest = p; } catch (x) { mErr = x instanceof Error ? x.message : "Invalid JSON"; }
  }
  const missingFields = manifest ? MANIFEST_FIELDS.filter((k) => !(k in manifest!)) : [];
  const ok = !!sourceId && !!sourceKind && (kind === "imprima"
    ? formats.length > 0 && !!title.trim() && !!project.trim() && human
    : !!manifest && !!hostTarget.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setErr(null); setOk(null);
    const options: Record<string, unknown> = kind === "imprima"
      ? { formats, mode: "DRAFT", title: title.trim(), project: project.trim(), authorIsHuman: true, timezone: "America/Chicago", audience, confidentiality: conf, riskDomain: "GENERAL" }
      : { circuit, target, profile, hostTarget: hostTarget.trim(), manifest };
    try {
      const prep = await mut.mutateAsync({ kind, data: { sourceId, sourceKind, options } });
      const key = getGetArtifactPreparationsQueryKey(kind, params);
      qc.setQueryData<ArtifactPreparationWorkspace>(key, (old) => old ? { ...old, items: [prep, ...old.items.filter((i) => i.id !== prep.id)] } : old);
      qc.invalidateQueries({ queryKey: [`/api/artifact-operations/${kind}/preparations`] });
      setOk(`Saved ${prep.state} ${prep.id.slice(0, 8)} with ${prep.files.length} files.`);
    } catch (x) {
      setErr(errMessage(x).message);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] gap-8" data-testid="panel-preparation">
      <aside className="min-w-0">
        <form className="border rounded p-4 bg-card space-y-3" onSubmit={submit}>
          <h2 className="text-2xl leading-none">{kind === "imprima" ? "Prepare draft" : "Prepare sprint package"}</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            {kind === "imprima"
              ? "Source-preserving rendering only. No LLM or editorial adapters run, no scores, no certification. Mode is DRAFT."
              : "Non-releasable proposal package. No tests, gates, release, or deployment run here."}
          </p>
          <Field label="Source">
            <select className={sel} value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="select-prep-source">
              <option value="">Select a saved source</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.kind} · {s.label}</option>)}
              {initial.sourceId && !ws.sources.some((s) => s.id === initial.sourceId) && <option value={initial.sourceId}>{initial.sourceKind || "linked"} · {initial.sourceId.slice(0, 8)} (not listed)</option>}
            </select>
          </Field>
          {kind === "imprima" ? (
            <>
              <fieldset>
                <legend className={lab}>Formats</legend>
                <div className="flex gap-3 mt-1">
                  {(["DOCX", "PDF", "HTML"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-1.5 font-mono text-xs">
                      <input type="checkbox" checked={formats.includes(f)} onChange={(e) => setFormats(e.target.checked ? [...formats, f] : formats.filter((x) => x !== f))} data-testid={`check-prep-format-${f}`} /> {f}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Title (required)"><Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="input-prep-title" /></Field>
              <Field label="Project (required)"><Input value={project} maxLength={120} onChange={(e) => setProject(e.target.value)} data-testid="input-prep-project" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Choice label="Audience" value={audience} options={["EXECUTIVE", "TECHNICAL", "CLIENT", "PUBLIC"]} onChange={setAudience} testId="select-prep-audience" />
                <Choice label="Confidentiality" value={conf} options={["PUBLIC", "INTERNAL", "CONFIDENTIAL"]} onChange={setConf} testId="select-prep-confidentiality" />
                <Field label="Mode"><Input value="DRAFT" readOnly className="font-mono text-xs" /></Field>
                <Field label="Risk domain"><Input value="GENERAL" readOnly className="font-mono text-xs" /></Field>
              </div>
              <Field label="Timezone"><Input value="America/Chicago" readOnly className="font-mono text-xs" /></Field>
              <div className="font-mono text-xs" data-testid="text-prep-author">Author (from your profile): <b>{ws.authorName ?? "not set — server will reject until profile has a name"}</b></div>
              <label className="flex items-center gap-2 font-mono text-xs">
                <input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} data-testid="check-prep-human" /> I confirm the author is a human
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Choice label="Circuit" value={circuit} options={["SC_ONE", "SC_TWO"]} onChange={setCircuit} testId="select-prep-circuit" />
                <Choice label="Target" value={target} options={["SOFTWARE", "FIRMWARE"]} onChange={setTarget} testId="select-prep-target" />
                <Choice label="Profile" value={profile} options={["PROTOTYPE_LIGHT", "STANDARD", "REGULATED"]} onChange={setProfile} testId="select-prep-profile" />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">SC_ONE requires an F4_MICRO_PDD source; SC_TWO requires an F5_SPC source.</p>
              {sourceKind && ((circuit === "SC_ONE" && sourceKind !== "F4_MICRO_PDD") || (circuit === "SC_TWO" && sourceKind !== "F5_SPC")) && (
                <p className="font-mono text-[10px] text-secondary" data-testid="text-circuit-mismatch">Source kind {sourceKind} does not match {circuit}; the server will reject it.</p>
              )}
              <Field label="Host target (required)"><Input className="font-mono text-xs" value={hostTarget} onChange={(e) => setHost(e.target.value)} data-testid="input-prep-host" /></Field>
              <div className="flex items-center gap-2">
                <span className={lab}>Agent manifest JSON ({MANIFEST_FIELDS.length} fields, proposal only)</span>
                <Button type="button" size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setMText(JSON.stringify(PREPARATION_MANIFEST_SAMPLE, null, 2))} data-testid="button-prep-sample">Load sample</Button>
              </div>
              <Textarea rows={14} className="font-mono text-[11px]" value={mText} onChange={(e) => setMText(e.target.value)} data-testid="input-prep-manifest" />
              {mErr && <p className="font-mono text-[10px] text-destructive">{mErr}</p>}
              {missingFields.length > 0 && <p className="font-mono text-[10px] text-secondary">Missing fields: {missingFields.join(", ")}</p>}
            </>
          )}
          {err && <p className="border border-destructive/40 bg-destructive/5 rounded p-2 font-mono text-xs text-destructive" data-testid="text-prep-error">Rejected: {err}</p>}
          {okMsg && <p className="font-mono text-xs text-primary" data-testid="text-prep-saved">{okMsg}</p>}
          <Button type="submit" className="w-full" disabled={!ok || mut.isPending} data-testid="button-prep-create">
            <FileText className="h-4 w-4 mr-1" /> {mut.isPending ? "Saving…" : kind === "imprima" ? "Save private draft" : "Save sprint preparation"}
          </Button>
        </form>
      </aside>
      <section className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xl leading-none">Saved preparations</h3>
          <span className={`${lab} ml-auto`}>{ws.items.length ? `${offset + 1}–${offset + ws.items.length}` : ""}</span>
          <Button size="sm" variant="outline" className="h-7" disabled={offset === 0 || fetching} onClick={() => setOffset(Math.max(0, offset - PAGE))} data-testid="button-prep-prev">Newer</Button>
          <Button size="sm" variant="outline" className="h-7" disabled={!ws.hasMore || fetching} onClick={() => setOffset(offset + PAGE)} data-testid="button-prep-next">Older</Button>
        </div>
        {ws.items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground border border-dashed rounded p-6" data-testid="text-prep-empty">No preparations saved yet. Pick a source and save one; it stays private to your account.</p>
        ) : (
          <ul className="space-y-3">{ws.items.map((p) => <PrepCard key={p.id} p={p} />)}</ul>
        )}
      </section>
    </div>
  );
}
