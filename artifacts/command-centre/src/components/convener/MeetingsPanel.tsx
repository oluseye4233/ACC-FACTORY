import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveCohortMeeting, type CohortMeeting, type ConvenerDashboard } from "@workspace/api-client-react";
import { CalendarDays, CalendarPlus, ExternalLink, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiErr, invalidateLearning } from "@/components/learning/learning-model";
import { AudiencePicker } from "./AudiencePicker";
import { audienceLabel, downloadIcs, fmtWhen, isHttpsUrl, isoToLocal, lab, localToIso } from "./convener-model";

const schema = z.object({
  title: z.string().trim().min(3, "3+ characters").max(160),
  agenda: z.string().max(4000),
  startsAt: z.string().min(1, "Required").refine((v) => !!localToIso(v), "Invalid date").refine((v) => { const s = localToIso(v); return !s || new Date(s).getTime() > Date.now(); }, "Must start in the future"),
  endsAt: z.string().min(1, "Required").refine((v) => !!localToIso(v), "Invalid date"),
  meetingUrl: z.string().trim().refine((v) => v === "" || isHttpsUrl(v), "Must be an https:// link"),
  membershipIds: z.array(z.string()),
}).refine((v) => { const s = localToIso(v.startsAt), e = localToIso(v.endsAt); return !s || !e || new Date(e) > new Date(s); }, { path: ["endsAt"], message: "Must end after it starts" });
type Values = z.infer<typeof schema>;

function MeetingForm({ cohortId, dash, meeting, onDone, cohortEndsAt }: { cohortId: string; dash: ConvenerDashboard; meeting: CohortMeeting | null; onDone: () => void; cohortEndsAt?: string }) {
  const qc = useQueryClient();
  const save = useSaveCohortMeeting();
  const [err, setErr] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: meeting?.title ?? "", agenda: meeting?.agenda ?? "", startsAt: isoToLocal(meeting?.startsAt), endsAt: isoToLocal(meeting?.endsAt), meetingUrl: meeting?.meetingUrl ?? "", membershipIds: meeting?.membershipIds ?? [] },
  });
  const submit = (v: Values) => {
    setErr(null);
    if (cohortEndsAt && new Date(localToIso(v.endsAt)!) > new Date(cohortEndsAt)) { form.setError("endsAt", { message: `Must end before the cohort closes (${fmtWhen(cohortEndsAt)})` }); return; }
    save.mutate({ id: cohortId, data: { ...(meeting ? { id: meeting.id } : {}), title: v.title.trim(), agenda: v.agenda, startsAt: localToIso(v.startsAt)!, endsAt: localToIso(v.endsAt)!, meetingUrl: v.meetingUrl.trim() || null, membershipIds: v.membershipIds, state: "SCHEDULED" } }, {
      onSuccess: () => onDone(),
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="border border-primary/40 rounded-md p-4 bg-card space-y-3" aria-busy={save.isPending} data-testid="form-meeting">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl flex-1">{meeting ? "Edit meeting" : "Schedule meeting"}</h3>
          <Button type="button" size="icon" variant="ghost" onClick={onDone} aria-label="Close" data-testid="button-close-meeting"><X className="h-4 w-4" /></Button>
        </div>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel className={lab}>Title</FormLabel><FormControl><Input {...field} maxLength={160} data-testid="input-meeting-title" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField control={form.control} name="startsAt" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Starts (your local time)</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="input-meeting-start" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="endsAt" render={({ field }) => (
            <FormItem><FormLabel className={lab}>Ends</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="input-meeting-end" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="meetingUrl" render={({ field }) => (
          <FormItem><FormLabel className={lab}>Video link (optional, https)</FormLabel><FormControl><Input {...field} placeholder="https://" data-testid="input-meeting-url" /></FormControl>
            <p className="text-[11px] text-muted-foreground">Paste a link you created in Zoom, Teams or Meet. Nothing is provisioned automatically.</p><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="agenda" render={({ field }) => (
          <FormItem><FormLabel className={lab}>Agenda</FormLabel><FormControl><Textarea {...field} rows={4} maxLength={4000} data-testid="input-meeting-agenda" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="membershipIds" render={({ field }) => (
          <FormItem><AudiencePicker learners={dash.learners} value={field.value} onChange={field.onChange} testId="picker-meeting" /><FormMessage /></FormItem>
        )} />
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-muted-foreground flex-1">Saving shows the meeting on invitees' training pages. It does not email anyone; use the Email tab for that.</p>
          <Button type="submit" disabled={save.isPending} data-testid="button-save-meeting">{save.isPending ? "Saving…" : "Save meeting"}</Button>
        </div>
        {err && <p role="alert" className="text-xs text-destructive" data-testid="text-meeting-error">{err}</p>}
      </form>
    </Form>
  );
}

export function MeetingsPanel({ cohortId, cohortTitle, dash, readOnly, cohortEndsAt }: { cohortId: string; cohortTitle?: string; dash: ConvenerDashboard; readOnly?: boolean; cohortEndsAt?: string }) {
  const qc = useQueryClient();
  const cancel = useSaveCohortMeeting();
  const [editing, setEditing] = useState<{ m: CohortMeeting | null; k: number } | null>(null);
  const [confirm, setConfirm] = useState<CohortMeeting | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const names = new Map(dash.learners.map((l) => [l.membershipId, l.name]));
  const now = Date.now();
  const sorted = [...dash.meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = sorted.filter((m) => new Date(m.endsAt).getTime() >= now && m.state !== "CANCELLED");
  const other = sorted.filter((m) => !upcoming.includes(m)).reverse();

  const doCancel = (m: CohortMeeting) => {
    setErr(null);
    cancel.mutate({ id: cohortId, data: { id: m.id, title: m.title, agenda: m.agenda, startsAt: m.startsAt, endsAt: m.endsAt, meetingUrl: m.meetingUrl ?? null, membershipIds: m.membershipIds, state: "CANCELLED" } }, {
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { setConfirm(null); void invalidateLearning(qc); },
    });
  };

  const Row = ({ m }: { m: CohortMeeting }) => {
    const d = new Date(m.startsAt);
    const cancelled = m.state === "CANCELLED";
    return (
      <li className={`border rounded-md bg-card p-3 grid grid-cols-[56px_1fr] gap-3 ${cancelled ? "opacity-60" : ""}`} data-testid={`card-meeting-${m.id}`}>
        <div className="text-center border rounded bg-primary/5 py-1.5">
          <div className="font-mono text-[10px] uppercase text-primary">{d.toLocaleDateString(undefined, { month: "short" })}</div>
          <div className="font-display text-2xl leading-none">{d.getDate()}</div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className={`font-medium text-sm flex-1 ${cancelled ? "line-through" : ""}`}>{m.title}</span>
            {cancelled && <span className="font-mono text-[10px] text-destructive">CANCELLED</span>}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{fmtWhen(m.startsAt)} – {new Date(m.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })} · {audienceLabel(m.membershipIds, names)}</div>
          {m.agenda && <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">{m.agenda}</p>}
          <div className="flex flex-wrap gap-1.5">
            {m.meetingUrl && !cancelled && <Button asChild size="sm" variant="ghost" className="h-7"><a href={m.meetingUrl} target="_blank" rel="noreferrer noopener" data-testid={`link-meeting-${m.id}`}><ExternalLink className="h-3 w-3 mr-1" /> Join link</a></Button>}
            <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadIcs(m, cohortTitle)} data-testid={`button-ics-${m.id}`}><CalendarPlus className="h-3 w-3 mr-1" /> .ics</Button>
            {!cancelled && !readOnly && <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing({ m, k: Date.now() })} data-testid={`button-edit-meeting-${m.id}`}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>}
            {!cancelled && !readOnly && <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => setConfirm(m)} data-testid={`button-cancel-meeting-${m.id}`}>Cancel meeting</Button>}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4" data-testid="panel-meetings">
      <div className="flex items-center gap-2">
        <div className={`${lab} flex-1`}>{upcoming.length} upcoming</div>
        <Button size="sm" disabled={readOnly} onClick={() => setEditing({ m: null, k: Date.now() })} data-testid="button-new-meeting"><Plus className="h-3.5 w-3.5 mr-1" /> Schedule</Button>
      </div>
      {editing && !readOnly && <MeetingForm key={editing.k} cohortId={cohortId} dash={dash} meeting={editing.m} cohortEndsAt={cohortEndsAt} onDone={() => setEditing(null)} />}
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {sorted.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center" data-testid="state-no-meetings">
          <CalendarDays className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="font-display text-xl mt-2">No meetings scheduled.</p>
          <p className="text-xs text-muted-foreground mt-1">Office hours, gate reviews, kickoff. Trainees download them to their own calendar.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2"><div className={lab}>Upcoming</div>
            {upcoming.length ? <ul className="space-y-2">{upcoming.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="text-xs text-muted-foreground border border-dashed rounded p-3">Nothing upcoming.</p>}
          </section>
          <section className="space-y-2"><div className={lab}>Past and cancelled</div>
            {other.length ? <ul className="space-y-2">{other.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="text-xs text-muted-foreground border border-dashed rounded p-3">None.</p>}
          </section>
        </div>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel “{confirm?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>It stays on trainees' pages marked cancelled. No email is sent automatically; trainees who added it to a calendar can re-download the .ics to update it.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-keep-meeting">Keep</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isPending} onClick={(e) => { e.preventDefault(); if (confirm) doCancel(confirm); }} data-testid="button-confirm-cancel-meeting">Cancel meeting</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
