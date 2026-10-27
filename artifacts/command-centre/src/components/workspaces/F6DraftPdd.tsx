import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessAtlasCrystallise,
  getHarnessF6DraftStreamUrl,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  AtlasPdd,
  AtlasPddJson,
  HarnessArtifact,
  ArtifactType,
  HarnessF6InputMode,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { PublishDocumentLink } from "@/components/shared/PublishDocumentLink";
import { SaveToExemplarLibraryButton } from "@/components/shared/SaveToExemplarLibraryButton";
import { WorkspaceShell, ErrorBanner } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { streamSse, extractApiError } from "@/lib/sse";
import { downloadZip } from "@/lib/zipExport";
import { Download, Layers, Sparkles } from "lucide-react";

import { Atlas360ViewPanel } from "./Atlas360ViewPanel";
import { buildArtifactFilename } from "@workspace/artifact-naming";
import { ColonizationTargetSelect, type ColonizationTarget } from "./ColonizationTargetSelect";

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
  sessionOrigin?: import("@workspace/api-client-react").HarnessSessionOrigin;
  artifacts: HarnessArtifact[];
}

export function F6DraftPdd({ sessionId, sessionOrigin, artifacts }: Props) {
  const qc = useQueryClient();

  const spcSources = useMemo(
    () =>
      artifacts
        .filter((a) => a.featureId === 5 &&
          (a.artifactType === ArtifactType.SPC || a.artifactType === ArtifactType.ATLAS_360_SCAN_VIEW))
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

  const mode = HarnessF6InputMode.FROM_F5;
  const [sourceId, setSourceId] = useState<string>(spcSources[0]?.id || "");
  const [colonizationTarget, setColonizationTarget] = useState<ColonizationTarget>("UNDECIDED");
  const [pdd, setPdd] = useState<AtlasPdd | undefined>();
  const [pddArtifactId, setPddArtifactId] = useState<string | null>(null);
  const [atlasJson, setAtlasJson] = useState<AtlasPddJson | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftPhase, setDraftPhase] = useState(-1);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);


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

  const draft = async () => {
    setError(null);
    let body: Record<string, unknown>;
    if (mode === HarnessF6InputMode.FROM_F5) {
      if (!sourceId) {
        setError("Select an F5 SPC or ATLAS 360 SCAN artifact");
        return;
      }
      body = { sessionId, mode, sourceArtifactId: sourceId, colonizationTarget, ...overrideToBody(providerOverride) };
    } else {
      return;
    }

    // The 4-part draft is the heavy LLM call; stream it over SSE so the proxy
    // doesn't abort a multi-minute generation (the 502 failure mode).
    // Clear prior output so the phase bar reflects the active run, not a stale PDD.
    setPdd(undefined);
    setPddArtifactId(null);
    setAtlasJson(undefined);
    setDrafting(true);
    setDraftPhase(-1);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getHarnessF6DraftStreamUrl(),
        body,
        (e) => {
          if (e.event === "step") {
            const d = e.data as { index?: number };
            if (typeof d.index === "number") setDraftPhase(d.index);
          } else if (e.event === "complete") {
            const built = e.data as AtlasPdd;
            setPdd(built);
            setPddArtifactId(built.artifactId ?? null);
            setDraftPhase(PHASES.length - 1);
            qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
            qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
          } else if (e.event === "error") {
            const d = e.data as { error?: string };
            setError(d.error || "Draft failed");
          }
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const x = extractApiError(err);
        if (x.status === 402 || x.status === 403) {
          setCostCap(x.status === 402);
          setUpgrade(true);
        } else setError(x.message);
      }
    } finally {
      setDrafting(false);
    }
  };

  const exportZip = async () => {
    if (!pdd) return;
    const files: Record<string, string> = {
      "cheat-sheet.md": pdd.cheatSheet,
      "exec-summary.md": pdd.execSummary,
      "worksheet.md": pdd.worksheet,
      "implementation.md": pdd.implementation,
    };
    const artifactId = pddArtifactId ?? latestPddArtifact?.id ?? sessionId;
    const filename = buildArtifactFilename({
      type: "ATLAS_PDD",
      title: latestPddArtifact?.name ?? "ATLAS PDD",
      id: artifactId,
      extension: "zip",
    });
    await downloadZip(filename, files);
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
              <Select value={mode} disabled>
                <SelectTrigger data-testid="f6-mode" className="font-mono text-xs w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HarnessF6InputMode.FROM_F5}>FROM F5 ARTIFACT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(
              <div className="flex-1 min-w-[240px]">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Source F5 artifact
                </label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger className="font-mono text-xs" data-testid="f6-source">
                    <SelectValue placeholder={spcSources.length ? "Choose F5 SPC or SCAN" : "Create an F5 SPC or SCAN first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {spcSources.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                        {s.name || String(s.artifactContent?.title || s.artifactContent?.name || (s.artifactType === ArtifactType.SPC ? "F5 SPC" : "ATLAS 360 SCAN"))} · {s.artifactType} · {s.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="min-w-[180px]">
              <ColonizationTargetSelect value={colonizationTarget} onChange={setColonizationTarget} disabled={drafting} testId="f6-colonization-target" />
            </div>
            <ProviderOverride
              value={providerOverride}
              onChange={setProviderOverride}
              disabled={drafting}
              testId="f6-provider"
            />
            <Button
              data-testid="f6-draft"
              onClick={draft}
              disabled={drafting || !spcSources.some(source => source.id === sourceId)}
              className="font-display tracking-wider"
            >
              {drafting ? "DRAFTING..." : "DRAFT PDD"}
            </Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        <Card className="p-3 bg-card/50">
          <div className="flex items-center gap-2">
            {PHASES.map((p, i) => {
              const done = !!pdd ? i < PHASES.length : drafting && i <= draftPhase;
              const active = drafting && !pdd && i === draftPhase + 1;
              return (
                <div key={p} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-1 flex-1 rounded ${
                      done
                        ? "bg-primary"
                        : active
                          ? "bg-secondary/60 animate-pulse"
                          : "bg-muted"
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

        <div className="grid gap-4 flex-1 min-h-0">
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
                <div className="flex flex-wrap gap-2">
                  {(pddArtifactId || latestPddArtifact?.id) && (
                    <><SaveToExemplarLibraryButton
                      artifactId={(pddArtifactId || latestPddArtifact?.id)!}
                    />
<PublishDocumentLink sourceId={(pddArtifactId || latestPddArtifact?.id)!} sourceKind="F6_PDD" sessionId={sessionId} />
</>
                  )}
                  <Button
                    onClick={exportZip}
                    size="sm"
                    variant="outline"
                    className="font-mono text-xs"
                    data-testid="f6-export"
                  >
                    <Download className="h-3 w-3 mr-1" /> EXPORT
                  </Button>
                </div>
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

        </div>

        {(pddArtifactId || latestPddArtifact?.id) && (
          <Atlas360ViewPanel
            sessionId={sessionId}
            sessionOrigin={sessionOrigin}
            sourceArtifactId={(pddArtifactId || latestPddArtifact?.id)!}
            artifacts={artifacts}
          />
        )}
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="F6 PDD Drafter requires Practitioner tier or an active escalation."
      />
    </WorkspaceShell>
  );
}
