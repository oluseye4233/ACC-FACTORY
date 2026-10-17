import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReviewLearningAttempt, type LearningAssignment, type LearningLesson, type LearningMembership } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttemptHistory, ModeTag } from "./LessonWorkbench";
import { apiErr, invalidateLearning, latestSubmission } from "./learning-model";

function ReviewItem({ a, lesson, member }: { a: LearningAssignment; lesson?: LearningLesson; member?: LearningMembership }) {
  const qc = useQueryClient();
  const review = useReviewLearningAttempt();
  const [fb, setFb] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const last = latestSubmission(a);
  const canReview = !!last && a.state === "SUBMITTED";
  const ok = fb.trim().length >= 10 && fb.trim().length <= 4000;

  const decide = (decision: "LEARNING_COMPLETE" | "REVISION_REQUIRED") => {
    if (!last) return;
    setErr(null);
    review.mutate({ data: { submissionId: last.id, expectedVersion: a.version, decision, feedback: fb.trim() } }, {
      onSuccess: () => setFb(""),
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <article className="border rounded-md p-3 bg-card space-y-2" data-testid={`review-item-${a.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <b>{member?.name ?? "Student"}</b><span className="text-muted-foreground">·</span><span>{lesson?.title ?? a.lessonKey}</span>
        {lesson && <ModeTag mode={lesson.mode} />}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{a.state} · v{a.version}</span>
      </div>
      <AttemptHistory a={a} />
      {canReview && (
        <div className="space-y-2">
          <Textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Feedback (10+ characters, required for either decision)" data-testid={`input-feedback-${a.id}`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ok || review.isPending} onClick={() => decide("LEARNING_COMPLETE")} data-testid={`button-complete-${a.id}`}>Learning complete</Button>
            <Button size="sm" variant="outline" disabled={!ok || review.isPending} onClick={() => decide("REVISION_REQUIRED")} data-testid={`button-revise-${a.id}`}>Revision required</Button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
    </article>
  );
}

export function ReviewQueue({ assignments, lessons, members }: { assignments: LearningAssignment[]; lessons: LearningLesson[]; members: LearningMembership[] }) {
  const pending = assignments.filter((a) => a.state === "SUBMITTED");
  const rest = assignments.filter((a) => a.state !== "SUBMITTED" && a.submissions.length > 0);
  const lk = (k: string) => lessons.find((l) => l.key === k);
  const mk = (id: string) => members.find((m) => m.id === id);
  if (assignments.length === 0) return <p className="text-xs text-muted-foreground border border-dashed rounded p-4" data-testid="text-review-empty">No submissions in this cohort yet.</p>;
  return (
    <div className="space-y-3" data-testid="list-review">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Awaiting review ({pending.length})</div>
      {pending.map((a) => <ReviewItem key={a.id} a={a} lesson={lk(a.lessonKey)} member={mk(a.membershipId)} />)}
      {rest.length > 0 && <details><summary className="text-xs cursor-pointer text-muted-foreground">Reviewed / in progress ({rest.length})</summary><div className="space-y-3 mt-2">{rest.map((a) => <ReviewItem key={a.id} a={a} lesson={lk(a.lessonKey)} member={mk(a.membershipId)} />)}</div></details>}
    </div>
  );
}
