import { useMemo, useState } from "react";
import {
  type HarnessArtifact,
  type HostingPlan,
  useHarnessF8Hdj,
} from "@workspace/api-client-react";
import { Ban, CheckCircle2, Lock, Route, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceShell, EmptyState, ErrorBanner } from "./_shared";
import { extractApiError } from "@/lib/sse";

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

const HOST_PHASES = [
  ["H0", "INTAKE", "Accept a certified F8 code bundle or an explicit F10 handoff."],
  ["H1", "PROFILE", "Normalize the Hosting Requirements Profile without changing the source contract."],
  ["H2", "SENSE", "Read provider capabilities with provenance and freshness."],
  ["H3", "PLAN", "Recompute the HOST DJ ranking, journey, and deployment-file safety checks."],
  ["H4", "CONSENT & STAGE", "Provider write, cost ceiling, scoped credential, rollback, and human attestations."],
  ["H5", "VERIFY IN STAGE", "Health, smoke, and rehearsed rollback evidence from a real staging host."],
  ["H6", "CERTIFY", "UCG-HOST evidence and three distinct author, scorer, and adjudicator identities."],
  ["H7", "CONSENT & PROMOTE", "Second consent and production cutover; F10 handoffs also need F10 promotion proof."],
  ["H8", "HAND OFF", "Register hosting telemetry with F9.5 and return a HostReceipt to F10."],
] as const;

const isCertifiedMvp = (artifact: HarnessArtifact) =>
  artifact.artifactType === "MVP_PDD" &&
  Boolean((artifact as HarnessArtifact & { spartanCert?: unknown }).spartanCert);

const latest = (items: HarnessArtifact[]) =>
  [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

function PlanSummary({ plan }: { plan: HostingPlan }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">H1 · HOSTING REQUIREMENTS PROFILE</h3>
        </div>
        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div><span className="text-muted-foreground">RUNTIME </span>{plan.hrp.runtime}</div>
          <div><span className="text-muted-foreground">TARGET </span>{plan.hrp.deployTarget}</div>
          <div><span className="text-muted-foreground">DATABASE </span>{plan.hrp.database}</div>
          <div><span className="text-muted-foreground">SCALE </span>{plan.hrp.scaleProfile}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">REGIONS </span>{plan.hrp.regions.join(", ") || "none stated"}</div>
          <p className="sm:col-span-2 text-muted-foreground">{plan.hrp.summary}</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Route className="h-4 w-4 text-secondary" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">H3 · HSE DECISION</h3>
        </div>
        <div className="grid gap-2 font-mono text-xs">
          <div className="flex items-center justify-between rounded border border-primary/30 bg-primary/5 p-3">
            <span><span className="text-muted-foreground">PRIMARY </span>{plan.primary.platform}</span>
            <strong className="text-primary">{plan.primary.score}</strong>
          </div>
          <div className="flex items-center justify-between rounded border border-border/50 p-3">
            <span><span className="text-muted-foreground">FALLBACK </span>{plan.fallback.platform}</span>
            <strong>{plan.fallback.score}</strong>
          </div>
          <p className="text-[10px] text-muted-foreground">{plan.primary.rationale}</p>
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">PLAN OUTPUT · ADVISORY ONLY</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">Deployment journey · {plan.journey.tier}</p>
            <ol className="space-y-2">
              {plan.journey.phases.map((phase, index) => (
                <li key={`${phase.name}-${index}`} className="rounded border border-border/50 bg-background/40 p-2">
                  <span className="font-mono text-xs font-bold">{index + 1}. {phase.name}</span>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{phase.detail}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">Environment names · values excluded</p>
            <div className="space-y-1 rounded border border-border/50 bg-background/40 p-3">
              {plan.sdf.envTemplate.length ? plan.sdf.envTemplate.map((entry) => (
                <div key={entry.key} className="font-mono text-[10px]">
                  <span className="text-secondary">{entry.key}</span>
                  <span className="text-muted-foreground"> · {entry.description}</span>
                </div>
              )) : <p className="font-mono text-[10px] text-muted-foreground">No environment keys declared.</p>}
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">{plan.sdf.healthCheck || "No health check declared."}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function F11HostConnector({ sessionId, artifacts }: Props) {
  const certifiedPdd = useMemo(() => latest(artifacts.filter(isCertifiedMvp)), [artifacts]);
  const codeBundle = useMemo(() => latest(artifacts.filter((artifact) => artifact.artifactType === "CODEBASE_BUNDLE")), [artifacts]);
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<HostingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  const hostPlan = useHarnessF8Hdj({
    mutation: {
      onSuccess: (result) => {
        setPlan(result);
        setError(null);
      },
      onError: (cause) => {
        const parsed = extractApiError(cause);
        setError(parsed.message);
        setUpgrade(parsed.status === 402 || parsed.status === 403);
      },
    },
  });

  if (!certifiedPdd || !codeBundle) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<Lock className="h-12 w-12" />}
          title="F11 UPSTREAM GATES REQUIRED"
          body="Host Connector planning starts from a SPARTAN-certified MVP PDD and its F8 Code Oracle bundle. F11 never hosts an uncertified or hand-assembled source."
          hint="Complete F7/SPARTAN, then run F8 Code Oracle in this session."
        />
      </WorkspaceShell>
    );
  }

  const runPlan = () => {
    setError(null);
    setUpgrade(false);
    hostPlan.mutate({
      data: {
        sessionId,
        mvpPddArtifactId: certifiedPdd.id,
        codebaseBundleArtifactId: codeBundle.id,
        notes: notes.trim() || undefined,
      },
    });
  };

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 p-4 md:p-5" data-testid="workspace-f11-host-connector">
        <Card className="border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Server className="h-5 w-5" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">D37 · F11 HOST CONNECTOR</span>
              </div>
              <h2 className="mt-2 font-display text-2xl tracking-wider">HOST DJ → HOST CONDUCTOR</h2>
              <p className="mt-2 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
                F11 turns the certified F8 codebase or an F10 handoff into a plan-gated hosting path.
                The current provider connector is PRE-BUILD, so planning is available but every hosting write refuses.
              </p>
            </div>
            <div className="rounded border border-border/50 bg-background/60 px-3 py-2 font-mono text-[10px]">
              <div className="text-muted-foreground">SOURCE LINEAGE</div>
              <div className="mt-1 text-foreground">{certifiedPdd.id.slice(0, 10)}… → {codeBundle.id.slice(0, 10)}…</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">ORDERED HOST STRAND · H0–H8</h3>
          </div>
          <ol className="grid gap-2 md:grid-cols-3">
            {HOST_PHASES.map(([phase, name, detail], index) => {
              const complete = Boolean(plan) && index <= 3;
              const locked = index >= 4;
              return (
                <li key={phase} className={`rounded border p-3 ${complete ? "border-emerald-500/30 bg-emerald-500/5" : locked ? "border-border/40 bg-muted/20 opacity-70" : "border-primary/30 bg-primary/5"}`}>
                  <div className="flex items-center gap-2">
                    {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Route className="h-4 w-4 text-primary" />}
                    <span className="font-mono text-xs font-bold">{phase} · {name}</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
                  {locked && <p className="mt-2 font-mono text-[9px] font-bold uppercase text-amber-400">PRE-BUILD · REFUSED</p>}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="p-5">
          <div className="grid gap-3">
            <div>
              <label htmlFor="f11-notes" className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Hosting constraints and operator notes
              </label>
              <Textarea
                id="f11-notes"
                data-testid="f11-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 min-h-24 font-mono text-xs"
                maxLength={2000}
                placeholder="Region, compliance, traffic, database fit, or budget ceiling…"
              />
            </div>
            <div className="flex justify-end">
              <Button data-testid="f11-plan" onClick={runPlan} disabled={hostPlan.isPending} className="gap-2 font-mono text-xs">
                <Route className="h-3.5 w-3.5" />
                {hostPlan.isPending ? "RUNNING HOST DJ…" : "RUN H3 HOSTING PLAN"}
              </Button>
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
          {upgrade && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-[10px] text-amber-300">
              This plan requires the same provider access or entitlement gate as HOST DJ. No hosting write was attempted.
            </div>
          )}
        </Card>

        {plan && <PlanSummary plan={plan} />}

        <Card className="border-rose-500/30 bg-rose-500/5 p-5" data-testid="f11-execution-refusal">
          <div className="flex items-center gap-2 text-rose-400">
            <Ban className="h-5 w-5" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">H4–H8 EXECUTION REFUSED</h3>
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            F11 provider adapters, execution lifts, Vault scopes, consent/cost ceilings, UCG-HOST certification,
            production promotion, F9.5 monitoring registration, and HostReceipt handoff are not wired.
            This stage will not claim a deploy, certificate, promotion, monitoring registration, or F10 handoff.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}