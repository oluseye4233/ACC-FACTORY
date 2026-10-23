import { useCallback, useState } from "react";
import { useGetConvenerDashboard, getGetConvenerDashboardQueryKey, type CohortLearner, type LearningLesson } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { apiErr } from "@/components/learning/learning-model";
import { PerformancePanel } from "./PerformancePanel";
import { FollowupsPanel, type FollowupDraft } from "./FollowupsPanel";
import { MeetingsPanel } from "./MeetingsPanel";
import { LibraryPanel } from "./LibraryPanel";
import { EmailPanel } from "./EmailPanel";
import { STALE } from "./convener-model";

export type ConvenerTab = "performance" | "followups" | "meetings" | "library" | "email";

export function ConvenerWorkspace({ cohortId, cohortTitle, lessons, tab, onTab, readOnly, cohortEndsAt }: { cohortId: string; cohortTitle?: string; lessons: LearningLesson[]; tab: ConvenerTab; onTab: (t: ConvenerTab) => void; readOnly?: boolean; cohortEndsAt?: string }) {
  const q = useGetConvenerDashboard(cohortId, { query: { queryKey: getGetConvenerDashboardQueryKey(cohortId), enabled: !!cohortId, staleTime: STALE, refetchInterval: STALE, retry: 1, refetchOnWindowFocus: false } });
  const [seed, setSeed] = useState<FollowupDraft | null>(null);
  const clearSeed = useCallback(() => setSeed(null), []);

  if (q.isLoading) return <div className="space-y-2" data-testid="state-convener-loading">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse" />)}</div>;
  if (q.isError || !q.data) {
    const status = (q.error as { status?: number } | null)?.status;
    return (
      <div className="border border-destructive/50 rounded-md p-4 space-y-2" data-testid="state-convener-error">
        <p className="text-sm text-destructive">{status === 403 ? "You are not assigned to convene this cohort." : apiErr(q.error).message}</p>
        {status !== 403 && <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-convener">Retry</Button>}
      </div>
    );
  }
  const dash = q.data;
  const draftFrom = (l: CohortLearner) => {
    setSeed({ membershipId: l.membershipId, title: `Next steps for ${l.name}`, feedback: l.recentFeedback[0] ?? "", actionPlan: l.recommendation, state: "OPEN" });
    onTab("followups");
  };

  return (
    <div className={`space-y-4 ${q.isFetching ? "opacity-90 transition-opacity" : ""}`}>
      {readOnly && <p className="border rounded-md p-3 text-xs bg-muted/40" role="status" data-testid="state-cohort-closed">This cohort is closed or past its end date. Records stay readable; new follow-ups, meetings, shares and email are disabled.</p>}
      {tab === "performance" && <PerformancePanel dash={dash} onDraft={draftFrom} readOnly={readOnly} />}
      {tab === "followups" && <FollowupsPanel cohortId={cohortId} dash={dash} lessons={lessons} seed={seed} onSeedUsed={clearSeed} readOnly={readOnly} />}
      {tab === "meetings" && <MeetingsPanel cohortId={cohortId} cohortTitle={cohortTitle} dash={dash} readOnly={readOnly} cohortEndsAt={cohortEndsAt} />}
      {tab === "library" && <LibraryPanel cohortId={cohortId} dash={dash} lessons={lessons} readOnly={readOnly} />}
      {tab === "email" && <EmailPanel cohortId={cohortId} dash={dash} readOnly={readOnly} />}
    </div>
  );
}
