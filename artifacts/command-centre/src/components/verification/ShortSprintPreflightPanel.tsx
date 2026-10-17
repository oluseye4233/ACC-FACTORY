import { useState } from "react";
import {
  getGetShortSprintPreflightQueryKey,
  useGetShortSprintPreflight,
  ShortSprintPreflightCircuit,
  ShortSprintPreflightTarget,
  ShortSprintPreflightProfile,
  type ShortSprintPreflight,
  type ShortSprintRuleResult,
} from "@workspace/api-client-react";
import { Download, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Circuit = keyof typeof ShortSprintPreflightCircuit;
type Target = keyof typeof ShortSprintPreflightTarget;
type Profile = keyof typeof ShortSprintPreflightProfile;

const short = (h: string | null) => (!h ? "none" : h.length > 16 ? `${h.slice(0, 12)}…${h.slice(-4)}` : h);

function Seg<T extends string>({ label, value, options, onChange, id }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={`font-mono text-[11px] px-2 py-1.5 rounded border min-h-[32px] ${value === o ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:text-foreground"}`}
            data-testid={`option-${id}-${o}`}>
            {o.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

// Bind generic props outside JSX: preview metadata injection cannot parse JSX
// type arguments, while an unbound generic widens these option values to string.
const CircuitSelector = Seg<Circuit>;
const TargetSelector = Seg<Target>;
const ProfileSelector = Seg<Profile>;

export function RuleStatusTag({ status }: { status: ShortSprintRuleResult["status"] }) {
  const map = {
    PASS: ["border-primary/50 text-primary bg-primary/10", "OBSERVED PASS"],
    FAIL: ["border-destructive/50 text-destructive bg-destructive/10", "FAIL"],
    UNKNOWN: ["border-dashed border-secondary/60 text-secondary bg-transparent", "EVIDENCE MISSING"],
  } as const;
  const [cls, text] = map[status] ?? map.UNKNOWN;
  return <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${cls}`} data-testid={`status-rule-${status}`}>{text}</span>;
}

function StateBanner({ state }: { state: ShortSprintPreflight["assessment"]["state"] }) {
  const msg =
    state === "ELIGIBLE"
      ? "Advisory eligibility observed. This is not approval, not certification and does not permit release."
      : state === "INELIGIBLE"
        ? "Blocked: at least one rule failed against observed evidence."
        : "Inconclusive: required evidence is missing or untrusted. Absence of evidence is not a pass.";
  const cls = state === "INELIGIBLE" ? "border-destructive/50 bg-destructive/5" : state === "ELIGIBLE" ? "border-primary/40 bg-primary/5" : "border-secondary/50 bg-secondary/10";
  return (
    <div className={`border rounded p-3 ${cls}`} data-testid="status-preflight-state">
      <div className="font-mono text-xs font-bold">{state}{state === "ELIGIBLE" ? " (ADVISORY)" : ""} · release allowed: no</div>
      <p className="font-mono text-[11px] mt-1">{msg}</p>
    </div>
  );
}

export function ShortSprintPreflightPanel({ sessionId }: { sessionId: string }) {
  const [circuit, setCircuit] = useState<Circuit>("SC_ONE");
  const [target, setTarget] = useState<Target>("SOFTWARE");
  const [profile, setProfile] = useState<Profile>("STANDARD");
  const params = { circuit, target, profile };
  const q = useGetShortSprintPreflight(sessionId, params, {
    query: { queryKey: getGetShortSprintPreflightQueryKey(sessionId, params), enabled: !!sessionId, staleTime: 30_000, gcTime: 120_000, refetchOnMount: "always", retry: 1 },
  });
  // Only show data that matches the currently selected options (no placeholder/old-result bleed).
  const raw = q.isError ? undefined : q.data;
  const d = raw && raw.circuit === circuit && raw.target === target && raw.profile === profile && raw.sessionId === sessionId ? raw : undefined;
  const counts = d ? { PASS: 0, FAIL: 0, UNKNOWN: 0, ...Object.fromEntries(["PASS", "FAIL", "UNKNOWN"].map((s) => [s, d.assessment.results.filter((r) => r.status === s).length])) } : null;

  const download = () => {
    if (!d) return;
    const payload = {
      kind: "short-sprints-preflight-snapshot",
      disclaimer: "Owner-only read-only advisory diagnostic. Options are temporary, not a persisted release decision. Not certification; releaseAllowed is always false. Legacy VERIFIED flags or advisory XVL PASS do not establish F4/F5 stage certification.",
      exportedAt: new Date().toISOString(),
      preflight: d,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `short-sprints-preflight-${sessionId.slice(0, 8)}-${circuit}-${target}-${profile}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section data-testid="section-short-sprints-preflight">
      <div className="flex flex-wrap items-baseline gap-3 border-b pb-2 mb-4">
        <span className="font-mono text-[10px] text-muted-foreground">00</span>
        <h2 className="text-2xl leading-none">SHORT SPRINTS preflight</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">read-only · advisory</span>
      </div>
      <div className="border rounded bg-card p-4 space-y-4">
        <p className="font-mono text-[10px] text-muted-foreground">
          Diagnostic options below are temporary and never saved. Nothing here approves, routes or releases. Until trusted adapters exist, every real preflight remains blocked or inconclusive.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <CircuitSelector label="Circuit" id="circuit" value={circuit} options={Object.values(ShortSprintPreflightCircuit) as Circuit[]} onChange={setCircuit} />
          <TargetSelector label="Target" id="target" value={target} options={Object.values(ShortSprintPreflightTarget) as Target[]} onChange={setTarget} />
          <ProfileSelector label="Profile" id="profile" value={profile} options={Object.values(ShortSprintPreflightProfile) as Profile[]} onChange={setProfile} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {q.isFetching && <span className="font-mono text-[10px] text-muted-foreground">checking</span>}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => q.refetch()} disabled={q.isFetching} data-testid="button-preflight-refresh">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-check
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!d || q.isFetching} data-testid="button-preflight-download">
            <Download className="h-3.5 w-3.5 mr-1" /> Snapshot JSON
          </Button>
        </div>

        {q.isError ? (
          <div className="border border-destructive/40 bg-destructive/5 rounded p-4 flex flex-col items-start gap-2" data-testid="status-preflight-error">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p className="font-mono text-xs">Preflight unavailable: {q.error instanceof Error ? q.error.message : "request failed"}. No result is shown.</p>
            <Button size="sm" onClick={() => q.refetch()} data-testid="button-preflight-retry">Retry</Button>
          </div>
        ) : !d ? (
          <div className="space-y-2" data-testid="status-preflight-loading">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4 font-mono text-[11px]">
            <StateBanner state={d.assessment.state} />
            <div className="border rounded p-3" data-testid="text-preflight-source">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Source version</div>
              {d.source ? (
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>{d.source.artifactType} · {d.source.name ?? d.source.id.slice(0, 8)}</span>
                  <span>created {new Date(d.source.createdAt).toLocaleString()}</span>
                  <span>hash {short(d.source.hash)}</span>
                  <span className="text-secondary">certification {d.source.certification.replace(/_/g, " ")}</span>
                </div>
              ) : (
                <p className="text-secondary" data-testid="text-preflight-no-source">No MICRO PDD or SPC source found. Preflight cannot establish eligibility without one.</p>
              )}
            </div>
            {counts && (
              <div className="flex flex-wrap gap-3 text-[10px]" data-testid="text-preflight-counts">
                <span className="text-primary">{counts.PASS} observed pass</span>
                <span className="text-destructive">{counts.FAIL} fail</span>
                <span className="text-secondary">{counts.UNKNOWN} evidence missing</span>
              </div>
            )}
            <ul className="divide-y border rounded">
              {d.assessment.results.map((r) => (
                <li key={r.id} className="p-3 space-y-1" data-testid={`row-preflight-rule-${r.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <RuleStatusTag status={r.status} />
                    <span className="font-bold">{r.id}</span>
                    {r.evidenceHash && <span className="ml-auto text-[10px] text-muted-foreground">ev {short(r.evidenceHash)}</span>}
                  </div>
                  <p>{r.reason}</p>
                  {r.remedy && <p className="text-muted-foreground">Fix: {r.remedy}</p>}
                </li>
              ))}
              {d.assessment.results.length === 0 && <li className="p-3 text-muted-foreground">No rules evaluated.</li>}
            </ul>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Mandatory downstream stages</div>
                {d.assessment.requiredPostStages.length ? (
                  <div className="flex flex-wrap gap-1" data-testid="text-preflight-post-stages">
                    {d.assessment.requiredPostStages.map((s) => <span key={s} className="bg-muted px-1.5 rounded">{s}</span>)}
                  </div>
                ) : <span className="text-muted-foreground">none listed</span>}
                <p className="mt-2">Verification pack required: {d.assessment.verificationPackRequired ? "yes" : "no"}</p>
                {d.assessment.additionalRegulatedTracks.length > 0 && (
                  <p className="mt-1">Regulated tracks: {d.assessment.additionalRegulatedTracks.join(", ")}</p>
                )}
              </div>
              <div className="border border-secondary/40 rounded p-3 bg-secondary/5" data-testid="text-preflight-limitation">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Limitations</div>
                <p>{d.assessment.limitation}</p>
                <p className="mt-1">Legacy VERIFIED / forgeVerified flags and advisory XVL PASS do not establish F4/F5 stage certification.</p>
                {d.evidenceNotes.length > 0 && <ul className="mt-1 list-disc pl-4">{d.evidenceNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4">
              <span>policy {d.assessment.policyVersion}</span>
              <span>eligibility {short(d.assessment.eligibilityHash)}</span>
              <span>evidence {short(d.evidenceHash)}</span>
              <span data-testid="text-preflight-checked-at">checked {new Date(d.checkedAt).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ShortSprintPreflightPanel;
