import {
  createStageSupportDeparture,
  getGetStageSupportDepartureQueryKey,
  getGetStageSupportOptionsQueryKey,
  getStageSupportDeparture,
  getStageSupportOptions,
  returnStageSupportArtifact,
} from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";

/** "agent-creator" is cast through until the regenerated spec includes it; "short-sprints" stays valid for historical departures. */
export type SupportTool = "imprima" | "short-sprints" | "ingestion" | "cartridge" | "f0" | "agent-creator";
export interface SupportToolStatus { tool: SupportTool; active: boolean; reason: string }
export interface StageSupportOptions { tools: SupportToolStatus[]; sourceId: string | null }
export interface Departure {
  caseId: string;
  tool: SupportTool;
  sessionId: string;
  featureId: number;
  stageLabel: string;
  sourceId: string;
  sourceKind: string | null;
  sourceTitle: string;
  sourceText: string;
  launchHref: string;
  returnedArtifactHref: string | null;
  f0EngagementId?: string | null;
}
export interface DepartureReturn { returnedArtifactId: string; returnedArtifactHref: string; upgradeLabel: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalise generated-client errors (customFetch puts the body on .data). */
export function supportErrMessage(e: unknown): string {
  const d = (e as { data?: { error?: string } } | null)?.data;
  if (d?.error) return d.error;
  return e instanceof Error ? e.message : "Request failed";
}

export const stageSupportApi = {
  options: (sessionId: string, featureId: number) =>
    getStageSupportOptions({ sessionId, featureId }) as unknown as Promise<StageSupportOptions>,
  depart: (body: { sessionId: string; featureId: number; tool: SupportTool }) =>
    createStageSupportDeparture(body as Parameters<typeof createStageSupportDeparture>[0]) as unknown as Promise<Departure>,
  departure: (id: string) => getStageSupportDeparture(id) as unknown as Promise<Departure>,
  return: (id: string, resultId: string) =>
    returnStageSupportArtifact(id, { resultId }) as unknown as Promise<DepartureReturn>,
};

export function readSupportCaseId(search: string): string {
  const v = new URLSearchParams(search).get("supportCaseId") ?? "";
  return UUID.test(v) ? v : "";
}

/** Saved result id persisted in the URL so the return survives refresh/back. */
export function readSupportResultId(search: string): string {
  const v = new URLSearchParams(search).get("supportResultId") ?? "";
  return UUID.test(v) ? v : "";
}

export function withSupportResultId(location: string, search: string, resultId: string): string {
  const q = new URLSearchParams(search);
  q.set("supportResultId", resultId);
  return `${location}?${q.toString()}`;
}

export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}

export function useStageSupportOptions(sessionId: string, featureId: number, enabled: boolean) {
  return useQuery({
    queryKey: getGetStageSupportOptionsQueryKey({ sessionId, featureId }),
    queryFn: () => stageSupportApi.options(sessionId, featureId),
    enabled: enabled && !!sessionId,
    retry: false,
    // A stage can produce its first saved source while the footer stays mounted.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useDeparture(caseId: string) {
  return useQuery({
    queryKey: getGetStageSupportDepartureQueryKey(caseId),
    queryFn: () => stageSupportApi.departure(caseId),
    enabled: !!caseId,
    retry: false,
  });
}

export function useLaunchDeparture() {
  return useMutation({ mutationFn: stageSupportApi.depart });
}

export function useReturnDeparture(caseId: string) {
  return useMutation({ mutationFn: (resultId: string) => stageSupportApi.return(caseId, resultId) });
}
