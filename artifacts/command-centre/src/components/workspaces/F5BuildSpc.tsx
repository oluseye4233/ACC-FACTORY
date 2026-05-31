import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF5,
  getHarnessF5FinalizeStreamUrl,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  Spc,
  HarnessArtifact,
  ArtifactType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { WorkspaceShell, ErrorBanner } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { streamSse, extractApiError } from "@/lib/sse";
import { Download, Send } from "lucide-react";
import { PublishToSphinxButton } from "@/components/shared/PublishToSphinxButton";
import { downloadZip } from "@/lib/zipExport";

const FORGE_STEPS = [
  "CHARTER",
  "ROLE",
  "CRAFT",
  "CONSTRAIN",
  "CULTIVATE",
  "COMPRESS",
  "COMMIT",
] as const;

interface QA {
  step: number;
  question: string;
  answer: string;
}

interface Props {
  sessionId: string;
  artifacts?: HarnessArtifact[];
}

export function F5BuildSpc({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();
  const storeKey = `f5:${sessionId}`;

  const latestArtifact = (artifacts ?? [])
    .filter((a) => a.artifactType === ArtifactType.SPC)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  const [transcript, setTranscript] = useState<QA[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    "Press START to receive the first FORGE.CHARTER question.",
  );
  const [draft, setDraft] = useState("");
  const [spc, setSpc] = useState<Spc | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storeKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          transcript: QA[];
          currentStep: number;
          currentQuestion: string;
          spc?: Spc;
        };
        setTranscript(saved.transcript || []);
        setCurrentStep(saved.currentStep || 0);
        setCurrentQuestion(saved.currentQuestion || "");
        setSpc(saved.spc);
      }
    } catch {
      /* ignore */
    }
  }, [storeKey]);

  useEffect(() => {
    sessionStorage.setItem(
      storeKey,
      JSON.stringify({ transcript, currentStep, currentQuestion, spc }),
    );
  }, [transcript, currentStep, currentQuestion, spc, storeKey]);

  const m = useHarnessF5({
    mutation: {
      onSuccess: (data) => {
        setError(null);
        if (data.done && data.spc) {
          setSpc(data.spc);
          setCurrentStep(7);
          setCurrentQuestion("FORGE complete — SPC certified below.");
          qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
          qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
        } else {
          setCurrentStep(data.nextStep ?? currentStep + 1);
          setCurrentQuestion(data.nextQuestion ?? "");
        }
      },
      onError: (e) => {
        const err = extractApiError(e);
        if (err.status === 403) setUpgrade(true);
        else setError(err.message);
      },
    },
  });

  const busy = m.isPending || finalizing;

  // FORGE.COMMIT synthesis is the heavy LLM call; it streams over SSE so the
  // proxy doesn't abort a multi-minute generation (the 502 failure mode).
  const finalizeViaStream = async (answers: Record<string, string>) => {
    setError(null);
    setFinalizing(true);
    setCurrentStep(7);
    setCurrentQuestion("FORGE.COMMIT — synthesising SPC...");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getHarnessF5FinalizeStreamUrl(),
        { sessionId, answers, ...overrideToBody(providerOverride) },
        (e) => {
          if (e.event === "step") {
            const d = e.data as { label?: string };
            if (d.label) setCurrentQuestion(`FORGE.COMMIT — ${d.label}`);
          } else if (e.event === "complete") {
            const built = e.data as Spc;
            setSpc(built);
            setCurrentQuestion("FORGE complete — SPC certified below.");
            qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
            qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
          } else if (e.event === "error") {
            const d = e.data as { error?: string };
            setError(d.error || "Synthesis failed");
          }
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const x = extractApiError(err);
        if (x.status === 403) setUpgrade(true);
        else setError(x.message);
      }
    } finally {
      setFinalizing(false);
    }
  };

  const start = () => {
    setTranscript([]);
    setSpc(undefined);
    m.mutate({ data: { sessionId, ...overrideToBody(providerOverride) } });
  };

  const submit = () => {
    if (!draft.trim() || currentStep < 1) return;
    const qa: QA = { step: currentStep, question: currentQuestion, answer: draft };
    const newTranscript = [...transcript, qa];
    setTranscript(newTranscript);
    setDraft("");

    const answers: Record<string, string> = {};
    for (const item of newTranscript) {
      answers[`step${item.step}`] = item.answer;
    }
    if (newTranscript.length >= 7) {
      void finalizeViaStream(answers);
      return;
    }
    m.mutate({
      data: {
        sessionId,
        step: currentStep,
        answers,
        finalize: false,
        ...overrideToBody(providerOverride),
      },
    });
  };

  const reset = () => {
    abortRef.current?.abort();
    setFinalizing(false);
    sessionStorage.removeItem(storeKey);
    setTranscript([]);
    setCurrentStep(0);
    setCurrentQuestion("Press START to receive the first FORGE.CHARTER question.");
    setSpc(undefined);
    setError(null);
  };

  const exportSpc = async () => {
    if (!spc) return;
    const md = spc.sections.map((s) => `# ${s.title}\n\n${s.body}`).join("\n\n---\n\n");
    await downloadZip(`spc-${sessionId.slice(0, 8)}.zip`, {
      "spc.md": md,
      "spc.json": JSON.stringify(spc, null, 2),
    });
  };

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              FORGE 7-Step Indicator
            </h4>
            <div className="flex gap-2">
              <ProviderOverride
                value={providerOverride}
                onChange={setProviderOverride}
                disabled={busy}
                testId="f5-provider"
              />
              {currentStep === 0 && (
                <Button
                  data-testid="f5-start"
                  onClick={start}
                  disabled={busy}
                  size="sm"
                  className="font-display tracking-wider"
                >
                  START FORGE
                </Button>
              )}
              {currentStep > 0 && (
                <Button onClick={reset} size="sm" variant="ghost" className="font-mono text-xs">
                  RESET
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {FORGE_STEPS.map((label, i) => {
              const idx = i + 1;
              const done = idx <= transcript.length;
              const active = idx === currentStep;
              return (
                <div
                  key={label}
                  className={`text-center p-2 rounded border ${
                    done
                      ? "border-primary/40 bg-primary/10"
                      : active
                        ? "border-secondary/40 bg-secondary/10"
                        : "border-border/40 bg-muted/20"
                  }`}
                >
                  <div
                    className={`font-mono text-[10px] font-bold ${
                      done ? "text-primary" : active ? "text-secondary" : "text-muted-foreground"
                    }`}
                  >
                    {idx}
                  </div>
                  <div
                    className={`font-mono text-[9px] uppercase tracking-tight ${
                      done || active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-4 flex-1 min-h-0">
          <Card className="p-5 bg-card/50 flex flex-col min-h-[400px]">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Q&A Transcript
            </h4>
            <div className="flex-1 overflow-auto space-y-3 pr-2">
              {transcript.map((qa) => (
                <div key={qa.step} className="space-y-1">
                  <div className="font-mono text-[10px] text-secondary">
                    {FORGE_STEPS[qa.step - 1]} · Q{qa.step}
                  </div>
                  <div className="font-mono text-xs text-foreground/80">{qa.question}</div>
                  <div className="font-mono text-xs text-primary border-l-2 border-primary pl-2 whitespace-pre-wrap">
                    {qa.answer}
                  </div>
                </div>
              ))}
              {currentStep > 0 && !spc && (
                <div className="space-y-1 pt-3 border-t border-border/40">
                  <div className="font-mono text-[10px] text-secondary">
                    {FORGE_STEPS[Math.min(currentStep, 7) - 1]} · Q{currentStep}
                  </div>
                  <div className="font-mono text-xs text-foreground">
                    {m.isPending ? "Receiving..." : currentQuestion}
                    {finalizing && (
                      <span className="ml-1 inline-block animate-pulse">▍</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {error && <ErrorBanner message={error} />}
              <Textarea
                data-testid="f5-answer"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={currentStep === 0 ? "Press START first" : "Answer..."}
                disabled={currentStep === 0 || busy || !!spc}
                className="font-mono text-xs min-h-[80px] bg-background/50"
              />
              <Button
                data-testid="f5-submit"
                onClick={submit}
                disabled={currentStep === 0 || busy || !draft.trim() || !!spc}
                className="w-full font-display tracking-wider"
              >
                <Send className="h-3 w-3 mr-2" />
                {finalizing ? "SYNTHESISING..." : m.isPending ? "PROCESSING..." : "SUBMIT"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 bg-card/50 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                  SPC Preview · 15 Sections
                </h4>
                {spc && latestArtifact?.provider && (
                  <GeneratedBy
                    provider={latestArtifact.provider}
                    modelId={latestArtifact.modelId}
                    testId="f5-generated-by"
                  />
                )}
              </div>
              {spc && (
                <div className="flex items-center gap-2">
                  {latestArtifact?.id && (
                    <PublishToSphinxButton
                      artifactId={latestArtifact.id}
                      artifactType="SPC"
                      existing={
                        (latestArtifact.artifactContent as {
                          sphinxListing?: {
                            listingId: string | null;
                            listingUrl: string | null;
                            publishedAt: string;
                          };
                        })?.sphinxListing ?? null
                      }
                    />
                  )}
                  <Button
                    onClick={exportSpc}
                    size="sm"
                    variant="outline"
                    className="font-mono text-xs"
                    data-testid="f5-export"
                  >
                    <Download className="h-3 w-3 mr-1" /> EXPORT
                  </Button>
                </div>
              )}
            </div>
            {spc ? (
              <>
                <div className="flex gap-3 mb-3 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-muted">IQS: {spc.iqs}</span>
                  <span className="px-2 py-0.5 rounded bg-muted">GRO: {spc.gro}</span>
                </div>
                <div className="flex-1 overflow-auto space-y-2 pr-2">
                  {spc.sections.map((s) => (
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground font-mono text-xs">
                15-section SPC will materialize after COMMIT.
              </div>
            )}
          </Card>
        </div>
      </div>
      <UpgradeCTA
        open={upgrade}
        onOpenChange={setUpgrade}
        message="F5 SPC Builder requires Practitioner tier or an active escalation."
      />
    </WorkspaceShell>
  );
}
