import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF8,
  useHarnessPfp,
  getListSessionArtifactsQueryKey,
  ArtifactType,
  CodeDjPlatform,
  type HarnessArtifact,
  type CodebaseBundle,
  type PfpReport,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { useToast } from "@/hooks/use-toast";
import { extractApiError } from "@/lib/sse";
import { AlertTriangle, Cpu, Download, FileCode, Radar, ShieldCheck } from "lucide-react";

const PLATFORM_LABELS: Record<CodeDjPlatform, string> = {
  [CodeDjPlatform["nextjs-vercel"]]: "Next.js → Vercel",
  [CodeDjPlatform["react-vite-static"]]: "React + Vite (static)",
  [CodeDjPlatform["express-replit"]]: "Express → Replit",
  [CodeDjPlatform["expo-mobile"]]: "Expo (mobile)",
  [CodeDjPlatform["pnpm-monorepo"]]: "pnpm monorepo",
};

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

export function F8CodeDj({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const latestArtifact = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.CODEBASE_BUNDLE)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );

  const certifiedMvpSources = useMemo(
    () =>
      artifacts
        .filter(
          (a) =>
            a.artifactType === ArtifactType.MVP_PDD &&
            // Only SPARTAN-certified MVP PDDs are valid Code DJ sources.
            !!(a as HarnessArtifact & { spartanCert?: unknown }).spartanCert,
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const [sourceId, setSourceId] = useState<string>(
    certifiedMvpSources[0]?.id ?? "",
  );
  const [platform, setPlatform] = useState<CodeDjPlatform>(
    CodeDjPlatform["nextjs-vercel"],
  );
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CodebaseBundle | undefined>();
  const [activeFile, setActiveFile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const [pfp, setPfp] = useState<PfpReport | undefined>();
  const [pfpError, setPfpError] = useState<string | null>(null);
  const [acknowledgeDrift, setAcknowledgeDrift] = useState(false);
  const [driftGateBlock, setDriftGateBlock] = useState<{
    counts: { critical: number; high: number; medium: number; low: number };
    fci: number;
    verdict: string;
  } | null>(null);

  const mutation = useHarnessF8();
  const pfpM = useHarnessPfp({
    mutation: {
      onSuccess: (data) => {
        setPfp(data);
        setPfpError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
      },
      onError: (e) => setPfpError(extractApiError(e).message),
    },
  });

  if (!certifiedMvpSources.length) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<ShieldCheck className="h-12 w-12" />}
          title="CERTIFIED MVP PDD REQUIRED"
          body="Code DJ scaffolds a deploy-ready codebase from a SPARTAN-certified MVP PDD / PWDD. Run F7 first to certify a source."
          hint="F8 is Architect tier only — upgrade if your run is gated."
        />
      </WorkspaceShell>
    );
  }

  const run = async () => {
    if (!sourceId) {
      setError("Pick a certified MVP PDD source");
      return;
    }
    setError(null);
    setDriftGateBlock(null);
    setResult(undefined);
    try {
      const out = (await mutation.mutateAsync({
        data: {
          sessionId,
          mvpPddArtifactId: sourceId,
          platform,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(acknowledgeDrift ? { acknowledgeDrift: true } : {}),
          ...overrideToBody(providerOverride),
        },
      })) as CodebaseBundle;
      setResult(out);
      setActiveFile(out.files[0]?.path ?? "");
      qc.invalidateQueries({
        queryKey: getListSessionArtifactsQueryKey(sessionId),
      });
      toast({
        title: "CODE DJ COMPLETE",
        description: `${out.files.length} files scaffolded for ${PLATFORM_LABELS[out.platform]}`,
      });
    } catch (err) {
      const x = extractApiError(err);
      if (x.status === 403) setUpgrade(true);
      else {
        // Surface PFP drift-gate metadata so the operator can review before retrying.
        // The generated ApiError exposes the response body under `.data`; fall back to
        // `.payload` for any custom error wrappers.
        const e = err as {
          data?: { code?: string; pfp?: typeof driftGateBlock };
          payload?: { code?: string; pfp?: typeof driftGateBlock };
        };
        const body = e?.data ?? e?.payload;
        if (body?.code === "DRIFT_GATE" && body.pfp) {
          setDriftGateBlock(body.pfp);
        }
        setError(x.message);
      }
    }
  };

  const runPfp = async () => {
    if (!sourceId) {
      setPfpError("Pick a certified MVP PDD source first");
      return;
    }
    const bundleId = result?.artifactId ?? latestArtifact?.id;
    if (!bundleId) {
      setPfpError("Run Code DJ first to produce a codebase bundle");
      return;
    }
    pfpM.mutate({
      data: {
        sessionId,
        mvpPddArtifactId: sourceId,
        codebaseBundleArtifactId: bundleId,
        ...overrideToBody(providerOverride),
      },
    });
  };

  const VERDICT_COLOR: Record<string, string> = {
    pass: "text-emerald-400",
    pass_with_notes: "text-amber-400",
    fail: "text-rose-400",
  };
  const SEVERITY_COLOR: Record<string, string> = {
    critical: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    low: "bg-muted/40 text-muted-foreground border-border/40",
  };

  const downloadBundle = () => {
    if (!result) return;
    // Lightweight, dependency-free "bundle" = single JSON manifest the operator
    // can hand to any unpacker. A real ZIP can be added later behind a download
    // endpoint; the JSON contains every byte of source so nothing is lost.
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-dj-${result.artifactId.slice(0, 8)}-${result.platform}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFileContent = result?.files.find((f) => f.path === activeFile);

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Source MVP PDD (SPARTAN-certified)
              </label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger
                  data-testid="f8-source"
                  className="font-mono text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {certifiedMvpSources.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.id}
                      className="font-mono text-xs"
                    >
                      {s.id.slice(0, 8)} ·{" "}
                      {new Date(s.createdAt).toLocaleTimeString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Target platform
              </label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as CodeDjPlatform)}
              >
                <SelectTrigger
                  data-testid="f8-platform"
                  className="font-mono text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(CodeDjPlatform) as [string, CodeDjPlatform][]
                  ).map(([, v]) => (
                    <SelectItem
                      key={v}
                      value={v}
                      className="font-mono text-xs"
                    >
                      {PLATFORM_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Operator notes (optional)
          </label>
          <Textarea
            data-testid="f8-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. prefer drizzle over prisma, tailwind v4, no auth scaffold"
            maxLength={2000}
            className="font-mono text-xs min-h-[60px]"
          />

          <div className="flex items-center justify-end gap-2 mt-3">
            <ProviderOverride
              value={providerOverride}
              onChange={setProviderOverride}
              disabled={mutation.isPending}
              testId="f8-provider"
            />
            <Button
              data-testid="f8-run"
              onClick={run}
              disabled={mutation.isPending}
              className="font-display tracking-wider gap-2"
            >
              <Cpu className="h-4 w-4" />
              {mutation.isPending ? "SCAFFOLDING..." : "RUN CODE DJ"}
            </Button>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorBanner message={error} />
            </div>
          )}
          {driftGateBlock && (
            <div className="mt-3 p-3 rounded border border-rose-500/30 bg-rose-500/10 font-mono text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-rose-400 font-bold uppercase tracking-wider mb-1">
                  PFP Drift Gate · {driftGateBlock.verdict} · FCI {driftGateBlock.fci}/100
                </div>
                <div className="text-foreground/80">
                  {driftGateBlock.counts.critical} critical · {driftGateBlock.counts.high} high ·{" "}
                  {driftGateBlock.counts.medium} medium · {driftGateBlock.counts.low} low.
                  Review the findings below, then tick "Acknowledge drift" to re-run.
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgeDrift}
                    onChange={(e) => setAcknowledgeDrift(e.target.checked)}
                    data-testid="f8-ack-drift"
                    className="accent-rose-400"
                  />
                  <span>Acknowledge drift &amp; scaffold anyway</span>
                </label>
              </div>
            </div>
          )}
        </Card>

        {/* PFP — BUGMXT Layer 4 drift detection */}
        <Card className="p-5 bg-card/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-secondary" />
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                PFP · PDD Fidelity Protocol
              </h4>
            </div>
            <Button
              onClick={runPfp}
              size="sm"
              variant="outline"
              disabled={pfpM.isPending || (!result && !latestArtifact)}
              className="font-mono text-xs gap-1.5"
              data-testid="f8-pfp-run"
            >
              <Radar className="h-3.5 w-3.5" />
              {pfpM.isPending ? "SCANNING..." : "RUN DRIFT CHECK"}
            </Button>
          </div>
          {pfpError && <ErrorBanner message={pfpError} />}
          {pfp ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground">VERDICT </span>
                  <span className={`font-bold uppercase ${VERDICT_COLOR[pfp.verdict] ?? ""}`}>
                    {pfp.verdict}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">FCI </span>
                  <span className="font-bold">{pfp.fci}/100</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["critical", "high", "medium", "low"] as const).map((sev) => (
                    <span
                      key={sev}
                      className={`px-1.5 py-0.5 rounded border text-[10px] uppercase ${SEVERITY_COLOR[sev]}`}
                    >
                      {sev.charAt(0)} {pfp.counts[sev]}
                    </span>
                  ))}
                </div>
              </div>
              <p className="font-mono text-xs text-foreground/80">{pfp.summary}</p>
              {pfp.findings.length > 0 && (
                <div className="border border-border/40 rounded divide-y divide-border/40 max-h-[260px] overflow-auto">
                  {pfp.findings.map((f, i) => (
                    <div key={i} className="p-2.5 font-mono text-[11px] space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[9px] uppercase ${SEVERITY_COLOR[f.severity]}`}
                        >
                          {f.severity}
                        </span>
                        <span className="text-secondary font-bold">{f.code}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground/70">{f.pddRef || "—"}</span>
                        {f.codeRef && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground/70">{f.codeRef}</span>
                          </>
                        )}
                      </div>
                      <div className="text-foreground/80 leading-relaxed">{f.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              {result || latestArtifact
                ? "Cross-references the certified MVP PDD against the scaffolded codebase bundle. Critical findings hard-block further F8 runs until acknowledged."
                : "Run Code DJ once to produce a bundle, then drift-check it against the MVP PDD."}
            </p>
          )}
        </Card>

        {result ? (
          <Card className="p-5 bg-card/50 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display text-lg tracking-wider text-secondary">
                  {result.manifest.framework}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {result.files.length} files · entry{" "}
                  <span className="text-foreground">
                    {result.manifest.entrypoint}
                  </span>{" "}
                  · deploy → {result.manifest.deployTarget}
                </div>
                {latestArtifact?.provider && (
                  <div className="mt-2">
                    <GeneratedBy
                      provider={latestArtifact.provider}
                      modelId={latestArtifact.modelId}
                      testId="f8-generated-by"
                    />
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadBundle}
                data-testid="f8-download"
                className="gap-2 font-mono text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                EXPORT BUNDLE
              </Button>
            </div>

            <Tabs defaultValue="files" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger
                  value="files"
                  className="font-mono text-[10px] uppercase"
                >
                  Files
                </TabsTrigger>
                <TabsTrigger
                  value="manifest"
                  className="font-mono text-[10px] uppercase"
                >
                  Manifest
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="font-mono text-[10px] uppercase"
                >
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="files"
                className="flex-1 min-h-0 mt-3 grid grid-cols-[220px_1fr] gap-3"
              >
                <div className="border border-border/40 rounded bg-background/30 overflow-auto">
                  {result.files.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFile(f.path)}
                      className={`w-full text-left px-2 py-1.5 font-mono text-[11px] flex items-center gap-1.5 border-l-2 ${
                        f.path === activeFile
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-transparent hover:bg-muted/30 text-foreground/80"
                      }`}
                      data-testid={`f8-file-${f.path}`}
                    >
                      <FileCode className="h-3 w-3 shrink-0" />
                      <span className="truncate" title={f.path}>
                        {f.path}
                      </span>
                    </button>
                  ))}
                </div>
                <pre className="border border-border/40 rounded bg-background/40 p-3 overflow-auto font-mono text-[11px] text-foreground/90 whitespace-pre">
                  {activeFileContent?.content ?? "// select a file"}
                </pre>
              </TabsContent>

              <TabsContent value="manifest" className="mt-3">
                <pre className="whitespace-pre-wrap font-mono text-xs p-3 bg-background/40 rounded border border-border/40">
                  {JSON.stringify(result.manifest, null, 2)}
                </pre>
              </TabsContent>

              <TabsContent value="notes" className="mt-3">
                <p className="font-mono text-xs text-foreground/80 whitespace-pre-wrap">
                  {result.notes || "— no operator notes returned —"}
                </p>
              </TabsContent>
            </Tabs>
          </Card>
        ) : (
          <Card className="p-10 bg-card/50 flex-1 flex items-center justify-center text-center">
            <div>
              <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground">
                Code DJ idle — pick a certified MVP PDD, choose a platform, and
                spin.
              </p>
            </div>
          </Card>
        )}
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        message="F8 Code DJ requires Architect tier — upgrade to scaffold a full codebase from your certified MVP PDD."
      />
    </WorkspaceShell>
  );
}
