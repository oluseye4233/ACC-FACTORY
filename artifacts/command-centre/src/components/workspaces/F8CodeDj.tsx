import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF8,
  useHarnessF8Hdj,
  useHarnessPfp,
  getListSessionArtifactsQueryKey,
  ArtifactType,
  CodeDjPlatform,
  type HarnessArtifact,
  type CodebaseBundle,
  type PfpReport,
  type HostingPlan,
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
import { exportCodeDjBundle, SUPPORTED_IDES } from "@/lib/codeDjExport";
import { PushToGitHubButton } from "@/components/shared/PushToGitHubButton";
import { AlertTriangle, Cpu, Download, FileCode, Radar, Rocket, ShieldCheck } from "lucide-react";

const HOST_LABELS: Record<string, string> = {
  "replit-deployments": "Replit Deployments",
  vercel: "Vercel",
  "fly-io": "Fly.io",
  render: "Render",
  railway: "Railway",
  "cloudflare-pages": "Cloudflare Pages",
  netlify: "Netlify",
  "aws-amplify": "AWS Amplify",
  "expo-eas": "Expo EAS",
};
const hostLabel = (p: string) => HOST_LABELS[p] ?? p;

const PLATFORM_LABELS: Record<CodeDjPlatform, string> = {
  [CodeDjPlatform["nextjs-vercel"]]: "Next.js → Vercel",
  [CodeDjPlatform["react-vite-static"]]: "React + Vite (static)",
  [CodeDjPlatform["express-replit"]]: "Express → Replit",
  [CodeDjPlatform["expo-mobile"]]: "Expo (mobile)",
  [CodeDjPlatform["pnpm-monorepo"]]: "pnpm monorepo",
};
type ArtifactClass = "SOFTWARE" | "FIRMWARE";
const ARTIFACT_CLASS_LABELS: Record<ArtifactClass, string> = {
  SOFTWARE: "Software",
  FIRMWARE: "Firmware",
};

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
  onComplete?: (artifactClass: ArtifactClass) => void;
}

export function F8CodeDj({ sessionId, artifacts, onComplete }: Props) {
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
            // Only SPARTAN-certified MVP PDDs are valid Code ORACLE sources.
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
  const [artifactClass, setArtifactClass] = useState<ArtifactClass | "">("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CodebaseBundle | undefined>();
  const [activeFile, setActiveFile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const [pfp, setPfp] = useState<PfpReport | undefined>();
  const [pfpError, setPfpError] = useState<string | null>(null);
  const [hostPlan, setHostPlan] = useState<HostingPlan | undefined>();
  const [hostError, setHostError] = useState<string | null>(null);
  const [acknowledgeDrift, setAcknowledgeDrift] = useState(false);
  const [driftGateBlock, setDriftGateBlock] = useState<{
    counts: { critical: number; high: number; medium: number; low: number };
    fci: number;
    verdict: string;
  } | null>(null);

  const mutation = useHarnessF8();
  const hostM = useHarnessF8Hdj({
    mutation: {
      onSuccess: (data) => {
        setHostPlan(data);
        setHostError(null);
        qc.invalidateQueries({
          queryKey: getListSessionArtifactsQueryKey(sessionId),
        });
      },
      onError: (e) => {
        const x = extractApiError(e);
        if (x.status === 402 || x.status === 403) {
          setCostCap(x.status === 402);
          setUpgrade(true);
        }
        setHostError(x.message);
      },
    },
  });
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
          body="Code ORACLE scaffolds a deploy-ready codebase from a SPARTAN-certified MVP PDD / PWDD. Run F7 first to certify a source."
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
    if (!artifactClass) {
      setError("Choose whether this artifact is Software or Firmware");
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
          artifactClass,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(acknowledgeDrift ? { acknowledgeDrift: true } : {}),
          ...overrideToBody(providerOverride),
        },
      })) as CodebaseBundle;
      setResult(out);
      setActiveFile(out.files[0]?.path ?? "");
      onComplete?.(artifactClass);
      qc.invalidateQueries({
        queryKey: getListSessionArtifactsQueryKey(sessionId),
      });
      toast({
        title: "CODE ORACLE COMPLETE",
        description: `${out.files.length} files scaffolded for ${PLATFORM_LABELS[out.platform]}`,
      });
    } catch (err) {
      const x = extractApiError(err);
      if (x.status === 402 || x.status === 403) {
        setCostCap(x.status === 402);
        setUpgrade(true);
      } else {
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
      setPfpError("Run Code ORACLE first to produce a codebase bundle");
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

  const runHostDj = async () => {
    if (!sourceId) {
      setHostError("Pick a certified MVP PDD source first");
      return;
    }
    setHostError(null);
    const bundleId = result?.artifactId ?? latestArtifact?.id;
    hostM.mutate({
      data: {
        sessionId,
        mvpPddArtifactId: sourceId,
        ...(bundleId ? { codebaseBundleArtifactId: bundleId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
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

  const downloadBundle = async () => {
    if (!result) return;
    // Ready-to-open project ZIP: the scaffold files at their real paths plus a
    // CODE ORACLE operating brief (AGENTS.md) and per-IDE adapter files, so the
    // bundle drops straight into Cursor / Replit / Codex / Claude Code / etc.
    // and the IDE's agent keeps building in fidelity to the certified spec.
    const source = certifiedMvpSources.find((s) => s.id === sourceId);
    try {
      await exportCodeDjBundle(result, source, pfp);
      toast({
        title: "BUNDLE EXPORTED",
        description: `Ready-to-open ZIP with AGENTS.md + ${SUPPORTED_IDES.length} IDE adapters`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "EXPORT FAILED",
        description: "Could not assemble the bundle ZIP",
      });
    }
  };

  const activeFileContent = result?.files.find((f) => f.path === activeFile);

  // Surface an existing GitHub push (persisted on the bundle artifact) so the
  // button reflects an "already on GitHub" state across reloads.
  const existingGithubRepo = useMemo(() => {
    const bundleId = result?.artifactId ?? latestArtifact?.id;
    const art = artifacts.find((a) => a.id === bundleId);
    const repo = (art?.artifactContent as { githubRepo?: unknown } | null)
      ?.githubRepo as
      | {
          fullName?: string;
          htmlUrl?: string;
          replitImportUrl?: string;
          pushedAt?: string;
        }
      | undefined;
    if (!repo?.fullName || !repo.htmlUrl || !repo.replitImportUrl) return null;
    return {
      fullName: repo.fullName,
      htmlUrl: repo.htmlUrl,
      replitImportUrl: repo.replitImportUrl,
      pushedAt: repo.pushedAt,
    };
  }, [artifacts, result?.artifactId, latestArtifact?.id]);

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="grid gap-3 mb-3 md:grid-cols-3">
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
                Artifact type
              </label>
              <Select
                value={artifactClass}
                onValueChange={(value) => setArtifactClass(value as ArtifactClass)}
              >
                <SelectTrigger data-testid="f8-artifact-class" className="font-mono text-xs">
                  <SelectValue placeholder="Choose Software or Firmware" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ARTIFACT_CLASS_LABELS) as ArtifactClass[]).map((value) => (
                    <SelectItem key={value} value={value} className="font-mono text-xs">
                      {value === "SOFTWARE" ? "1. " : "2. "}
                      {ARTIFACT_CLASS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                Software skips F9 and continues to F10/F11. Firmware requires F9.
              </p>
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
              disabled={mutation.isPending || !artifactClass}
              className="font-display tracking-wider gap-2"
            >
              <Cpu className="h-4 w-4" />
              {mutation.isPending ? "SCAFFOLDING..." : "RUN CODE ORACLE"}
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
                : "Run Code ORACLE once to produce a bundle, then drift-check it against the MVP PDD."}
            </p>
          )}
        </Card>

        {/* HOST ORACLE — F8-HDJ: hosting plan, the final advisory step before publish */}
        <Card className="p-5 bg-card/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                HOST ORACLE · Hosting Plan (pre-publish)
              </h4>
            </div>
            <Button
              onClick={runHostDj}
              size="sm"
              variant="outline"
              disabled={hostM.isPending}
              className="font-mono text-xs gap-1.5"
              data-testid="f8-hdj-run"
            >
              <Rocket className="h-3.5 w-3.5" />
              {hostM.isPending ? "PLANNING..." : "PLAN HOSTING"}
            </Button>
          </div>
          {hostError && <ErrorBanner message={hostError} />}
          {hostPlan ? (
            <div className="space-y-3" data-testid="f8-hdj-result">
              <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground">PRIMARY </span>
                  <span className="font-bold text-emerald-400">
                    {hostLabel(hostPlan.primary.platform)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {hostPlan.primary.score.toFixed(1)}/100
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">FALLBACK </span>
                  <span className="font-bold text-amber-400">
                    {hostLabel(hostPlan.fallback.platform)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">JCSE </span>
                  <span className="font-bold">{hostPlan.jcse}/100</span>
                </div>
              </div>

              <p className="font-mono text-xs text-foreground/80">
                {hostPlan.hrp.summary}
              </p>

              {/* HSE ranking matrix */}
              <div className="border border-border/40 rounded divide-y divide-border/40 max-h-[200px] overflow-auto">
                {hostPlan.hse.map((row, i) => (
                  <div
                    key={row.platform}
                    className="p-2 font-mono text-[11px] flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4">{i + 1}.</span>
                      <span
                        className={
                          i === 0 ? "text-emerald-400 font-bold" : "text-foreground/80"
                        }
                      >
                        {hostLabel(row.platform)}
                      </span>
                    </span>
                    <span className="text-foreground/70">
                      {row.weightedTotal.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Deployment journey */}
              {hostPlan.journey.phases.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Journey · {hostPlan.journey.tier}
                  </div>
                  <ol className="space-y-1">
                    {hostPlan.journey.phases.map((ph, i) => (
                      <li
                        key={i}
                        className="font-mono text-[11px] text-foreground/80"
                      >
                        <span className="text-primary">{i + 1}.</span>{" "}
                        <span className="font-bold">{ph.name}</span> — {ph.detail}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Self-deploy factory: env template (keys only) */}
              {hostPlan.sdf.envTemplate.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Env template (names only — no values)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {hostPlan.sdf.envTemplate.map((e) => (
                      <span
                        key={e.key}
                        title={e.description}
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                          e.required
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/40 bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        {e.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              Ranks deployment hosts (HSE 8-criterion matrix), maps the
              deployment journey, and drafts self-deploy artifacts from your
              certified MVP PDD — the last advisory pass before you publish.
              Replit Deployments is the HARNESS-certified default.
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
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadBundle}
                    data-testid="f8-download"
                    className="gap-2 font-mono text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    SEND TO IDE
                  </Button>
                  <PushToGitHubButton
                    bundle={result}
                    source={certifiedMvpSources.find((s) => s.id === sourceId)}
                    pfp={pfp}
                    existing={existingGithubRepo}
                  />
                </div>
                <span
                  className="font-mono text-[9px] text-muted-foreground text-right max-w-[240px] leading-tight"
                  data-testid="f8-ide-hint"
                >
                  ZIP + AGENTS.md. Each IDE reads:{" "}
                  {SUPPORTED_IDES.map(
                    (i) => `${i.ide.split(" ")[0]} → ${i.file}`,
                  ).join("; ")}
                </span>
              </div>
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
                Code ORACLE idle — pick a certified MVP PDD, choose a platform, and
                spin.
              </p>
            </div>
          </Card>
        )}
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="F8 Code ORACLE requires Architect tier — upgrade to scaffold a full codebase from your certified MVP PDD."
      />
    </WorkspaceShell>
  );
}
