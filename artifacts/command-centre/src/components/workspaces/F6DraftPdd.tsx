import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF6,
  useHarnessF6Vdj,
  useHarnessAtlasCrystallise,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  AtlasPdd,
  AtlasPddJson,
  VdjRecommendation,
  HarnessArtifact,
  ArtifactType,
  HarnessF6InputMode,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { WorkspaceShell, ErrorBanner } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { extractApiError } from "@/lib/sse";
import { downloadZip } from "@/lib/zipExport";
import { Download, Layers, Sparkles } from "lucide-react";

const PHASES = ["AUDIT", "TRIANGULATE", "LAYOUT", "ASSEMBLE", "STAMP"] as const;

const TABS = [
  { k: "cheatSheet", label: "Cheat Sheet" },
  { k: "execSummary", label: "Exec Summary" },
  { k: "worksheet", label: "Worksheet" },
  { k: "implementation", label: "Implementation" },
  { k: "atlasJson", label: "ATLAS J" },
] as const;

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

export function F6DraftPdd({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();

  const spcSources = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.SPC)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const pddArtifacts = useMemo(
    () => artifacts.filter((a) => a.artifactType === ArtifactType.ATLAS_PDD),
    [artifacts],
  );

  const latestPddArtifact = useMemo(
    () =>
      pddArtifacts
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [pddArtifacts],
  );

  const [mode, setMode] = useState<HarnessF6InputMode>(
    spcSources.length ? HarnessF6InputMode.FROM_SPC : HarnessF6InputMode.FRESH,
  );
  const [sourceId, setSourceId] = useState<string>(spcSources[0]?.id || "");
  const [brief, setBrief] = useState("");
  const [pdd, setPdd] = useState<AtlasPdd | undefined>();
  const [pddArtifactId, setPddArtifactId] = useState<string | null>(null);
  const [vdj, setVdj] = useState<VdjRecommendation | undefined>();
  const [atlasJson, setAtlasJson] = useState<AtlasPddJson | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const [vdjProviderOverride, setVdjProviderOverride] =
    useState<OverrideValue>("session");

  const f6 = useHarnessF6({
    mutation: {
      onSuccess: (data) => {
        setPdd(data);
        setPddArtifactId(data.artifactId ?? null);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
      },
      onError: (e) => {
        const err = extractApiError(e);
        if (err.status === 403) setUpgrade(true);
        else setError(err.message);
      },
    },
  });

  const vdjM = useHarnessF6Vdj({
    mutation: {
      onSuccess: (data) => setVdj(data),
      onError: (e) => setError(extractApiError(e).message),
    },
  });

  const crystallise = useHarnessAtlasCrystallise({
    mutation: {
      onSuccess: (data) => {
        setAtlasJson(data);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
      },
      onError: (e) => setError(extractApiError(e).message),
    },
  });

  const runCrystallise = () => {
    const id =
      pddArtifactId ||
      pddArtifacts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]?.id;
    if (!id) {
      setError("Draft a PDD first before crystallising");
      return;
    }
    crystallise.mutate({ data: { sessionId, atlasPddArtifactId: id } });
  };

  const draft = () => {
    setError(null);
    if (mode === HarnessF6InputMode.FROM_SPC) {
      if (!sourceId) {
        setError("Pick an SPC source");
        return;
      }
      f6.mutate({
        data: {
          sessionId,
          mode,
          sourceArtifactId: sourceId,
          ...overrideToBody(providerOverride),
        },
      });
    } else {
      if (!brief.trim()) {
        setError("Brief required for FRESH mode");
        return;
      }
      f6.mutate({
        data: {
          sessionId,
          mode,
          brief,
          ...overrideToBody(providerOverride),
        },
      });
    }
  };

  const recommendVdj = () => {
    const id =
      pddArtifactId ||
      pddArtifacts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]?.id;
    if (!id) {
      setError("No PDD artifact available");
      return;
    }
    vdjM.mutate({
      data: { sessionId, pddArtifactId: id, ...overrideToBody(vdjProviderOverride) },
    });
  };

  const exportZip = async () => {
    if (!pdd) return;
    const files: Record<string, string> = {
      "cheat-sheet.md": pdd.cheatSheet,
      "exec-summary.md": pdd.execSummary,
      "worksheet.md": pdd.worksheet,
      "implementation.md": pdd.implementation,
    };
    if (vdj) {
      files["vdj-recommendation.md"] =
        `# VDJ Recommendation\n\n**IDE:** ${vdj.recommendedIde}\n**VIBE:** ${vdj.recommendedVibe}\n\n${vdj.rationale}\n\n## Alternatives\n\n${(vdj.alternatives || []).map((a) => `- ${a.name} (${Math.round(a.fit * 100)}%)`).join("\n")}`;
    }
    await downloadZip(`atlas-pdd-${sessionId.slice(0, 8)}.zip`, files);
  };

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Mode
              </label>
              <Select value={mode} onValueChange={(v) => setMode(v as HarnessF6InputMode)}>
                <SelectTrigger data-testid="f6-mode" className="font-mono text-xs w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HarnessF6InputMode.FROM_SPC}>FROM SPC</SelectItem>
                  <SelectItem value={HarnessF6InputMode.FRESH}>FRESH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === HarnessF6InputMode.FROM_SPC ? (
              <div className="flex-1 min-w-[240px]">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Source SPC
                </label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger className="font-mono text-xs" data-testid="f6-source">
                    <SelectValue placeholder={spcSources.length ? "Pick SPC" : "No SPC yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {spcSources.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                        {s.id.slice(0, 8)} · {new Date(s.createdAt).toLocaleTimeString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex-1 min-w-[240px]">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Fresh Brief
                </label>
                <Textarea
                  data-testid="f6-brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Describe the product to be drafted into an ATLAS PDD..."
                  className="font-mono text-xs min-h-[80px] bg-background/50"
                />
              </div>
            )}
            <ProviderOverride
              value={providerOverride}
              onChange={setProviderOverride}
              disabled={f6.isPending}
              testId="f6-provider"
            />
            <Button
              data-testid="f6-draft"
              onClick={draft}
              disabled={f6.isPending}
              className="font-display tracking-wider"
            >
              {f6.isPending ? "DRAFTING..." : "DRAFT PDD"}
            </Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        <Card className="p-3 bg-card/50">
          <div className="flex items-center gap-2">
            {PHASES.map((p, i) => {
              const done = !!pdd && i < PHASES.length;
              const active = f6.isPending && !pdd;
              return (
                <div key={p} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-1 flex-1 rounded ${
                      done ? "bg-primary" : active ? "bg-secondary/60" : "bg-muted"
                    }`}
                  />
                  <span
                    className={`font-mono text-[9px] uppercase ${
                      done ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {p}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 flex-1 min-h-0">
          <Card className="p-5 bg-card/50 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                  4-Part ATLAS PDD
                </h4>
                {pdd && latestPddArtifact?.provider && (
                  <GeneratedBy
                    provider={latestPddArtifact.provider}
                    modelId={latestPddArtifact.modelId}
                    testId="f6-generated-by"
                  />
                )}
              </div>
              {pdd && (
                <Button
                  onClick={exportZip}
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs"
                  data-testid="f6-export"
                >
                  <Download className="h-3 w-3 mr-1" /> EXPORT
                </Button>
              )}
            </div>
            {pdd ? (
              <Tabs defaultValue="cheatSheet" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-5">
                  {TABS.map((t) => (
                    <TabsTrigger
                      key={t.k}
                      value={t.k}
                      className="font-mono text-[10px] uppercase"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {TABS.filter((t) => t.k !== "atlasJson").map((t) => (
                  <TabsContent key={t.k} value={t.k} className="flex-1 min-h-0 mt-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90 h-full overflow-auto p-3 bg-background/40 rounded border border-border/40">
                      {pdd[t.k as "cheatSheet" | "execSummary" | "worksheet" | "implementation"]}
                    </pre>
                  </TabsContent>
                ))}
                <TabsContent value="atlasJson" className="flex-1 min-h-0 mt-3 flex flex-col">
                  {atlasJson ? (
                    <div className="flex-1 flex flex-col min-h-0 gap-2">
                      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span>
                          {atlasJson.prompts.length} prompts · {atlasJson.stack.length} stack ·{" "}
                          {atlasJson.routes.length} routes · {atlasJson.schemaVersion}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-[10px] h-6"
                          onClick={runCrystallise}
                          disabled={crystallise.isPending}
                          data-testid="f6-recrystallise"
                        >
                          RE-CRYSTALLISE
                        </Button>
                      </div>
                      <pre className="whitespace-pre font-mono text-[11px] leading-relaxed text-foreground/90 flex-1 overflow-auto p-3 bg-background/40 rounded border border-border/40">
                        {JSON.stringify(atlasJson, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 font-mono text-xs text-muted-foreground">
                      <Sparkles className="h-8 w-8 opacity-30" />
                      <div>
                        Crystallise the 4-Part PDD into a typed JSON layer
                        <br />
                        (stable prompt ids, stack, routes — feeds F8 + PFP).
                      </div>
                      <Button
                        onClick={runCrystallise}
                        disabled={crystallise.isPending}
                        size="sm"
                        className="font-mono text-xs gap-1.5"
                        data-testid="f6-crystallise"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {crystallise.isPending ? "CRYSTALLISING..." : "CRYSTALLISE"}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 flex items-center justify-center font-mono text-xs text-muted-foreground">
                <Layers className="h-8 w-8 mr-3 opacity-30" />
                4-Part PDD awaiting draft.
              </div>
            )}
          </Card>

          <Card className="p-5 bg-card/50 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                VIBE DJ
              </h4>
              <div className="flex items-center gap-2">
                <ProviderOverride
                  value={vdjProviderOverride}
                  onChange={setVdjProviderOverride}
                  disabled={vdjM.isPending}
                  testId="f6vdj-provider"
                />
                <Button
                  onClick={recommendVdj}
                  size="sm"
                  variant="outline"
                  disabled={vdjM.isPending || (!pddArtifactId && !pddArtifacts.length)}
                  className="font-mono text-xs"
                  data-testid="f6-vdj"
                >
                  {vdjM.isPending ? "MIXING..." : "RECOMMEND"}
                </Button>
              </div>
            </div>
            {vdj ? (
              <div className="space-y-3">
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
              <div className="flex-1 flex items-center justify-center text-center font-mono text-xs text-muted-foreground">
                Draft a PDD then request a VIBE recommendation.
              </div>
            )}
          </Card>
        </div>
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        message="F6 PDD Drafter requires Practitioner tier or an active escalation."
      />
    </WorkspaceShell>
  );
}
