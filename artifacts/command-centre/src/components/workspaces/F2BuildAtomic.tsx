import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF2,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  AtomicPromptTuple,
  AtomicPrompt,
  HarnessArtifact,
  ArtifactType,
} from "@workspace/api-client-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { JCSECounter } from "@/components/shared/JCSECounter";
import { CertTierChip } from "@/components/shared/CertTierChip";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { WorkspaceShell, ErrorBanner, PILLAR_LABELS } from "./_shared";
import {
  ProviderOverride,
  overrideToBody,
  type OverrideValue,
} from "@/components/shared/ProviderOverride";
import { extractApiError } from "@/lib/sse";
import { CheckCircle2 } from "lucide-react";

const FIELDS: Array<{
  key: keyof AtomicPromptTuple;
  label: string;
  hint: string;
}> = [
  { key: "system", label: "SYSTEM", hint: "Operating context + governing law" },
  { key: "role", label: "ROLE", hint: "Persona, expertise, voice" },
  { key: "instruction", label: "INSTRUCTION", hint: "The atomic ask" },
  { key: "example", label: "EXAMPLE", hint: "Concrete reference samples" },
  { key: "constraint", label: "CONSTRAINT", hint: "Hard rules + boundaries" },
  { key: "format", label: "FORMAT", hint: "Output structure + style" },
  { key: "data", label: "DATA", hint: "Inputs + reference material" },
];

const EMPTY: AtomicPromptTuple = {
  system: "",
  role: "",
  instruction: "",
  example: "",
  constraint: "",
  format: "",
  data: "",
};

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

export function F2BuildAtomic({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();

  const latestArtifact = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.ATOMIC_PROMPT)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );

  const f1Source = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.PROMPT_DIAGNOSTIC)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );

  const [tuple, setTuple] = useState<AtomicPromptTuple>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AtomicPrompt | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [providerOverride, setProviderOverride] =
    useState<OverrideValue>("session");

  useEffect(() => {
    if (hydrated || !f1Source) return;
    const ap = (f1Source.artifactContent as { atomicPrompt?: AtomicPromptTuple })
      .atomicPrompt;
    if (ap) {
      setTuple({ ...EMPTY, ...ap });
      setHydrated(true);
    }
  }, [f1Source, hydrated]);

  const m = useHarnessF2({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
      },
      onError: (e) => setError(extractApiError(e).message),
    },
  });

  const liveJcse = useMemo(() => {
    return FIELDS.reduce((sum, f) => {
      const v = tuple[f.key].trim().length;
      const score = v === 0 ? 0 : v < 40 ? 3 : v < 120 ? 5 : 7;
      return sum + score;
    }, 0);
  }, [tuple]);

  const certify = () => {
    const empty = FIELDS.filter((f) => !tuple[f.key].trim());
    if (empty.length) {
      setError(`All 7 pillars required. Missing: ${empty.map((f) => f.label).join(", ")}`);
      return;
    }
    setError(null);
    m.mutate({
      data: { sessionId, tuple, ...overrideToBody(providerOverride) },
    });
  };

  return (
    <WorkspaceShell>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 h-full">
        <Card className="bg-card/50 p-5 flex flex-col gap-3 min-h-[400px]">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
              7-Pillar Atomic Prompt
            </h3>
            {f1Source && (
              <span className="font-mono text-[10px] text-secondary">
                Pre-filled from F1
              </span>
            )}
          </div>
          <Accordion type="multiple" defaultValue={["instruction"]} className="flex-1">
            {FIELDS.map((f) => (
              <AccordionItem key={f.key} value={f.key} className="border-border/40">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left">
                    <span className="font-mono text-xs font-bold text-primary w-24">
                      {f.label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {f.hint}
                    </span>
                    {tuple[f.key].trim() && (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    data-testid={`f2-field-${f.key}`}
                    value={tuple[f.key]}
                    onChange={(e) =>
                      setTuple((t) => ({ ...t, [f.key]: e.target.value }))
                    }
                    placeholder={`Define the ${f.label.toLowerCase()} pillar...`}
                    className="font-mono text-xs min-h-[100px] bg-background/50"
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {error && <ErrorBanner message={error} />}
          <div className="flex items-center gap-2">
            <ProviderOverride
              value={providerOverride}
              onChange={setProviderOverride}
              disabled={m.isPending}
              testId="f2-provider"
            />
            <Button
              data-testid="f2-certify"
              onClick={certify}
              disabled={m.isPending}
              className="font-display tracking-wider flex-1"
            >
              {m.isPending ? "CERTIFYING..." : "CERTIFY ATOMIC PROMPT"}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 bg-card/50">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Live JCSE (Client Preview)
            </h4>
            <div className="flex items-center justify-between">
              <JCSECounter score={liveJcse} size="lg" />
              <div className="text-right font-mono text-[10px] text-muted-foreground">
                Server certifies final score
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {PILLAR_LABELS.map((label) => {
                const v = tuple[label.toLowerCase() as keyof AtomicPromptTuple].trim().length;
                const filled = v > 0;
                return (
                  <div
                    key={label}
                    title={label}
                    className={`h-2 rounded ${filled ? "bg-primary" : "bg-muted"}`}
                  />
                );
              })}
            </div>
          </Card>

          {result && (
            <Card className="p-5 bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Certified
                </h4>
                <CertTierChip tier={result.certTier} />
              </div>
              {latestArtifact?.provider && (
                <div className="mb-3">
                  <GeneratedBy
                    provider={latestArtifact.provider}
                    modelId={latestArtifact.modelId}
                    testId="f2-generated-by"
                  />
                </div>
              )}
              <div className="flex items-baseline gap-3">
                <JCSECounter score={result.jcse.total} size="md" />
                <div className="grid grid-cols-7 gap-1 flex-1">
                  {PILLAR_LABELS.map((label) => {
                    const k = label.toLowerCase() as keyof typeof result.jcse;
                    const v = result.jcse[k] as number;
                    return (
                      <div key={label} className="text-center">
                        <div className="font-mono text-[9px] text-muted-foreground">
                          {label.slice(0, 3)}
                        </div>
                        <div className="font-mono text-xs font-bold">{v}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
