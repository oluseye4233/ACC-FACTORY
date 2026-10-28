import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetImprimaPortalQueryKey,
  useCreatePortalPublication,
  useDownloadPortalPublication,
  useGetImprimaPortal,
  useRequestPublicationCode,
  type PortalPublication,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, Boxes, Download, FileInput, FileOutput, KeyRound, Library, Loader2, Mail } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionStageHref, stageLabel } from "@/lib/stage-origin";
import { NATIVE_ZIP_SOURCE_TYPES, apiErr, isPortalSourceType, parseExportOptions } from "@/lib/portal";
import { StageSupportBanner, StageSupportReturnAction, useStageSupportCase } from "@/components/shared/StageSupportReturn";
import type { Departure } from "@/lib/stage-support";

const Ingest = lazy(() => import("@/pages/ingest"));
const Cartridge = lazy(() => import("@/pages/cartridge"));
const UploadBar = lazy(() => import("@/components/exemplars/UploadBar").then((m) => ({ default: m.UploadBar })));

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const sel = "h-9 w-full rounded-md border bg-background px-2 font-mono text-xs";

function Ready({ label, ok, testId }: { label: string; ok: boolean; testId: string }) {
  return (
    <div className={`rounded border p-3 ${ok ? "border-primary/40" : "border-dashed"}`} data-testid={testId}>
      <div className={lab}>{label}</div>
      <div className={`font-mono text-sm font-bold ${ok ? "text-primary" : "text-muted-foreground"}`}>{ok ? "AVAILABLE" : "UNAVAILABLE"}</div>
    </div>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function PublicationRow({ p, canEmail, emailBlock, departure }: { p: PortalPublication; canEmail: boolean; emailBlock: string; departure: Departure | null }) {
  const req = useRequestPublicationCode();
  const dl = useDownloadPortalPublication();
  const [challenge, setChallenge] = useState<{ id: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = p.state === "READY";

  const request = async () => {
    setMsg(null);
    try {
      const r = await req.mutateAsync({ publicationId: p.id });
      setChallenge({ id: r.challengeId, expiresAt: r.expiresAt });
      setCode("");
      setMsg({ ok: true, text: `The email provider accepted a single-use code for your account email. Inbox delivery is not guaranteed. Expires ${new Date(r.expiresAt).toLocaleString()}.` });
    } catch (e) { setMsg({ ok: false, text: apiErr(e) }); }
  };
  const download = async () => {
    if (!challenge) return;
    setMsg(null);
    try {
      const blob = await dl.mutateAsync({ publicationId: p.id, data: { challengeId: challenge.id, code } });
      saveBlob(blob, p.filename);
      setChallenge(null); setCode("");
      setMsg({ ok: true, text: "Downloaded. That code is now used; request a new one for another download." });
    } catch (e) { setMsg({ ok: false, text: apiErr(e) }); }
  };

  return (
    <li className="space-y-2 py-3" data-testid={`row-publication-${p.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-muted px-1.5 font-mono">{p.format}</span>
        <b className="truncate">{p.title}</b>
        <span className="text-muted-foreground">by {p.author}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{p.filename}</span>
        <span className="ml-auto rounded border px-1.5 font-mono text-[10px]" data-testid={`status-publication-${p.id}`}>{p.state}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!canEmail || !ready || req.isPending} onClick={request} data-testid={`button-request-code-${p.id}`}>
          {req.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mail className="mr-1 h-3 w-3" />} {challenge ? "Request a new code" : "Email me a download code"}
        </Button>
        {challenge && (
          <>
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="h-8 w-32 font-mono" data-testid={`input-code-${p.id}`} />
            <Button size="sm" disabled={code.length !== 6 || dl.isPending} onClick={download} data-testid={`button-download-${p.id}`}>
              {dl.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />} Download
            </Button>
          </>
        )}
      </div>
      {!canEmail && <p className="text-[11px] text-muted-foreground" data-testid={`text-email-blocked-${p.id}`}>{emailBlock}</p>}
      {canEmail && !ready && <p className="text-[11px] text-muted-foreground">Codes and download open only when the publication is READY (current state {p.state}).</p>}
      {departure && p.sourceId === departure.sourceId && (
        <div data-testid={`return-publication-${p.id}`}>
          <StageSupportReturnAction departure={departure} resultId={p.id} compact blockedReason={ready ? null : `Only a READY publication can be returned. Current state: ${p.state}.`} />
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[11px] ${msg.ok ? "text-foreground/80" : "text-destructive"}`} data-testid={`text-publication-msg-${p.id}`}>{msg.text}</p>}
    </li>
  );
}

export default function ImprimaPortal() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const qc = useQueryClient();
  const portal = useGetImprimaPortal();
  const create = useCreatePortalPublication();
  const [location, setLocation] = useLocation();
  const tab: "publish" | "intake" = params.get("tab") === "intake" ? "intake" : "publish";
  const intakeParam = params.get("intake");
  const intake: "ingest" | "cartridge" | "library" = intakeParam === "cartridge" || intakeParam === "library" ? intakeParam : "ingest";
  // Tab state lives in the URL so embedded intake forms keep case/result/return query context across reloads.
  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setLocation(`${location}?${next.toString()}`, { replace: true });
  };
  const setTab = (t: "publish" | "intake") => setParam(t === "intake" ? { tab: t, intake } : { tab: t });
  const rawType = params.get("sourceType") ?? "ARTIFACT";
  const linkedKnown = isPortalSourceType(rawType);
  const exportOptions = parseExportOptions(params.get("exportOptions"));
  const support = useStageSupportCase();
  const departure = support.departure && support.departure.tool !== "ingestion" && support.departure.tool !== "cartridge" ? support.departure : null;
  const parentId = params.get("parentId");
  const opKind = params.get("kind");
  const [allSessions, setAllSessions] = useState(false);
  const [sourceKey, setSourceKey] = useState(params.get("sourceId") ? `${params.get("sourceType") ?? "ARTIFACT"}:${params.get("sourceId")}` : "");
  const [format, setFormat] = useState<"PDF" | "EDITABLE_ZIP">("PDF");
  const [author, setAuthor] = useState("");
  const [rights, setRights] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sessionId = params.get("sessionId") ?? "";
  const featureId = Number(params.get("featureId") ?? "");
  const d = portal.data;
  const canEmail = !!d?.emailConfigured && !!d?.subscriberEmailAvailable;
  const emailBlock = !d?.emailConfigured ? "Code email is not configured on this deployment, so protected downloads are unavailable." : "Your account has no verified email address, so a code cannot be sent.";
  const visibleSources = (d?.sources ?? []).filter((x) => allSessions || !sessionId || x.sessionId === sessionId || `${x.sourceType}:${x.id}` === sourceKey);
  const [sourceType, sourceId] = sourceKey ? [sourceKey.split(":")[0], sourceKey.slice(sourceKey.indexOf(":") + 1)] : ["", ""];
  const listed = d?.sources.some((s) => s.id === sourceId && s.sourceType === sourceType);
  // URL-bound sources of a known type are allowed before they are listed; the server still verifies ownership.
  const urlBound = !!sourceId && sourceKey === `${rawType}:${params.get("sourceId")}` && linkedKnown;
  const nativeZip = NATIVE_ZIP_SOURCE_TYPES.includes(sourceType);
  const effFormat = nativeZip ? "EDITABLE_ZIP" : format;
  const canPrepare = !!d?.storageConfigured && (!!listed || urlBound) && author.trim().length > 0 && rights && !create.isPending;

  const prepare = async () => {
    setErr(null);
    try {
      // PREPARATION_FILE needs its parent preparation and operation kind; other types send the contract body only.
      const extra = {
        ...(sourceType === "PREPARATION_FILE" ? { parentId, kind: opKind } : {}),
        ...(exportOptions && urlBound ? { exportOptions } : {}),
      };
      type Input = Parameters<typeof create.mutateAsync>[0]["data"];
      await create.mutateAsync({ data: { sourceId, sourceType, format: effFormat, author: author.trim(), rightsConfirmed: true, ...extra } as Input });
      setRights(false);
      void qc.invalidateQueries({ queryKey: getGetImprimaPortalQueryKey() });
    } catch (e) { setErr(apiErr(e)); }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav />
      <StageSupportBanner {...support} />
      {!support.caseId && sessionId && featureId > 0 && (
        <div className="border-b border-primary/30 bg-primary/5 px-4 py-2" data-testid="banner-portal-origin">
          <Link href={sessionStageHref(sessionId, featureId)} className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-primary" data-testid="link-return-stage"><ArrowLeft className="h-3 w-3" /> Return to {stageLabel(featureId)}</Link>
        </div>
      )}
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <p className={lab}>Publications and intake</p>
          <h1 className="font-display text-4xl tracking-wider">IMPRIMA Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Project files leave the platform only through this portal, with a single-use emailed code. Preparing a publication is not copyright registration.</p>
        </header>
        <div className="flex gap-2" role="tablist">
          {(["publish", "intake"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded border px-3 py-1.5 font-mono text-[10px] font-bold uppercase ${tab === t ? "border-primary bg-primary/10 text-primary" : ""}`} data-testid={`tab-${t}`}>{t === "publish" ? "Publish and download" : "Intake"}</button>
          ))}
        </div>

        {tab === "intake" ? (
          <section className="space-y-4" data-testid="panel-intake">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Intake type">
              {([["ingest", "Ingestion Engine", FileInput], ["cartridge", "Advanced Cartridge", Boxes], ["library", "Exemplar Library intake", Library]] as const).map(([k, label, Icon]) => (
                <button key={k} role="tab" aria-selected={intake === k} onClick={() => setParam({ tab: "intake", intake: k })} className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] font-bold uppercase ${intake === k ? "border-secondary bg-secondary/10 text-secondary" : ""}`} data-testid={`tab-intake-${k}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Uploads use the existing forms, credits, build gates and stage return exactly as before.</p>
            <div className="overflow-hidden rounded-lg border">
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                {intake === "cartridge" ? <Cartridge embedded /> : intake === "library" ? (
                  <div className="space-y-3 p-4" data-testid="panel-library-intake">
                    <h2 className="font-display text-xl tracking-wider">Exemplar Library intake</h2>
                    <p className="text-xs text-muted-foreground">Upload SPC, MA, MPDD or PDD files or a folder into your Exemplar Library archive. Items arrive unqualified; qualify them in the <Link href="/exemplars" className="underline">Exemplar Library</Link> before Sphinx can select them.</p>
                    <UploadBar embedded />
                  </div>
                ) : <Ingest embedded />}
              </Suspense>
            </div>
          </section>
        ) : portal.isLoading ? <Skeleton className="h-64 w-full" /> : portal.isError || !d ? (
          <p role="alert" className="text-sm text-destructive">Portal unavailable: {apiErr(portal.error)} <button className="underline" onClick={() => void portal.refetch()} data-testid="button-retry-portal">Retry</button></p>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="panel-readiness">
              <Ready label="File storage" ok={d.storageConfigured} testId="status-storage" />
              <Ready label="Code email" ok={d.emailConfigured} testId="status-email" />
              <Ready label="Your email" ok={d.subscriberEmailAvailable} testId="status-subscriber-email" />
            </section>
            {d.protectedSourcesStatus && d.protectedSourcesStatus.toLowerCase() !== "available" && d.protectedSourcesStatus.toLowerCase() !== "ok" && (
              <p role="alert" className="flex items-start gap-2 rounded border border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive" data-testid="text-protected-sources-unavailable">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Protected sources are currently unavailable ({d.protectedSourcesStatus}). The source list below may be incomplete; this does not mean you have no sources.
              </p>
            )}
            {!(d.storageConfigured && canEmail) && <p className="text-xs text-secondary" data-testid="text-portal-partial">Some portal actions are unavailable on this deployment. They are shown disabled with the reason.</p>}

            <section className="space-y-3 rounded-lg border bg-card p-4" data-testid="panel-prepare">
              <h2 className="font-display text-xl tracking-wider">Prepare a publication</h2>
              <label className="block space-y-1"><span className={lab}>Owned source</span>
                <select className={sel} value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} data-testid="select-portal-source">
                  <option value="">Select an artifact or library item you own</option>
                  {urlBound && !listed && <option value={sourceKey}>{sourceType} · linked {sourceId.slice(0, 8)}</option>}
                  {visibleSources.map((s) => <option key={`${s.sourceType}:${s.id}`} value={`${s.sourceType}:${s.id}`}>{s.sourceType} · {s.type} · {s.title}</option>)}
                </select>
              </label>
              {sessionId && (
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={allSessions} onChange={(e) => setAllSessions(e.target.checked)} data-testid="check-all-sessions" /> Showing sources from session {sessionId.slice(0, 8)} only. Show all sessions</label>
              )}
              {sourceId && (
                <p className="break-all rounded border bg-muted/30 px-2 py-1 font-mono text-[10px]" data-testid="text-selected-source">Selected: {sourceType} · {sourceId}{parentId && sourceType === "PREPARATION_FILE" ? ` · preparation ${parentId} · ${opKind}` : ""}</p>
              )}
              {sourceId && !listed && (urlBound ? (
                <p className="text-[11px] text-muted-foreground" data-testid="text-source-pending">Linked from your project; ownership is verified by the server when you prepare.</p>
              ) : (
                <p className="text-[11px] text-destructive" data-testid="text-source-unlisted">The linked source {sourceId.slice(0, 8)} is not one of your publishable sources.</p>
              ))}
              {exportOptions && urlBound && <p className="break-all font-mono text-[10px] text-muted-foreground" data-testid="text-export-options">Export options: {Object.entries(exportOptions).filter(([k]) => k !== "sourceArtifactId").map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1"><span className={lab}>Format</span>
                  <select className={sel} value={effFormat} disabled={nativeZip} onChange={(e) => setFormat(e.target.value as "PDF" | "EDITABLE_ZIP")} data-testid="select-portal-format"><option value="PDF">PDF</option><option value="EDITABLE_ZIP">Editable ZIP</option></select>
                  {nativeZip && <span className="block text-[10px] text-muted-foreground">Native files publish as an editable ZIP: original bytes unchanged beside the stamped cover.</span>}
                </label>
                <label className="block space-y-1"><span className={lab}>Author</span>
                  <Input maxLength={160} value={author} onChange={(e) => setAuthor(e.target.value)} data-testid="input-portal-author" />
                </label>
              </div>
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={rights} onChange={(e) => setRights(e.target.checked)} data-testid="check-portal-rights" /> I confirm I hold the rights to publish this content. This records my confirmation only; it is not a copyright registration.</label>
              <Button disabled={!canPrepare} onClick={prepare} data-testid="button-prepare-publication">
                {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileOutput className="mr-1 h-4 w-4" />} Prepare publication
              </Button>
              {!d.storageConfigured && <p className="text-[11px] text-muted-foreground" data-testid="text-storage-blocked">File storage is not configured, so publications cannot be prepared.</p>}
              {err && <p role="alert" className="text-xs text-destructive" data-testid="text-prepare-error">{err}</p>}
            </section>

            <section className="rounded-lg border bg-card p-4">
              <h2 className="flex items-center gap-2 font-display text-xl tracking-wider"><KeyRound className="h-4 w-4" /> Your publications</h2>
              {d.publications.length === 0 ? <p className="py-4 text-xs text-muted-foreground" data-testid="text-no-publications">No publications yet. Prepare one above.</p> : (
                <ul className="divide-y">{d.publications.map((p) => <PublicationRow key={p.id} p={p} canEmail={canEmail} emailBlock={emailBlock} departure={departure} />)}</ul>
              )}
            </section>
            <p className="text-[11px] text-muted-foreground">Account, privacy and audit exports remain in <Link href="/account" className="underline">Account</Link>. Historical preparations remain in <Link href="/operations?kind=imprima" className="underline">IMPRIMA operations</Link>.</p>
          </>
        )}
      </main>
    </div>
  );
}
