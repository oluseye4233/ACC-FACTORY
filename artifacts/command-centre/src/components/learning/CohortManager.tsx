import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useManageLearningCohort, type LearningCohortDetail, type ManageLearningCohortBody } from "@workspace/api-client-react";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErr, fmtDate, invalidateLearning, inviteLink, requiredDone } from "./learning-model";

const lab = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";
const STATE_ACTIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "COMPLETED"],
  SUSPENDED: ["ACTIVE", "COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function CohortManager({ cohortId, d }: { cohortId: string; d: LearningCohortDetail }) {
  const qc = useQueryClient();
  const manage = useManageLearningCohort();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cohort = d.cohorts.find((c) => c.id === cohortId) ?? d.cohorts[0];

  const act = (data: ManageLearningCohortBody, onOk?: (r: LearningCohortDetail) => void) => {
    setErr(null);
    manage.mutate({ id: cohortId, data }, {
      onSuccess: (r) => onOk?.(r),
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    setLink(null); setCopied(false);
    act({ action: "INVITE", email: email.trim(), role }, (r) => {
      if (r.issuedInviteToken) setLink(inviteLink(r.issuedInviteToken));
      setEmail("");
    });
  };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const owner = d.isOwner;

  return (
    <div className="space-y-6">
      {owner && cohort && (
        <section className="space-y-2" data-testid="panel-state">
          <div className={lab}>Cohort state</div>
          <div className="flex flex-wrap gap-2">
            {(STATE_ACTIONS[cohort.state] ?? []).map((s) => (
              <Button key={s} size="sm" variant={s === "ACTIVE" ? "default" : "outline"} disabled={manage.isPending} onClick={() => act({ action: "STATE", state: s })} data-testid={`button-state-${s}`}>
                {s === "ACTIVE" ? (cohort.state === "DRAFT" ? "Activate" : "Reactivate") : s === "SUSPENDED" ? "Suspend" : s === "COMPLETED" ? "Complete cohort" : "Archive"}
              </Button>
            ))}
            {(STATE_ACTIONS[cohort.state] ?? []).length === 0 && <span className="text-xs text-muted-foreground">No further transitions.</span>}
          </div>
        </section>
      )}

      {owner && (
        <section className="space-y-2" data-testid="panel-invite">
          <div className={lab}>Named invitation</div>
          <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.org" data-testid="input-invite-email" />
            <select value={role} onChange={(e) => setRole(e.target.value as "STUDENT" | "INSTRUCTOR")} className="h-9 rounded-md border bg-background px-2 text-sm" data-testid="select-invite-role">
              <option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option>
            </select>
            <Button type="submit" disabled={!emailOk || manage.isPending} data-testid="button-invite"><Mail className="h-3.5 w-3.5 mr-1" /> Invite</Button>
          </form>
          {link && (
            <div className="border border-primary/50 rounded p-2.5 bg-primary/5 space-y-1.5" data-testid="panel-invite-link">
              <p className="text-xs">Single-use link. Shown once; it is not stored in this browser. Send it to the invitee now.</p>
              <div className="flex gap-2"><code className="text-[10px] break-all flex-1 font-mono" data-testid="text-invite-link">{link}</code>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }} data-testid="button-copy-invite"><Copy className="h-3 w-3 mr-1" />{copied ? "Copied" : "Copy"}</Button>
              </div>
            </div>
          )}
          {d.invitations.length > 0 && (
            <ul className="divide-y border rounded text-xs" data-testid="list-invitations">
              {d.invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5" data-testid={`row-invite-${i.id}`}>
                  <span className="flex-1 min-w-0 truncate">{i.email}</span>
                  <span className="font-mono text-[10px]">{i.role}</span><span className="font-mono text-[10px] text-muted-foreground">{i.state}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">exp {fmtDate(i.expiresAt)}</span>
                  {i.state === "ISSUED" && <Button size="sm" variant="ghost" className="h-6 text-destructive" disabled={manage.isPending} onClick={() => act({ action: "REVOKE_INVITE", subjectId: i.id })} data-testid={`button-revoke-invite-${i.id}`}>Revoke</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2" data-testid="panel-members">
        <div className={lab}>Members ({d.memberships.length})</div>
        {d.memberships.length === 0 ? <p className="text-xs text-muted-foreground border border-dashed rounded p-3">No members yet.</p> : (
          <ul className="divide-y border rounded">
            {d.memberships.map((m) => {
              const prog = requiredDone(d.lessons, d.assignments, m);
              return (
                <li key={m.id} className="p-2.5 text-xs space-y-1.5" data-testid={`row-member-${m.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{m.name}</b><span className="font-mono text-[10px]">{m.role}</span><span className="font-mono text-[10px] text-muted-foreground">{m.state}</span>
                    {m.role === "STUDENT" && <span className="font-mono text-[10px] text-muted-foreground">{prog.done}/{prog.total} required</span>}
                    {m.completedAt && <span className="font-mono text-[10px] text-primary">completed {fmtDate(m.completedAt)}</span>}
                  </div>
                  {owner && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.state === "ACTIVE" && <Button size="sm" variant="outline" className="h-6" disabled={manage.isPending} onClick={() => act({ action: "MEMBERSHIP", subjectId: m.id, state: "SUSPENDED" })} data-testid={`button-suspend-${m.id}`}>Suspend</Button>}
                      {m.state === "SUSPENDED" && <Button size="sm" variant="outline" className="h-6" disabled={manage.isPending} onClick={() => act({ action: "MEMBERSHIP", subjectId: m.id, state: "ACTIVE" })} data-testid={`button-reactivate-${m.id}`}>Reactivate</Button>}
                      {m.state !== "REVOKED" && m.state !== "COMPLETED" && <Button size="sm" variant="ghost" className="h-6 text-destructive" disabled={manage.isPending} onClick={() => act({ action: "MEMBERSHIP", subjectId: m.id, state: "REVOKED" })} data-testid={`button-revoke-member-${m.id}`}>Revoke</Button>}
                      {m.role === "STUDENT" && (
                        <select value={m.track} disabled={manage.isPending} onChange={(e) => act({ action: "MEMBERSHIP", subjectId: m.id, track: e.target.value as "BOTH" | "ARCHITECT" | "ENGINEER" })} className="h-6 rounded border bg-background px-1 text-[11px]" data-testid={`select-track-${m.id}`}>
                          <option value="BOTH">Both tracks</option><option value="ARCHITECT">Architect</option><option value="ENGINEER">Engineer</option>
                        </select>
                      )}
                      {m.role === "STUDENT" && m.state === "ACTIVE" && !m.completedAt && (
                      <Button size="sm" className="h-6" disabled={!prog.all || manage.isPending} title={prog.all ? "" : "All required lesson reviews must be complete"} onClick={() => act({ action: "COMPLETE", subjectId: m.id })} data-testid={`button-complete-member-${m.id}`}>Mark course complete</Button>
                      )}
                      {m.role === "STUDENT" && m.state === "COMPLETED" && !m.certification && (
                        <Button size="sm" className="h-6" disabled={manage.isPending}
                          onClick={() => act({ action: "CERTIFY", subjectId: m.id })}
                          data-testid={`button-certify-member-${m.id}`}>Issue FORGE certification</Button>
                      )}
                      {m.certification && <span className="text-xs text-primary" data-testid={`text-certified-member-${m.id}`}>FORGE certified · Lifetime Practitioner unlocked</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!owner && <p className="text-[11px] text-muted-foreground">Instructors review work. Membership, invitations and cohort state belong to the owner.</p>}
      </section>

      {err && <p role="alert" className="text-xs text-destructive" data-testid="text-manage-error">{err}</p>}

      {d.audit.length > 0 && (
        <section data-testid="panel-audit">
          <div className={lab}>Audit</div>
          <ol className="mt-1 divide-y font-mono text-[10px]">{d.audit.slice(0, 40).map((a) => <li key={a.id} className="py-1 flex gap-3"><b>{a.action}</b><span className="text-muted-foreground">{a.subjectId.slice(0, 8)}</span><span className="text-muted-foreground ml-auto">{fmtDate(a.createdAt)}</span></li>)}</ol>
        </section>
      )}
    </div>
  );
}
