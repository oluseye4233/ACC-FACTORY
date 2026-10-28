import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetStageSupportDepartureQueryKey, getListBoomerangCasesQueryKey, getListSessionArtifactsQueryKey } from "@workspace/api-client-react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, CornerDownLeft, Loader2 } from "lucide-react";
import { RETURN_WITH_ARTIFACT_LABEL } from "@/components/boomerang/ReturnedUpgrade";
import { sessionStageHref } from "@/lib/stage-origin";
import { isUuid, readSupportCaseId, readSupportResultId, supportErrMessage, useDeparture, useReturnDeparture, type Departure } from "@/lib/stage-support";

/** Reads supportCaseId from the URL and loads the server departure. */
export function useStageSupportCase() {
  const caseId = readSupportCaseId(useSearch());
  const resultId = readSupportResultId(useSearch());
  const dep = useDeparture(caseId);
  return { resultId, caseId, departure: dep.data ?? null, isLoading: dep.isLoading, isError: dep.isError, error: dep.error as Error | null, refetch: dep.refetch };
}

/** Navigation-only banner. Never returns work. */
export function StageSupportBanner({ caseId, departure, isLoading, isError, error, refetch }: ReturnType<typeof useStageSupportCase>) {
  if (!caseId) return null;
  return (
    <div className="border-b border-primary/30 bg-primary/5" role="region" aria-label="Stage support origin" data-testid="banner-stage-support">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2 md:px-8">
        {isLoading ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" role="status">Loading the stage you left…</span>
        ) : isError || !departure ? (
          <p role="alert" className="flex-1 font-mono text-[11px] text-destructive">
            Support case unavailable: {error ? supportErrMessage(error) : "not found"}. Nothing will be returned.{" "}
            <button type="button" className="underline" onClick={() => refetch()} data-testid="button-retry-departure">Retry</button>
          </p>
        ) : (
          <>
            <Link href={sessionStageHref(departure.sessionId, departure.featureId)} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-back-to-stage">
              <ArrowLeft className="h-3 w-3" /> Back to {departure.stageLabel}
            </Link>
            <p className="min-w-0 flex-1 text-[11px] text-muted-foreground" data-testid="text-departure-source">
              Opened from session {departure.sessionId.slice(0, 8)} at {departure.stageLabel} · source {departure.sourceTitle || departure.sourceId.slice(0, 8)}. Back only navigates; it returns no work.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Explicit return of a completed saved result. Confirms, calls the return API, then navigates. */
export function StageSupportReturnAction({ departure, resultId, compact = false, blockedReason }: { departure: Departure | null; resultId: string | null | undefined; compact?: boolean; blockedReason?: string | null }) {
  const [, setLocation] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const mut = useReturnDeparture(departure?.caseId ?? "");
  const qc = useQueryClient();
  if (!departure || !isUuid(resultId)) return null;
  const go = () => mut.mutate(resultId, {
    onSuccess: async (r) => {
      // Drop cached session/Boomerang/departure views so the candidate shows immediately.
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(departure.sessionId) }),
        qc.invalidateQueries({ queryKey: getListBoomerangCasesQueryKey().slice(0, 1) }),
        qc.invalidateQueries({ queryKey: getGetStageSupportDepartureQueryKey(departure.caseId) }),
      ]).catch(() => undefined);
      setLocation(r.returnedArtifactHref);
    },
  });
  return (
    <div className={`rounded border border-primary/50 bg-primary/5 p-3 space-y-2 ${compact ? "" : "mt-2"}`} data-testid={`panel-stage-return-${resultId}`}>
      {blockedReason && <p role="status" className="font-mono text-[11px] text-secondary" data-testid="text-stage-return-blocked">{blockedReason}</p>}
      {!confirming ? (
        <button type="button" disabled={!!blockedReason} onClick={() => setConfirming(true)} className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-stage-return">
          <CornerDownLeft className="h-3.5 w-3.5 shrink-0" /> {RETURN_WITH_ARTIFACT_LABEL}
        </button>
      ) : (
        <div className="space-y-2" role="group" aria-label="Confirm return">
          <p className="font-mono text-[11px]">
            Return saved result {resultId.slice(0, 8)} to {departure.stageLabel}? It attaches as a candidate requiring review and fresh evaluation. It does not pass, certify or advance the gate, and does not claim the target is corrected.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={mut.isPending || !!blockedReason} onClick={go} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-primary-foreground disabled:opacity-60" data-testid="button-confirm-stage-return">
              {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} {mut.isPending ? "Returning…" : "Confirm return"}
            </button>
            <button type="button" disabled={mut.isPending} onClick={() => { setConfirming(false); mut.reset(); }} className="rounded border px-3 py-1.5 font-mono text-[10px] uppercase" data-testid="button-cancel-stage-return">Cancel</button>
          </div>
        </div>
      )}
      {mut.isError && <p role="alert" className="font-mono text-[11px] text-destructive" data-testid="text-stage-return-error">Return failed: {supportErrMessage(mut.error)}. The return was not confirmed. Retry safely or reopen this departure; a completed return is reused.</p>}
    </div>
  );
}
