import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getHarnessF7StreamUrl,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  MvpPdd,
  HarnessArtifact,
  ArtifactType,
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
import { CertTierChip } from "@/components/shared/CertTierChip";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { useToast } from "@/hooks/use-toast";
import { streamSse, extractApiError } from "@/lib/sse";
import { downloadZip } from "@/lib/zipExport";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Sparkles, ShieldCheck, Download } from "lucide-react";
import { SaveToExemplarLibraryButton } from "@/components/shared/SaveToExemplarLibraryButton";

import { Atlas360ViewPanel } from "./Atlas360ViewPanel";

const SPARTAN_STEPS = [
  "SCAN",
  "PROFILE",
  "ASSESS",
  "REDUCE",
  "TRANSFORM",
  "ZPOS+5",
  "PACKAGE",
] as const;

const COLORS = ["#1A6B3A", "#C9A227", "#9C2A2A"];

interface Props {
  sessionId: string;
  sessionOrigin?: import("@workspace/api-client-react").HarnessSessionOrigin;
  artifacts: HarnessArtifact[];
}

export function F7ConvertMvp({ sessionId, sessionOrigin, artifacts }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const pddSources = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.ATLAS_PDD)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const latestArtifact = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.MVP_PDD)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );

  const [sourceId, setSourceId] = useState<string>(pddSources[0]?.id || "");
  const [stepIdx, setStepIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MvpPdd | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!pddSources.length) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<ShieldCheck className="h-12 w-12" />}
          title="ATLAS PDD REQUIRED"
          body="SPARTAN compression converts an ATLAS PDD into a SPARTAN-certified MVP PDD with a public verification URL."
          hint="Run F6 to produce a draft ATLAS PDD first."
        />
      </WorkspaceShell>
    );
  }

  const run = async () => {
    if (!sourceId) {
      setError("Pick a source PDD");
      return;
    }
    setError(null);
    setRunning(true);
    setStepIdx(-1);
    setResult(undefined);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getHarnessF7StreamUrl(),
        {
          sessionId,
          pddArtifactId: sourceId,
          ...overrideToBody(providerOverride),
        },
        (e) => {
          if (e.event === "step") {
            const d = e.data as { name?: string; index?: number };
            if (typeof d.index === "number") setStepIdx(d.index);
            else if (d.name) {
              const i = SPARTAN_STEPS.indexOf(d.name as (typeof SPARTAN_STEPS)[number]);
              if (i >= 0) setStepIdx(i);
            }
          } else if (e.event === "complete") {
            const mvp = e.data as MvpPdd;
            setResult(mvp);
            setStepIdx(SPARTAN_STEPS.length - 1);
            qc.invalidateQueries({
              queryKey: getListSessionArtifactsQueryKey(sessionId),
            });
            qc.invalidateQueries({
              queryKey: getListFeatureStateQueryKey(sessionId),
            });
            toast({
              title: "COMMAND COMPLETE",
              description: `MVP PDD certified · ${mvp.cert.certId}`,
            });
          } else if (e.event === "error") {
            const d = e.data as { error?: string };
            setError(d.error || "Stream error");
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
      setRunning(false);
    }
  };

  const exportZip = async () => {
    if (!result) return;
    const files: Record<string, string> = {};
    for (const s of result.sections) {
      files[`${s.key}.md`] = `# ${s.title}\n\n${s.body}`;
    }
    files["certificate.json"] = JSON.stringify(result.cert, null, 2);
    const verifyUrl = `${window.location.origin}/verify?cert=${encodeURIComponent(result.cert.certId)}`;
    files["verification.md"] =
      `# SPARTAN Certification\n\n` +
      `- **Cert ID:** ${result.cert.certId}\n` +
      `- **Class:** ${result.cert.class}\n` +
      `- **CR_p:** ${result.cert.crP.toFixed(2)}\n` +
      `- **Issued:** ${new Date(result.cert.issuedAt).toISOString()}\n` +
      `- **FORGE VERIFIED:** ${result.forgeVerified ? "YES" : "NO"}\n` +
      (typeof result.mathmonScore === "number"
        ? `- **MATHMON score:** ${result.mathmonScore}\n`
        : "") +
      `\n## Public verification URL\n\n${verifyUrl}\n` +
      (result.forgeVerified && result.disclaimer
        ? `\n## Disclaimer\n\n${result.disclaimer}\n`
        : "");
    await downloadZip(`mvp-pdd-${sessionId.slice(0, 8)}.zip`, files);
  };

  const donutData = result?.donut
    ? [
        { name: "Class A", value: result.donut.a },
        { name: "Class B", value: result.donut.b },
        { name: "Class C", value: result.donut.c },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="grid md:grid-cols-[2fr_auto] gap-3 items-end">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Source ATLAS PDD
              </label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger data-testid="f7-source" className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pddSources.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                      {s.id.slice(0, 8)} · {new Date(s.createdAt).toLocaleTimeString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <ProviderOverride
                value={providerOverride}
                onChange={setProviderOverride}
              />
              <Button
                data-testid="f7-compress"
                onClick={run}
                disabled={running}
                className="font-display tracking-wider"
              >
                {running ? "COMPRESSING..." : "SPARTAN COMPRESS"}
              </Button>
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        <Card className="p-3 bg-card/50">
          <div className="flex items-center gap-1">
            {SPARTAN_STEPS.map((s, i) => {
              const done = i <= stepIdx;
              const active = running && i === stepIdx + 1;
              return (
                <div key={s} className="flex-1 flex items-center gap-1">
                  <div
                    className={`flex-1 h-8 rounded border flex items-center justify-center font-mono text-[10px] font-bold uppercase ${
                      done
                        ? "border-secondary bg-secondary/20 text-secondary"
                        : active
                          ? "border-primary bg-primary/20 text-primary animate-pulse"
                          : "border-border/40 bg-muted/20 text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                  {i < SPARTAN_STEPS.length - 1 && (
                    <div className={`w-2 h-px ${done ? "bg-secondary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {result ? (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
            <Card className="p-5 bg-card/50 flex flex-col items-center text-center">
              <Sparkles className="h-6 w-6 text-secondary mb-2" />
              <div className="font-display text-3xl tracking-wider text-secondary">
                CLASS {result.cert.class}
              </div>
              <div className="mt-1 mb-3">
                <CertTierChip tier={`CLASS ${result.cert.class}`} />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground break-all px-2">
                {result.cert.certId}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">
                CR_p · {result.cert.crP.toFixed(2)}
              </div>
              {result.forgeVerified ? (
                <div
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-secondary/60 bg-secondary/10 text-secondary"
                  data-testid="f7-forge-verified"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="font-display text-[11px] tracking-widest">
                    FORGE VERIFIED
                  </span>
                  {typeof result.mathmonScore === "number" ? (
                    <span className="font-mono text-[10px] opacity-80">
                      MM {result.mathmonScore}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div
                  className="mt-3 font-mono text-[10px] text-muted-foreground"
                  data-testid="f7-not-forge-verified"
                >
                  {typeof result.mathmonScore === "number"
                    ? `MATHMON ${result.mathmonScore} · not FORGE VERIFIED`
                    : "MATHMON not profiled · not FORGE VERIFIED"}
                </div>
              )}
              {latestArtifact?.provider && (
                <div className="mt-3">
                  <GeneratedBy
                    provider={latestArtifact.provider}
                    modelId={latestArtifact.modelId}
                    testId="f7-generated-by"
                  />
                </div>
              )}
              {latestArtifact?.id && (
                <div className="mt-3">
                  <SaveToExemplarLibraryButton artifactId={latestArtifact.id} />
                </div>
              )}
              {donutData.length > 0 && (
                <div className="w-full h-[180px] mt-4">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={donutData}
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <Button
                onClick={exportZip}
                size="sm"
                variant="outline"
                className="font-mono text-xs mt-4 w-full"
                data-testid="f7-export"
              >
                <Download className="h-3 w-3 mr-1" /> EXPORT MVP PDD
              </Button>
            </Card>

            <Card className="p-5 bg-card/50 flex flex-col min-h-0">
              <Tabs defaultValue="sections" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="sections" className="font-mono text-[10px] uppercase">
                    Sections
                  </TabsTrigger>
                  <TabsTrigger value="cert" className="font-mono text-[10px] uppercase">
                    Cert
                  </TabsTrigger>
                  <TabsTrigger value="verify" className="font-mono text-[10px] uppercase">
                    Verify
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sections" className="flex-1 min-h-0 mt-3 overflow-auto pr-2 space-y-2">
                  {result.sections.map((s) => (
                    <details
                      key={s.key}
                      className="border border-border/40 rounded p-2 bg-background/30"
                    >
                      <summary className="font-mono text-xs font-bold cursor-pointer text-primary">
                        {s.title}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-foreground/80">
                        {s.body}
                      </pre>
                    </details>
                  ))}
                </TabsContent>
                <TabsContent value="cert" className="mt-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs p-3 bg-background/40 rounded border border-border/40">
                    {JSON.stringify(result.cert, null, 2)}
                  </pre>
                </TabsContent>
                <TabsContent value="verify" className="mt-3 space-y-2">
                  <p className="font-mono text-xs text-muted-foreground">
                    Public verification URL:
                  </p>
                  <a
                    href={`/verify?cert=${encodeURIComponent(result.cert.certId)}`}
                    className="font-mono text-xs text-secondary underline break-all"
                    target="_blank"
                    rel="noreferrer"
                  >
                    /verify?cert={result.cert.certId}
                  </a>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        ) : (
          <Card className="p-10 bg-card/50 flex-1 flex items-center justify-center text-center">
            <div>
              <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground">
                SPARTAN compression idle — select source and compress.
              </p>
            </div>
          </Card>
        )}

        {(result?.artifactId || latestArtifact?.id) && (
          <Atlas360ViewPanel
            sessionId={sessionId}
            sessionOrigin={sessionOrigin}
            sourceArtifactId={(result?.artifactId || latestArtifact?.id)!}
            artifacts={artifacts}
          />
        )}
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="F7 SPARTAN Compressor requires Practitioner tier or an active escalation."
      />
    </WorkspaceShell>
  );
}
