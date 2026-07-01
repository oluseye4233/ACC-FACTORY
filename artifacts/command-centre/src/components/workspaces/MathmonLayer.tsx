import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSessionMathmon,
  useHarnessF05,
  getGetSessionMathmonQueryKey,
  getListSessionArtifactsQueryKey,
  getHarnessMapStreamUrl,
  MathmonMap,
  HarnessArtifact,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { useToast } from "@/hooks/use-toast";
import { streamSse, extractApiError } from "@/lib/sse";
import { Sigma, ShieldCheck, Gauge } from "lucide-react";

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

const GATE_JCSE = 45;
const GATE_MATHMON = 70;

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-foreground">{value}</span>
      </div>
      <div className="h-2 rounded bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-primary/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MathmonLayer({ sessionId, artifacts: _artifacts }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: state, isLoading } = useGetSessionMathmon(sessionId);

  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [costCap, setCostCap] = useState(false);
  const [providerOverride, setProviderOverride] = useState<OverrideValue>("session");
  const [mapRunning, setMapRunning] = useState(false);
  const [liveMap, setLiveMap] = useState<MathmonMap | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleApiError = (err: unknown) => {
    const x = extractApiError(err);
    if (x.status === 402 || x.status === 403) {
      setCostCap(x.status === 402);
      setUpgrade(true);
    } else {
      setError(x.message);
    }
  };

  const f05 = useHarnessF05({
    mutation: {
      onSuccess: () => {
        setError(null);
        qc.invalidateQueries({ queryKey: getGetSessionMathmonQueryKey(sessionId) });
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        toast({
          title: "MATHMON INTAKE COMPLETE",
          description: "Measurable variables profiled — build the MAP next.",
        });
      },
      onError: handleApiError,
    },
  });

  const runIntake = () => {
    setError(null);
    f05.mutate({ data: { sessionId, ...overrideToBody(providerOverride) } });
  };

  const runMap = async () => {
    setError(null);
    setMapRunning(true);
    setLiveMap(undefined);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getHarnessMapStreamUrl(),
        { sessionId, ...overrideToBody(providerOverride) },
        (e) => {
          if (e.event === "complete") {
            const map = e.data as MathmonMap;
            setLiveMap(map);
            qc.invalidateQueries({ queryKey: getGetSessionMathmonQueryKey(sessionId) });
            qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
            toast({
              title: "MAP COMPLETE",
              description: `MATHMON score ${map.mathmonScore}`,
            });
          } else if (e.event === "error") {
            const d = e.data as { error?: string };
            setError(d.error || "Stream error");
          }
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") handleApiError(err);
    } finally {
      setMapRunning(false);
    }
  };

  const intake = state?.intake ?? null;
  const map = liveMap ?? state?.map ?? null;
  const sessionJcse = state?.sessionJcse ?? null;
  const mathmonScore = map?.mathmonScore ?? state?.mathmonScore ?? null;

  const jcsePass = sessionJcse != null && sessionJcse >= GATE_JCSE;
  const mathmonPass = mathmonScore != null && mathmonScore >= GATE_MATHMON;
  const forgeVerified = jcsePass && mathmonPass;

  if (isLoading) {
    return (
      <WorkspaceShell>
        <Card className="p-10 bg-card/50 flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-muted-foreground">LOADING MATHMON STATE…</p>
        </Card>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sigma className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                  MATHMON Verification Layer
                </h3>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  F0.5 intake → MAP → FORGE VERIFIED gate (JCSE ≥ {GATE_JCSE} AND MATHMON ≥ {GATE_MATHMON})
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <ProviderOverride value={providerOverride} onChange={setProviderOverride} />
              <Button
                data-testid="mathmon-f05"
                onClick={runIntake}
                disabled={f05.isPending || mapRunning}
                variant="outline"
                className="font-display tracking-wider"
              >
                {f05.isPending ? "PROFILING…" : intake ? "RE-PROFILE" : "RUN F0.5 INTAKE"}
              </Button>
              <Button
                data-testid="mathmon-map"
                onClick={runMap}
                disabled={!intake || mapRunning || f05.isPending}
                className="font-display tracking-wider"
              >
                {mapRunning ? "MAPPING…" : "BUILD MAP"}
              </Button>
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        {!intake && !map ? (
          <EmptyState
            icon={<Gauge className="h-12 w-12" />}
            title="NO MATHMON PROFILE"
            body="Run F0.5 intake to profile the session's measurable variables, then build the MAP to compute the MATHMON score."
            hint="Requires a diagnosed concept (run F1 first)."
          />
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
            <Card className="p-5 bg-card/50 flex flex-col items-center text-center">
              <ShieldCheck
                className={`h-8 w-8 mb-2 ${forgeVerified ? "text-secondary" : "text-muted-foreground/40"}`}
              />
              {forgeVerified ? (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-secondary/60 bg-secondary/10 text-secondary"
                  data-testid="mathmon-forge-verified"
                >
                  <span className="font-display text-[11px] tracking-widest">FORGE VERIFIED</span>
                </div>
              ) : (
                <div
                  className="font-mono text-[10px] text-muted-foreground"
                  data-testid="mathmon-not-forge-verified"
                >
                  NOT FORGE VERIFIED
                </div>
              )}
              <div className="mt-4 w-full space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    MATHMON
                  </span>
                  <span
                    className={`font-mono text-lg font-bold ${mathmonPass ? "text-secondary" : "text-foreground"}`}
                    data-testid="mathmon-score"
                  >
                    {mathmonScore ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    JCSE
                  </span>
                  <span
                    className={`font-mono text-lg font-bold ${jcsePass ? "text-secondary" : "text-foreground"}`}
                    data-testid="mathmon-jcse"
                  >
                    {sessionJcse ?? "—"}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/40 space-y-1 font-mono text-[10px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>JCSE ≥ {GATE_JCSE}</span>
                    <span className={jcsePass ? "text-secondary" : "text-destructive"}>
                      {jcsePass ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MATHMON ≥ {GATE_MATHMON}</span>
                    <span className={mathmonPass ? "text-secondary" : "text-destructive"}>
                      {mathmonPass ? "PASS" : "FAIL"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-card/50 flex flex-col min-h-0 overflow-auto">
              {map ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <ScoreBar label="Math Coherence" value={map.mathCoherence} />
                    <ScoreBar label="Applicability" value={map.applicability} />
                    <ScoreBar label="Predictive Rel." value={map.predictiveReliability} />
                  </div>
                  <div className="space-y-2">
                    {map.sections.map((s) => (
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
                  </div>
                  {map.disclaimer ? (
                    <p className="text-[10px] leading-relaxed font-mono text-muted-foreground border-t border-border/40 pt-3">
                      {map.disclaimer}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <Gauge className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Intake captured. Build the MAP to compute the MATHMON score.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        costCap={costCap}
        message="MATHMON layer requires an active escalation or available cost budget."
      />
    </WorkspaceShell>
  );
}
