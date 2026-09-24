import { useEffect, useMemo, useState } from "react";
import {
  useHarnessF6Vdj,
  useHarnessF8Hdj,
  ArtifactType,
  type HarnessArtifact,
  type VdjRecommendation,
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
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { useToast } from "@/hooks/use-toast";
import { extractApiError } from "@/lib/sse";
import { exportBuildInstructions } from "@/lib/buildInstructionsExport";
import { Download, Music2, Rocket, Wrench } from "lucide-react";
import { buildArtifactFilename } from "@workspace/artifact-naming";

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

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

export function F6VdjBuild({ sessionId, artifacts }: Props) {
  const { toast } = useToast();

  const atlasPddSources = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.ATLAS_PDD)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const certifiedMvpSources = useMemo(
    () =>
      artifacts
        .filter(
          (a) =>
            a.artifactType === ArtifactType.MVP_PDD &&
            !!(a as HarnessArtifact & { spartanCert?: unknown }).spartanCert,
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const [vdjSourceId, setVdjSourceId] = useState<string>(
    atlasPddSources[0]?.id ?? "",
  );
  const [hostSourceId, setHostSourceId] = useState<string>(
    certifiedMvpSources[0]?.id ?? "",
  );
  const [vdj, setVdj] = useState<VdjRecommendation | undefined>();
  const [hostPlan, setHostPlan] = useState<HostingPlan | undefined>();
  const [vdjError, setVdjError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);
  const [vdjProvider, setVdjProvider] = useState<OverrideValue>("session");
  const [hostProvider, setHostProvider] = useState<OverrideValue>("session");

  // Artifacts load asynchronously; default each selector to the latest valid
  // source once it arrives, and reset if the current selection disappears.
  useEffect(() => {
    if (!atlasPddSources.some((a) => a.id === vdjSourceId)) {
      setVdjSourceId(atlasPddSources[0]?.id ?? "");
    }
  }, [atlasPddSources, vdjSourceId]);

  useEffect(() => {
    if (!certifiedMvpSources.some((a) => a.id === hostSourceId)) {
      setHostSourceId(certifiedMvpSources[0]?.id ?? "");
    }
  }, [certifiedMvpSources, hostSourceId]);

  const vdjM = useHarnessF6Vdj({
    mutation: {
      onSuccess: (data) => {
        setVdj(data);
        setVdjError(null);
      },
      onError: (e) => {
        const err = extractApiError(e);
        if (err.status === 402 || err.status === 403) {
          setCostCap(err.status === 402);
          setUpgrade(true);
        }
        setVdjError(err.message);
      },
    },
  });

  const hostM = useHarnessF8Hdj({
    mutation: {
      onSuccess: (data) => {
        setHostPlan(data);
        setHostError(null);
      },
      onError: (e) => {
        const err = extractApiError(e);
        if (err.status === 402 || err.status === 403) {
          setCostCap(err.status === 402);
          setUpgrade(true);
        }
        setHostError(err.message);
      },
    },
  });

  const recommendVdj = () => {
    if (!vdjSourceId) {
      setVdjError("Pick an ATLAS PDD source first");
      return;
    }
    setVdjError(null);
    vdjM.mutate({
      data: {
        sessionId,
        pddArtifactId: vdjSourceId,
        ...overrideToBody(vdjProvider),
      },
    });
  };

  const planHosting = () => {
    if (!hostSourceId) {
      setHostError("Pick a certified MVP PDD source first");
      return;
    }
    setHostError(null);
    hostM.mutate({
      data: {
        sessionId,
        mvpPddArtifactId: hostSourceId,
        ...overrideToBody(hostProvider),
      },
    });
  };

  const exportBrief = async () => {
    try {
      const source = artifacts.find(
        (artifact) => artifact.id === (vdjSourceId || hostSourceId),
      );
      await exportBuildInstructions(
        sessionId,
        vdj,
        hostPlan,
        source?.name ?? "BUILD INSTRUCTIONS",
        source?.id ?? sessionId,
      );
      toast({
        title: "BUILD INSTRUCTIONS exported",
        description: "VIBE ORACLE + HOST ORACLE brief downloaded as a ZIP.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not build the export ZIP.",
        variant: "destructive",
      });
    }
  };

  if (!atlasPddSources.length && !certifiedMvpSources.length) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="BUILD INSTRUCTIONS"
          body="This page mixes the VIBE ORACLE build-environment recommendation (from an ATLAS PDD) and the HOST ORACLE hosting plan (from a certified MVP PDD)."
          hint="Draft an F6 ATLAS PDD and certify an F7 MVP PDD first"
        />
      </WorkspaceShell>
    );
  }

  const canExport = !!vdj || !!hostPlan;

  return (
    <WorkspaceShell
      toolbar={
        <Button
          onClick={exportBrief}
          size="sm"
          variant="outline"
          disabled={!canExport}
          className="font-mono text-xs gap-1.5"
          data-testid="build-instructions-export"
        >
          <Download className="h-3.5 w-3.5" />
          EXPORT
        </Button>
      }
    >
      <div className="grid lg:grid-cols-2 gap-4">
        {/* VIBE ORACLE */}
        <Card className="p-5 bg-card/50 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Music2 className="h-4 w-4 text-secondary" />
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
              VIBE ORACLE · Build Environment (F6-VDJ)
            </h4>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Select value={vdjSourceId} onValueChange={setVdjSourceId}>
              <SelectTrigger
                className="font-mono text-xs h-8 flex-1 min-w-[160px]"
                data-testid="vdj-source-select"
              >
                <SelectValue placeholder="Select an ATLAS PDD" />
              </SelectTrigger>
              <SelectContent>
                {atlasPddSources.map((a, i) => (
                  <SelectItem key={a.id} value={a.id} className="font-mono text-xs">
                    ATLAS PDD {a.id.slice(0, 8)}
                    {i === 0 ? " · latest" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProviderOverride
              value={vdjProvider}
              onChange={setVdjProvider}
              disabled={vdjM.isPending}
              testId="vdj-provider"
            />
            <Button
              onClick={recommendVdj}
              size="sm"
              variant="outline"
              disabled={vdjM.isPending || !atlasPddSources.length}
              className="font-mono text-xs"
              data-testid="vdj-run"
            >
              {vdjM.isPending ? "MIXING..." : "RECOMMEND"}
            </Button>
          </div>
          {vdjError && <ErrorBanner message={vdjError} />}
          {vdj ? (
            <div className="space-y-3" data-testid="vdj-result">
              <div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  Recommended IDE
                </div>
                <div className="font-display text-xl tracking-wider text-primary">
                  {vdj.recommendedIde}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  Recommended VIBE
                </div>
                <div className="font-display text-xl tracking-wider text-secondary">
                  {vdj.recommendedVibe}
                </div>
              </div>
              <p className="font-mono text-xs text-foreground/80 leading-relaxed">
                {vdj.rationale}
              </p>
              {vdj.alternatives?.length ? (
                <div className="pt-2 border-t border-border/40">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground mb-2">
                    Alternatives
                  </div>
                  <div className="space-y-1">
                    {vdj.alternatives.map((a) => (
                      <div
                        key={a.name}
                        className="flex items-center justify-between font-mono text-xs"
                      >
                        <span>{a.name}</span>
                        <span className="text-muted-foreground">
                          {Math.round(a.fit * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center font-mono text-xs text-muted-foreground py-8">
              {atlasPddSources.length
                ? "Pick an ATLAS PDD then request a VIBE recommendation."
                : "Draft an F6 ATLAS PDD first."}
            </div>
          )}
        </Card>

        {/* HOST ORACLE */}
        <Card className="p-5 bg-card/50 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="h-4 w-4 text-primary" />
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              HOST ORACLE · Hosting Plan (F8-HDJ)
            </h4>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Select value={hostSourceId} onValueChange={setHostSourceId}>
              <SelectTrigger
                className="font-mono text-xs h-8 flex-1 min-w-[160px]"
                data-testid="hdj-source-select"
              >
                <SelectValue placeholder="Select a certified MVP PDD" />
              </SelectTrigger>
              <SelectContent>
                {certifiedMvpSources.map((a, i) => (
                  <SelectItem key={a.id} value={a.id} className="font-mono text-xs">
                    MVP PDD {a.id.slice(0, 8)}
                    {i === 0 ? " · latest" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProviderOverride
              value={hostProvider}
              onChange={setHostProvider}
              disabled={hostM.isPending}
              testId="hdj-provider"
            />
            <Button
              onClick={planHosting}
              size="sm"
              variant="outline"
              disabled={hostM.isPending || !certifiedMvpSources.length}
              className="font-mono text-xs"
              data-testid="hdj-run"
            >
              {hostM.isPending ? "PLANNING..." : "PLAN HOSTING"}
            </Button>
          </div>
          {hostError && <ErrorBanner message={hostError} />}
          {hostPlan ? (
            <div className="space-y-3" data-testid="hdj-result">
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

              <div className="border border-border/40 rounded divide-y divide-border/40 max-h-[180px] overflow-auto">
                {hostPlan.hse.map((row, i) => (
                  <div
                    key={row.platform}
                    className="p-2 font-mono text-[11px] flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4">{i + 1}.</span>
                      <span
                        className={
                          i === 0
                            ? "text-emerald-400 font-bold"
                            : "text-foreground/80"
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
            <div className="flex-1 flex items-center justify-center text-center font-mono text-xs text-muted-foreground py-8">
              {certifiedMvpSources.length
                ? "Pick a certified MVP PDD then plan hosting."
                : "Certify an F7 MVP PDD first."}
            </div>
          )}
        </Card>
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="BUILD INSTRUCTIONS (VIBE ORACLE + HOST ORACLE) requires the relevant tier or an active escalation."
      />
    </WorkspaceShell>
  );
}
