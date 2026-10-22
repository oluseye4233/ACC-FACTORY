import { useQueryClient } from "@tanstack/react-query";
import {
  useGetArtifactGovernance,
  useInstallArtifactGovernance,
  getGetArtifactGovernanceQueryKey,
  getListArtifactsQueryKey,
  getListF10SourcesQueryKey,
  getListSessionArtifactsQueryKey,
  type ArtifactGovernanceStatus,
  type GovernanceSelection,
  type GovernanceSelectionModulesItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldQuestion, RotateCcw, GitBranchPlus } from "lucide-react";
import { extractApiError } from "@/lib/sse";
import { GOVERNANCE_MODULES, validateGovernanceSelection } from "./governance-selection";

const STATUS_COPY: Record<string, { label: string; tone: string; note: string }> = {
  CRITERIA_INSTALLED: { label: "Criteria installed", tone: "bg-primary/15 text-primary border-primary/40", note: "Versioned criteria are present. This is not a pass, evaluation or certification." },
  REVIEW_REQUIRED: { label: "GRO GREY · review required", tone: "bg-secondary/15 text-secondary border-secondary/40", note: "External export is held until reviewed. Internal F0 / SPC Player remediation remains available." },
  BLOCKED: { label: "GRO RED · blocked", tone: "bg-destructive/15 text-destructive border-destructive/40", note: "External export is blocked. Remediate privately (F0 / SPC Player)." },
  LEGACY_UNVERIFIED: { label: "Legacy · no criteria", tone: "bg-muted text-muted-foreground border-border", note: "This artifact predates governance. It is not silently approved; create a governed revision to export externally." },
  INVALID: { label: "Criteria malformed", tone: "bg-destructive/15 text-destructive border-destructive/40", note: "Installed criteria do not match the content hash. Create a new governed revision." },
};

const MODULE_LABEL: Record<GovernanceSelectionModulesItem, string> = { GRO: "GRO", ZPOS: "ZPOS", HONESTY_GATE: "Honesty Gate" };

interface Props {
  artifactId: string;
  sessionId?: string;
  onRevisionCreated?: (status: ArtifactGovernanceStatus) => void;
  selection?: GovernanceSelection;
  onSelectionChange?: (s: GovernanceSelection) => void;
  disabled?: boolean;
}

export function GovernancePanel({ artifactId, sessionId, onRevisionCreated, selection, onSelectionChange, disabled }: Props) {
  const qc = useQueryClient();
  const q = useGetArtifactGovernance(artifactId, {
    query: { enabled: !!artifactId, queryKey: getGetArtifactGovernanceQueryKey(artifactId) },
  });
  const install = useInstallArtifactGovernance({
    mutation: {
      onSuccess: (status) => {
        qc.setQueryData(getGetArtifactGovernanceQueryKey(status.artifactId), status);
        qc.invalidateQueries({ queryKey: getListArtifactsQueryKey() });
        qc.invalidateQueries({ queryKey: getListF10SourcesQueryKey() });
        if (sessionId) qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        if (status.artifactId !== artifactId) onRevisionCreated?.(status);
      },
    },
  });

  const data = q.data;
  const needsRevision = !!data && (!data.installed || data.status === "LEGACY_UNVERIFIED" || data.status === "INVALID");
  const copy = data ? STATUS_COPY[data.status] ?? { label: data.status, tone: "bg-muted", note: "" } : null;
  const selError = selection ? validateGovernanceSelection(selection) : null;
  const omitted = selection ? GOVERNANCE_MODULES.filter((m) => !selection.modules.includes(m)) : [];

  const toggleModule = (m: GovernanceSelectionModulesItem) => {
    if (!selection || !onSelectionChange) return;
    const has = selection.modules.includes(m);
    const modules = GOVERNANCE_MODULES.filter((x) => (x === m ? !has : selection.modules.includes(x)));
    onSelectionChange({ mode: "FRAGMENTED", modules });
  };

  return (
    <section aria-labelledby={`gov-${artifactId}`} className="rounded-sm border border-border bg-card/40 p-4 space-y-3" data-testid="governance-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldQuestion className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h4 id={`gov-${artifactId}`} className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Governance criteria · GRO / ZPOS / Honesty Gate
        </h4>
        {copy && (
          <Badge variant="outline" className={`ml-auto rounded-sm font-mono text-[10px] ${copy.tone}`} data-testid="status-governance">
            {copy.label}
          </Badge>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading governance status">
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      ) : q.isError || !data ? (
        <div role="alert" className="flex items-center gap-3 font-mono text-xs text-destructive">
          Governance status unavailable: {extractApiError(q.error).message}
          <Button size="sm" variant="outline" className="font-mono text-[10px]" onClick={() => q.refetch()} data-testid="button-governance-retry">
            <RotateCcw className="h-3 w-3 mr-1" /> RETRY
          </Button>
        </div>
      ) : (
        <>
          <p className="font-mono text-[11px] text-foreground/80">{copy?.note}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px]">
            <dt className="text-muted-foreground uppercase">Assessment</dt>
            <dd data-testid="text-governance-assessment">{data.assessment}{data.assessment !== "NOT_EVALUATED" && " (model-reported, not independently verified)"}</dd>
            <dt className="text-muted-foreground uppercase">Source hash</dt>
            <dd className="break-all" data-testid="text-governance-hash">sha256:{data.sourceContentHash}</dd>
          </dl>
          <p className="font-mono text-[10px] text-muted-foreground border-l-2 border-border pl-2" data-testid="text-governance-caveat">{data.caveat}</p>

          {needsRevision && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-muted-foreground">
                Creates a NEW private, unverified revision with criteria installed. The original is untouched. Nothing is approved, advanced or executed.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-[10px]"
                disabled={disabled || install.isPending}
                aria-busy={install.isPending}
                onClick={() => install.mutate({ artifactId, data: { confirmCreateRevision: true } })}
                data-testid="button-governance-create-revision"
              >
                <GitBranchPlus className="h-3 w-3 mr-1" />
                {install.isPending ? "CREATING REVISION…" : "CREATE GOVERNED REVISION"}
              </Button>
              {install.isError && (
                <p role="alert" className="font-mono text-[10px] text-destructive">{extractApiError(install.error).message}</p>
              )}
            </div>
          )}
        </>
      )}

      {selection && onSelectionChange && (
        <fieldset className="space-y-2 border-t border-border pt-3" disabled={disabled}>
          <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SAVANT package installation</legend>
          <div role="radiogroup" aria-label="Installation mode" className="flex gap-2">
            {(["FULL", "FRAGMENTED"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selection.mode === mode}
                size="sm"
                variant={selection.mode === mode ? "default" : "outline"}
                className="font-mono text-[10px]"
                onClick={() => onSelectionChange(mode === "FULL" ? { mode, modules: [...GOVERNANCE_MODULES] } : { mode, modules: selection.mode === "FULL" ? ["GRO"] : selection.modules })}
                data-testid={`button-governance-mode-${mode.toLowerCase()}`}
              >
                {mode}
              </Button>
            ))}
          </div>
          {selection.mode === "FRAGMENTED" && (
            <div className="flex flex-wrap gap-3">
              {GOVERNANCE_MODULES.map((m) => (
                <label key={m} className="flex items-center gap-1.5 font-mono text-[11px]">
                  <input type="checkbox" checked={selection.modules.includes(m)} onChange={() => toggleModule(m)} data-testid={`checkbox-governance-${m}`} />
                  {MODULE_LABEL[m]}
                </label>
              ))}
            </div>
          )}
          {selError && <p role="alert" className="font-mono text-[10px] text-destructive" data-testid="text-governance-selection-error">{selError}</p>}
          {!selError && omitted.length > 0 && (
            <p className="font-mono text-[10px] text-secondary" data-testid="text-governance-partial">
              PARTIAL INSTALLATION: {omitted.map((m) => MODULE_LABEL[m]).join(", ")} omitted — not installed by this package. NOT production-ready: every mandatory safeguard must be covered elsewhere (agent instructions, middleware, tool authorization) and verified before production.
            </p>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">
            PREPARATION ONLY. Deterministic module selection — not a SAVANT FIT verdict, target qualification, enforcement, deployment or production readiness.{" "}
            {!selError && omitted.length === 0 && "FULL includes all criteria but is still not verified or installed on any target automatically."}
          </p>
        </fieldset>
      )}
    </section>
  );
}
