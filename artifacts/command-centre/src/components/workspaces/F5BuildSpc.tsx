import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF5,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  Spc,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { WorkspaceShell, ErrorBanner } from "./_shared";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import { extractApiError } from "@/lib/sse";
import { Download, Send } from "lucide-react";
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
}

export function F5BuildSpc({ sessionId }: Props) {
  const qc = useQueryClient();
  const storeKey = `f5:${sessionId}`;

  const [transcript, setTranscript] = useState<QA[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    "Press START to receive the first FORGE.CHARTER question.",
  );
  const [draft, setDraft] = useState("");
  const [spc, setSpc] = useState<Spc | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

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

  const start = () => {
    setTranscript([]);
    setSpc(undefined);
    m.mutate({ data: { sessionId } });
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
    const finalize = newTranscript.length >= 7;
    m.mutate({
      data: {
        sessionId,
        step: currentStep,
        answers,
        finalize,
      },
    });
  };

  const reset = () => {
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
              {currentStep === 0 && (
                <Button
                  data-testid="f5-start"
                  onClick={start}
                  disabled={m.isPending}
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
                disabled={currentStep === 0 || m.isPending || !!spc}
                className="font-mono text-xs min-h-[80px] bg-background/50"
              />
              <Button
                data-testid="f5-submit"
                onClick={submit}
                disabled={currentStep === 0 || m.isPending || !draft.trim() || !!spc}
                className="w-full font-display tracking-wider"
              >
                <Send className="h-3 w-3 mr-2" />
                {m.isPending ? "PROCESSING..." : "SUBMIT"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 bg-card/50 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                SPC Preview · 15 Sections
              </h4>
              {spc && (
                <Button
                  onClick={exportSpc}
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs"
                  data-testid="f5-export"
                >
                  <Download className="h-3 w-3 mr-1" /> EXPORT
                </Button>
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
