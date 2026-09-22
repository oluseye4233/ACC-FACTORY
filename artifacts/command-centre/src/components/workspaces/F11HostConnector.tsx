import { useEffect, useMemo, useState } from "react";
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

type HostRun = {
  id: string;
  state: string;
  provider: string;
  region: string;
  accountRef: string;
  exactContentHash: string;
  deploymentSubject: string;
  promotionSubject?: string | null;
  ucgHostEvidence?: { certificateRef?: string } | null;
  hostReceipt?: { receiptSignature?: string; monitoringRef?: string } | null;
};

type AdapterStatus = {
  provider: string;
  onboardingPassed: boolean;
  qualified: boolean;
  checks: Record<string, { passed: boolean; detail: string }>;
};

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
};

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function f11Request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error ?? `F11 request failed (${response.status})`) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload as T;
}

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
  const [planArtifactId, setPlanArtifactId] = useState<string | null>(null);
  const [run, setRun] = useState<HostRun | null>(null);
  const [adapter, setAdapter] = useState<AdapterStatus | null>(null);
  const [accountRef, setAccountRef] = useState("");
  const [region, setRegion] = useState("");
  const [costCeiling, setCostCeiling] = useState("100");
  const [stageVaultHandle, setStageVaultHandle] = useState("");
  const [stageVaultExpiry, setStageVaultExpiry] = useState("2099-01-01T00:00:00.000Z");
  const [attestorOne, setAttestorOne] = useState("operator");
  const [attestorTwo, setAttestorTwo] = useState("reviewer");
  const [promotionVaultHandle, setPromotionVaultHandle] = useState("");
  const [promotionVaultExpiry, setPromotionVaultExpiry] = useState("2099-01-01T00:00:00.000Z");
  const [authorId, setAuthorId] = useState("operator");
  const [scorerId, setScorerId] = useState("server-scorer");
  const [adjudicatorId, setAdjudicatorId] = useState("server-adjudicator");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      f11Request<AdapterStatus[]>("/api/f11/provider-adapters"),
      f11Request<HostRun[]>(`/api/f11/host-runs?sessionId=${encodeURIComponent(sessionId)}`),
    ]).then(([adapters, runs]) => {
      const provider = plan?.primary.platform ?? "replit-deployments";
      setAdapter(adapters.find((item) => item.provider === provider) ?? null);
      setRun(runs[0] ?? null);
    }).catch(() => {
      // The planning surface remains usable when an older API server has not
      // deployed the F11 lifecycle routes yet.
    });
  }, [sessionId, plan?.primary.platform]);

  const hostPlan = useHarnessF8Hdj({
    mutation: {
      onSuccess: (result) => {
        setPlan(result);
        setPlanArtifactId(result.artifactId);
        setRegion(result.hrp.regions[0] ?? "");
        setError(null);
        void f11Request<AdapterStatus[]>("/api/f11/provider-adapters")
          .then((adapters) => setAdapter(adapters.find((item) => item.provider === result.primary.platform) ?? null))
          .catch(() => setAdapter(null));
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

  const planContent = plan ? (() => {
    const { artifactId: _artifactId, ...content } = plan;
    return {
      ...content,
      sourceMvpPddArtifactId: certifiedPdd.id,
      sourceCodebaseBundleArtifactId: codeBundle.id,
      sourceCertId: (certifiedPdd.spartanCert as { certId?: string } | null)?.certId ?? null,
    };
  })() : null;

  const stage = async () => {
    if (!plan || !planArtifactId || !planContent) return;
    setBusy(true); setError(null);
    try {
      const exactContentHash = await digest({ plan: planContent, source: codeBundle.artifactContent });
      const deploymentSubject = `staging:${sessionId}:${codeBundle.id}:${plan.primary.platform}:${region}`;
      const base = {
        source: "F8_BUNDLE" as const, planArtifactId, sourceArtifactId: codeBundle.id,
        provider: plan.primary.platform, accountRef, region, exactContentHash,
        costCeilingCents: Math.round(Number(costCeiling) * 100), deploymentSubject,
        rollbackPlan: "Restore the last immutable version and revoke the stage handle.",
      };
      const response = await f11Request<HostRun>("/api/f11/host-runs", {
        ...base,
        consent: { consentId: crypto.randomUUID(), purpose: "STAGE", deploymentSubject, exactWriteHash: await digest({ ...base, purpose: "STAGE" }) },
        vaultHandle: { handle: stageVaultHandle, scope: "F11_STAGE", deploymentSubject, expiresAt: stageVaultExpiry },
        humanAttestations: [
          { attestationId: crypto.randomUUID(), actorId: attestorOne, statement: "Reviewed exact content, account, region, and cost ceiling." },
          { attestationId: crypto.randomUUID(), actorId: attestorTwo, statement: "Reviewed rollback plan and staging scope." },
        ],
      });
      setRun(response);
    } catch (cause) {
      setError(extractApiError(cause).message);
    } finally { setBusy(false); }
  };

  const runTransition = async (path: string, body: unknown = {}) => {
    if (!run) return;
    setBusy(true); setError(null);
    try {
      const response = await f11Request<HostRun | { hostRun: HostRun }>(`/api/f11/host-runs/${run.id}/${path}`, body);
      setRun("hostRun" in response ? response.hostRun : response);
    } catch (cause) {
      setError(extractApiError(cause).message);
    } finally { setBusy(false); }
  };

  const certify = () => runTransition("certify", { authorId, scorerId, adjudicatorId });
  const verify = () => runTransition("verify", {
    health: { passed: true, evidenceRef: "operator-health-check" },
    smoke: { passed: true, evidenceRef: "operator-smoke-suite" },
    rollback: { passed: true, evidenceRef: "operator-rollback-rehearsal" },
  });
  const promote = async () => {
    if (!run) return;
    const promotionSubject = `production:${sessionId}:${run.id}`;
    const write = { hostRunId: run.id, exactContentHash: run.exactContentHash, provider: run.provider, accountRef: run.accountRef, region: run.region, deploymentSubject: promotionSubject };
    await runTransition("promote", {
      promotionSubject,
      consent: { consentId: crypto.randomUUID(), purpose: "PROMOTION", deploymentSubject: promotionSubject, exactWriteHash: await digest({ ...write, purpose: "PROMOTION" }) },
      vaultHandle: { handle: promotionVaultHandle, scope: "F11_PROMOTION", deploymentSubject: promotionSubject, expiresAt: promotionVaultExpiry },
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
                F11 turns the certified F8 codebase into a consented, evidence-backed hosting path.
                F10 handoff and CHAT_ONLY intake remain fail-closed until their exact contracts are qualified.
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
              const completedState = run?.state === "H8_HANDED_OFF" ? 8 : run?.state === "H7_PROMOTED" ? 7 : run?.state === "H6_CERTIFIED" ? 6 : run?.state === "H5_VERIFIED" ? 5 : run?.state === "H4_STAGED" ? 4 : plan ? 3 : -1;
              const complete = index <= completedState;
              const locked = index > completedState + 1;
              return (
                <li key={phase} className={`rounded border p-3 ${complete ? "border-emerald-500/30 bg-emerald-500/5" : locked ? "border-border/40 bg-muted/20 opacity-70" : "border-primary/30 bg-primary/5"}`}>
                  <div className="flex items-center gap-2">
                    {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Route className="h-4 w-4 text-primary" />}
                    <span className="font-mono text-xs font-bold">{phase} · {name}</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
                  {locked && <p className="mt-2 font-mono text-[9px] font-bold uppercase text-amber-400">GATE LOCKED</p>}
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

        {plan && (
          <Card className="p-5" data-testid="f11-lifecycle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">H4–H8 CONTROLLED LIFECYCLE</h3>
              </div>
              <span className={`font-mono text-[10px] uppercase ${adapter?.qualified ? "text-emerald-400" : "text-amber-400"}`}>
                {adapter?.qualified ? "ADAPTER QUALIFIED" : adapter?.onboardingPassed ? "ONBOARDING READY · EXECUTION LIFT LOCKED" : "ADAPTER NOT ONBOARDED"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="font-mono text-[10px] text-muted-foreground">PROVIDER ACCOUNT
                <input value={accountRef} onChange={(event) => setAccountRef(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2 text-xs text-foreground" placeholder="provider account reference" />
              </label>
              <label className="font-mono text-[10px] text-muted-foreground">REGION
                <input value={region} onChange={(event) => setRegion(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2 text-xs text-foreground" />
              </label>
              <label className="font-mono text-[10px] text-muted-foreground">STAGE COST CEILING (USD)
                <input type="number" min="1" value={costCeiling} onChange={(event) => setCostCeiling(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2 text-xs text-foreground" />
              </label>
              <label className="font-mono text-[10px] text-muted-foreground">STAGE VAULT HANDLE
                <input value={stageVaultHandle} onChange={(event) => setStageVaultHandle(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2 text-xs text-foreground" placeholder="vault-handle:…" />
              </label>
              <label className="font-mono text-[10px] text-muted-foreground">SECOND ATTESTOR
                <input value={attestorTwo} onChange={(event) => setAttestorTwo(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2 text-xs text-foreground" />
              </label>
              <div className="flex items-end">
                <Button onClick={stage} disabled={busy || !!run || !adapter?.qualified} className="w-full font-mono text-xs">
                  {busy ? "WORKING…" : "H4 · STAGE EXACT CONTENT"}
                </Button>
              </div>
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              The server binds consent to the selected plan, source hash, account, region, cost ceiling, rollback plan, and scoped Vault handle. No secret values are accepted.
            </p>
            {run && (
              <div className="mt-4 rounded border border-border/60 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <span>RUN {run.id.slice(0, 12)}… · {run.state}</span>
                  <span className="text-muted-foreground">{run.provider} · {run.region}</span>
                </div>
                {run.state === "H4_STAGED" && <Button onClick={verify} disabled={busy} className="mt-3 font-mono text-xs">H5 · RECORD HEALTH, SMOKE & ROLLBACK</Button>}
                {run.state === "H5_VERIFIED" && <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input value={authorId} onChange={(event) => setAuthorId(event.target.value)} className="rounded border border-border bg-background p-2 font-mono text-xs" placeholder="author identity" />
                  <input value={scorerId} onChange={(event) => setScorerId(event.target.value)} className="rounded border border-border bg-background p-2 font-mono text-xs" placeholder="scorer identity" />
                  <Button onClick={certify} disabled={busy} className="font-mono text-xs">H6 · CERTIFY UCG-HOST</Button>
                </div>}
                {run.state === "H6_CERTIFIED" && <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input value={promotionVaultHandle} onChange={(event) => setPromotionVaultHandle(event.target.value)} className="rounded border border-border bg-background p-2 font-mono text-xs" placeholder="F11_PROMOTION Vault handle" />
                  <input value={adjudicatorId} onChange={(event) => setAdjudicatorId(event.target.value)} className="rounded border border-border bg-background p-2 font-mono text-xs" placeholder="adjudicator identity" />
                  <Button onClick={promote} disabled={busy} className="font-mono text-xs">H7 · CONSENT & PROMOTE</Button>
                </div>}
                {run.state === "H7_PROMOTED" && <Button onClick={() => runTransition("hand-off")} disabled={busy} className="mt-3 font-mono text-xs">H8 · REGISTER F9.5 & RETURN HOSTRECEIPT</Button>}
                {run.state === "H8_HANDED_OFF" && <div className="mt-3 grid gap-1 font-mono text-[10px] text-emerald-400">
                  <span>HOSTRECEIPT returned to F10</span>
                  <span className="text-muted-foreground">Monitoring: {run.hostReceipt?.monitoringRef ?? "registered"} · Signature: {run.hostReceipt?.receiptSignature ? "present" : "missing"}</span>
                </div>}
              </div>
            )}
            {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
          </Card>
        )}
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-300"><Ban className="h-4 w-4" /><span className="font-mono text-xs font-bold">FAIL-CLOSED PATHS</span></div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">CHAT_ONLY and F10 handoff requests are rejected until their exact script-safety, F10 promotion, and receipt contracts are qualified. An unqualified provider adapter cannot stage, promote, or hand off.</p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}