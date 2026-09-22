import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Fingerprint, Lock, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceShell, EmptyState, ErrorBanner } from "./_shared";
import type { HarnessArtifact } from "@workspace/api-client-react";

type PhaseState = "PENDING" | "RUNNING" | "PASSED" | "REFUSED";
type F9Phase = {
  number: number;
  name: string;
  detail: string;
  state: PhaseState;
  verdict?: string;
  evidence?: string[];
};
type F9Run = {
  mecha_run_id: string;
  status: "RUNNING" | "EMITTED" | "REFUSED";
  phases: F9Phase[];
  verdict?: Record<string, unknown>;
  machine_artifact?: Record<string, unknown>;
  refusal?: Record<string, unknown>;
};
type PhaseInput = { phase: number; evidence: Record<string, unknown> };
type PersistedRun = {
  mechaRunId: string;
  status: F9Run["status"];
  phase: number;
  evidence: PhaseInput[];
  refusal: Record<string, unknown> | null;
  artifactContent: Record<string, unknown> | null;
};

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

const PHASES = [
  ["READ", "BAHN + FRACTAL + CODE DJ", "Target profile, cardinality, regime vocabulary, and platform allocation."],
  ["DISCOVER", "ATHENA L3/L5/L7", "Candidate switches/functions with evidence tiers."],
  ["CLASSIFY", "DEXTER + BAHN", "Binary hazard classification and lane assignment."],
  ["CULTIVATE", "CELL SI + CODE DJ", "Fail-safe declaration, ICD, and architecture before code."],
  ["VALIDATE", "MM + DEXTER / ARES", "Math verdict and physical three-vector falsification."],
  ["CLEAR & CERTIFY", "ATHENA L8 + UCG", "IP clearance and universal certification gate."],
  ["EMIT", "CODE DJ + FRACTAL + OSIRIS", "SPK packaging, signing, and custody registration."],
] as const;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "—" : JSON.stringify(value));
const EMPTY_PHASES: PhaseInput[] = PHASES.map((_, index) => ({ phase: index + 1, evidence: {} }));
const phaseRows = (evidence: PhaseInput[], status: F9Run["status"], haltedPhase = 7): F9Phase[] =>
  PHASES.map(([name, owner, detail], index) => {
    const number = index + 1;
    const values = evidence.find((item) => item.phase === number)?.evidence ?? {};
    const state: PhaseState =
      status === "EMITTED" ? "PASSED" :
      status === "REFUSED" && number === haltedPhase ? "REFUSED" :
      status === "REFUSED" && number < haltedPhase ? "PASSED" : "PENDING";
    return {
      number,
      name,
      detail: `${owner} · ${detail}`,
      state,
      evidence: Object.entries(values).map(([key, value]) => `${key}: ${text(value)}`),
    };
  });
const fromPersisted = (row: PersistedRun): F9Run => ({
  mecha_run_id: row.mechaRunId,
  status: row.status,
  phases: phaseRows(row.evidence, row.status, row.phase),
  machine_artifact: row.artifactContent ?? undefined,
  refusal: row.refusal ?? undefined,
});
const isCertified = (artifact: HarnessArtifact) =>
  artifact.artifactType === "MVP_PDD" && Boolean((artifact as HarnessArtifact & { spartanCert?: unknown }).spartanCert);
const isCodeBundle = (artifact: HarnessArtifact) => artifact.artifactType === "CODEBASE_BUNDLE";

export function F9MachineFloor({ sessionId, artifacts }: Props) {
  const certifiedPdd = useMemo(
    () => artifacts.filter(isCertified).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );
  const codeBundle = useMemo(
    () => artifacts.filter(isCodeBundle).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [artifacts],
  );
  const [deviceClass, setDeviceClass] = useState("");
  const [phaseEvidence, setPhaseEvidence] = useState(() => JSON.stringify(EMPTY_PHASES, null, 2));
  const [run, setRun] = useState<F9Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const prerequisitesReady = Boolean(certifiedPdd && codeBundle);
  useEffect(() => {
    let cancelled = false;
    api.get<PersistedRun[]>(`/api/harness/f9/runs?sessionId=${encodeURIComponent(sessionId)}`)
      .then((rows) => {
        if (!cancelled && rows[0]) setRun(fromPersisted(rows[0]));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId]);

  const startRun = async () => {
    if (!certifiedPdd || !codeBundle || !deviceClass.trim()) {
      setError("A device class, SPARTAN-certified MVP PDD, and F8 Code Oracle bundle are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const phases = JSON.parse(phaseEvidence) as PhaseInput[];
      if (!Array.isArray(phases) || phases.length !== 7) {
        throw new Error("Phase evidence must be a JSON array containing exactly seven records.");
      }
      const artifact = await api.post<Record<string, unknown>>("/api/harness/f9", {
        sessionId,
        sourceArtifactId: codeBundle.id,
        deviceClass: deviceClass.trim(),
        artifactVersion: "1.0.0",
        phases,
      });
      setRun({
        mecha_run_id: text(artifact.mecha_run_id),
        status: "EMITTED",
        phases: phaseRows(phases, "EMITTED"),
        machine_artifact: artifact,
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422 && cause.body && typeof cause.body === "object") {
        const refusal = cause.body as Record<string, unknown>;
        let phases: PhaseInput[] = EMPTY_PHASES;
        try { phases = JSON.parse(phaseEvidence) as PhaseInput[]; } catch {}
        setRun({
          mecha_run_id: text(refusal.mecha_run_id),
          status: "REFUSED",
          phases: phaseRows(phases, "REFUSED", Number(refusal.phase_halted)),
          refusal,
        });
      } else {
        setError(cause instanceof Error ? cause.message : "F9 could not start.");
      }
    } finally {
      setPending(false);
    }
  };

  if (!prerequisitesReady) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<Lock className="h-12 w-12" />}
          title="F9 UPSTREAM GATES REQUIRED"
          body="The Machine Floor cannot be entered until this session has both a SPARTAN-certified MVP PDD and an F8 Code Oracle bundle. F9 never accepts a hand-assembled artifact."
          hint="Complete F7/SPARTAN, then run F8 Code Oracle from that certified lineage."
        />
      </WorkspaceShell>
    );
  }

  const phases: F9Phase[] = run?.phases ?? PHASES.map(([name, owner, detail], index) => ({
    number: index + 1,
    name,
    detail: `${owner} · ${detail}`,
    state: "PENDING" as PhaseState,
  }));
  const artifact = run?.machine_artifact;
  const refusal = run?.refusal;

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 p-4 md:p-5" data-testid="workspace-f9-machine-floor">
        <Card className="border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">D35 · F9 MACHINE FLOOR</span>
              </div>
              <h2 className="mt-2 font-display text-2xl tracking-wider">MECHA ULTRA SI</h2>
              <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">
                Refusal is the default output. Seven phases run in order; external gate verdicts are recorded, never overridden.
              </p>
            </div>
            <div className="rounded border border-border/50 bg-background/60 px-3 py-2 font-mono text-[10px]">
              <div className="text-muted-foreground">UPSTREAM LINEAGE</div>
              <div className="mt-1 text-foreground">{certifiedPdd.id.slice(0, 12)}… → {codeBundle.id.slice(0, 12)}…</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="grid gap-3">
            <div>
              <label htmlFor="f9-device-class" className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Device class
              </label>
              <Input
                id="f9-device-class"
                data-testid="f9-device-class"
                value={deviceClass}
                onChange={(event) => setDeviceClass(event.target.value)}
                placeholder="e.g. cold-chain compressor controller"
                className="mt-1 font-mono text-xs"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="f9-phase-evidence" className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Complete seven-phase external gate evidence
              </label>
              <Textarea
                id="f9-phase-evidence"
                data-testid="f9-phase-evidence"
                value={phaseEvidence}
                onChange={(event) => setPhaseEvidence(event.target.value)}
                className="mt-1 min-h-48 font-mono text-[10px]"
                spellCheck={false}
              />
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                Verdicts come from BAHN, ATHENA, CELL, MM, ARES, UCG, CODE DJ, and OSIRIS. Missing evidence produces a cited refusal; MECHA never fills it in.
              </p>
            </div>
            <div className="flex justify-end">
              <Button data-testid="f9-run" onClick={startRun} disabled={pending || !deviceClass.trim()} className="gap-2 font-mono text-xs">
                <Play className="h-3.5 w-3.5" />
                {pending ? "STARTING MECHA…" : "RUN F9 FLOOR"}
              </Button>
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
          {run && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/40 pt-3 font-mono text-[10px]" data-testid="f9-run-identity">
              <Fingerprint className="h-3.5 w-3.5 text-secondary" />
              <span className="text-muted-foreground">MECHA RUN ID</span>
              <span className="font-bold text-secondary">{run.mecha_run_id}</span>
              <span className={`rounded px-2 py-0.5 font-bold ${run.status === "EMITTED" ? "bg-emerald-500/15 text-emerald-400" : run.status === "REFUSED" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"}`}>
                {run.status}
              </span>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">Ordered MECHA strand</h3>
          </div>
          <ol className="grid gap-2 md:grid-cols-2">
            {phases.map((phase) => (
              <li key={phase.number} className="rounded border border-border/50 bg-background/40 p-3" data-testid={`f9-phase-${phase.number}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{phase.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold">{phase.name}</span>
                      <span className={`font-mono text-[9px] font-bold ${phase.state === "PASSED" ? "text-emerald-400" : phase.state === "REFUSED" ? "text-rose-400" : phase.state === "RUNNING" ? "text-amber-400" : "text-muted-foreground"}`}>{phase.state}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{phase.detail}</p>
                    {phase.verdict && <p className="mt-2 border-t border-border/40 pt-2 font-mono text-[10px] text-foreground/80">VERDICT · {phase.verdict}</p>}
                    {phase.evidence?.length ? <div className="mt-2 space-y-1">{phase.evidence.map((item) => <p key={item} className="font-mono text-[10px] text-secondary">↳ {item}</p>)}</div> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {artifact && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 p-5" data-testid="f9-emitted-artifact">
            <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-5 w-5" /><h3 className="font-mono text-xs font-bold uppercase tracking-wider">Signed Machine Artifact emitted</h3></div>
            <div className="mt-4 grid gap-3 font-mono text-[10px] sm:grid-cols-2">
              {["machine_artifact_id", "artifact_version", "payload_hash", "artifact_signature", "spk_id", "reverification_due"].map((key) => (
                <div key={key} data-testid={`f9-artifact-${key}`}><span className="text-muted-foreground">{key.replaceAll("_", " ").toUpperCase()} </span><span className="break-all text-foreground">{text(artifact[key])}</span></div>
              ))}
            </div>
            <p className="mt-4 font-mono text-[10px] text-muted-foreground">OSIRIS custody is recorded. This artifact is versioned and immutable; release and deployment are separate F10 concerns.</p>
          </Card>
        )}

        {refusal && (
          <Card className="border-rose-500/30 bg-rose-500/5 p-5" data-testid="f9-refusal">
            <div className="flex items-center gap-2 text-rose-400"><ShieldAlert className="h-5 w-5" /><h3 className="font-mono text-xs font-bold uppercase tracking-wider">Cited refusal · artifact not emitted</h3></div>
            <div className="mt-4 space-y-2 font-mono text-[10px]">
              <p><span className="text-muted-foreground">PHASE HALTED </span>{text(refusal.phase_halted)}</p>
              <p><span className="text-muted-foreground">CONSTRAINT </span><strong>{text(refusal.constraint_cited)}</strong></p>
              <p><span className="text-muted-foreground">INVARIANT </span><strong>{text(refusal.invariant_cited)}</strong></p>
              <p className="text-foreground/80">{text(refusal.cause)}</p>
              <p className="text-secondary">{text(refusal.required_to_proceed)}</p>
            </div>
          </Card>
        )}
      </div>
    </WorkspaceShell>
  );
}