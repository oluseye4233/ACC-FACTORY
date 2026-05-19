import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getHarnessF3StreamUrl,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  AtomicPromptTuple,
  MaBirthPackage,
  MaClassification,
  HarnessArtifact,
  ArtifactType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { streamSse, extractApiError } from "@/lib/sse";
import { Hexagon, ShieldAlert, Radio } from "lucide-react";

type Organelle = {
  id: string;
  name: string;
  status: string;
  output?: string | null;
};

const ORGANELLES: Array<{ id: string; short: string }> = [
  { id: "NUCLEUS", short: "Nucleus" },
  { id: "MITOCHONDRION", short: "Mito" },
  { id: "RIBOSOME", short: "Ribosome" },
  { id: "MEMBRANE", short: "Membrane" },
  { id: "ENDOPLASMIC_RETICULUM", short: "ER" },
  { id: "GOLGI_APPARATUS", short: "Golgi" },
  { id: "LYSOSOME", short: "Lysosome" },
  { id: "CYTOSKELETON", short: "Cyto" },
];

function isComplete(status: string): boolean {
  const s = status.toUpperCase();
  return s === "CULTIVATED" || s === "COMPLETE" || s === "DONE";
}

function isRunning(status: string): boolean {
  const s = status.toUpperCase();
  return s === "CULTIVATING" || s === "RUNNING" || s === "ACTIVE";
}

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

function HexCell({
  label,
  active,
  done,
  index,
}: {
  label: string;
  active: boolean;
  done: boolean;
  index: number;
}) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const xOffset = row % 2 === 1 ? 56 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: col * 112 + xOffset,
        top: row * 96,
      }}
      className="w-[104px] h-[120px] flex items-center justify-center"
    >
      <div
        className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
          active ? "scale-105" : ""
        }`}
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: done
            ? "rgba(26,107,58,0.25)"
            : active
              ? "rgba(201,162,39,0.25)"
              : "rgba(255,255,255,0.04)",
          border: `1px solid ${
            done ? "#1A6B3A" : active ? "#C9A227" : "rgba(255,255,255,0.1)"
          }`,
        }}
      >
        <span
          className={`font-mono text-[10px] font-bold uppercase ${
            done ? "text-primary" : active ? "text-secondary" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function F3BuildMa({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();

  const apSource = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.ATOMIC_PROMPT)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );

  const [intent, setIntent] = useState("");
  const [running, setRunning] = useState(false);
  const [organelles, setOrganelles] = useState<Organelle[]>([]);
  const [classification, setClassification] = useState<MaClassification | undefined>();
  const [escalated, setEscalated] = useState(false);
  const [pkg, setPkg] = useState<MaBirthPackage | undefined>();
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    if (!apSource) {
      setError("F2 Atomic Prompt artifact required before F3 can run.");
      return;
    }
    const tuple = (apSource.artifactContent as { tuple?: AtomicPromptTuple }).tuple;
    if (!tuple) {
      setError("Source artifact has no tuple.");
      return;
    }
    setError(null);
    setRunning(true);
    setOrganelles([]);
    setClassification(undefined);
    setEscalated(false);
    setPkg(undefined);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getHarnessF3StreamUrl(),
        { sessionId, atomicPrompt: tuple, intent: intent || undefined },
        (e) => {
          if (e.event === "organelle") {
            const o = e.data as Organelle;
            setOrganelles((prev) => {
              const exists = prev.find((p) => p.id === o.id);
              return exists
                ? prev.map((p) => (p.id === o.id ? { ...p, ...o } : p))
                : [...prev, o];
            });
          } else if (e.event === "classification") {
            setClassification(e.data as MaClassification);
          } else if (e.event === "escalation") {
            setEscalated(true);
          } else if (e.event === "complete") {
            setPkg(e.data as MaBirthPackage);
            qc.invalidateQueries({
              queryKey: getListSessionArtifactsQueryKey(sessionId),
            });
            qc.invalidateQueries({
              queryKey: getListFeatureStateQueryKey(sessionId),
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
        setError(extractApiError(err).message);
      }
    } finally {
      setRunning(false);
    }
  };

  if (!apSource) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<Hexagon className="h-12 w-12" />}
          title="F2 ATOMIC PROMPT REQUIRED"
          body="The MA Birth Package generator activates the 8 cellular organelles to grow a Micro Agent (MA) from your Atomic Prompt."
          hint="Run F2 to produce a certified Atomic Prompt first."
        />
      </WorkspaceShell>
    );
  }

  const activeIdx = organelles.filter((o) => isComplete(o.status)).length;

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="flex items-center gap-3 flex-wrap">
            <Radio className={`h-4 w-4 ${running ? "text-secondary animate-pulse" : "text-muted-foreground"}`} />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Cell Activation
            </span>
            <Input
              data-testid="f3-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Optional: declare seed intent..."
              className="flex-1 font-mono text-xs bg-background/50 min-w-[200px]"
            />
            <Button
              data-testid="f3-activate"
              onClick={run}
              disabled={running}
              className="font-display tracking-wider"
            >
              {running ? "CULTIVATING..." : "ACTIVATE CELL"}
            </Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        <div className="grid lg:grid-cols-[440px_1fr] gap-4">
          <Card className="p-5 bg-card/50">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Organelle Honeycomb
            </h4>
            <div className="relative" style={{ height: 312, width: 432 }}>
              {ORGANELLES.map((meta, i) => {
                const o = organelles.find((x) => x.id === meta.id);
                const done = !!o && isComplete(o.status);
                const active = !!o && isRunning(o.status);
                return (
                  <HexCell
                    key={meta.id}
                    label={meta.short}
                    index={i}
                    active={active || (running && !done && i === activeIdx)}
                    done={done}
                  />
                );
              })}
            </div>
            <div className="mt-4 text-center font-mono text-[10px] text-muted-foreground">
              {activeIdx}/8 organelles cultivated
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            {classification && (
              <Card className="p-5 bg-card/50">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  MA Classification
                </h4>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl tracking-wider text-primary">
                    {classification.phase}
                  </span>
                  <span className="font-mono text-sm text-foreground">{classification.kind}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">
                    {Math.round(classification.confidence * 100)}% confidence
                  </span>
                </div>
                {classification.rationale && (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {classification.rationale}
                  </p>
                )}
              </Card>
            )}

            {escalated && (
              <Card className="p-4 bg-destructive/10 border-destructive/30">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
                      ESCALATION FILED
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      F5 SPC Builder unlocked for this session.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {pkg && (
              <Card className="p-5 bg-card/50">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary mb-3">
                  Birth Package
                </h4>
                <Tabs defaultValue="overview">
                  <TabsList className="grid grid-cols-5">
                    {(["overview", "capability", "knowledge", "behaviour", "lifecycle"] as const).map((k) => (
                      <TabsTrigger key={k} value={k} className="font-mono text-[10px] uppercase">
                        {k}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {(["overview", "capability", "knowledge", "behaviour", "lifecycle"] as const).map((k) => (
                    <TabsContent key={k} value={k} className="mt-3">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/90 leading-relaxed max-h-[300px] overflow-auto">
                        {pkg.birthPackage[k]}
                      </pre>
                    </TabsContent>
                  ))}
                </Tabs>
              </Card>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
