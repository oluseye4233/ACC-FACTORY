import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSendCohortMessage, type CohortMessage, type ConvenerDashboard } from "@workspace/api-client-react";
import { AlertTriangle, FilePlus2, RotateCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiErr, invalidateLearning } from "@/components/learning/learning-model";
import { AudiencePicker } from "./AudiencePicker";
import { DELIVERY_COPY, audienceLabel, fmtWhen, lab, newRequestId, tallyDeliveries, type DeliveryState } from "./convener-model";

const schema = z.object({
  subject: z.string().trim().min(3, "3+ characters").max(160),
  body: z.string().trim().min(3, "3+ characters").max(10000),
  membershipIds: z.array(z.string()),
  meetingId: z.string(),
});
type Values = z.infer<typeof schema>;
const EMPTY: Values = { subject: "", body: "", membershipIds: [], meetingId: "" };

function DeliveryPill({ state }: { state: string }) {
  const c = DELIVERY_COPY[state as DeliveryState] ?? DELIVERY_COPY.PENDING;
  return <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${c.cls}`}>{c.label}</span>;
}

function Tally({ m }: { m: CohortMessage }) {
  const t = tallyDeliveries(m.deliveries);
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(t) as DeliveryState[]).filter((k) => t[k] > 0).map((k) => <span key={k} className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${DELIVERY_COPY[k].cls}`}>{t[k]} {DELIVERY_COPY[k].label.toLowerCase()}</span>)}
      {m.deliveries.length === 0 && <span className="font-mono text-[10px] text-muted-foreground">no recipients</span>}
    </div>
  );
}

export function EmailPanel({ cohortId, dash, readOnly }: { cohortId: string; dash: ConvenerDashboard; readOnly?: boolean }) {
  const qc = useQueryClient();
  const send = useSendCohortMessage();
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [locked, setLocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<CohortMessage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const names = new Map(dash.learners.map((l) => [l.membershipId, l.name]));
  const activeCount = dash.learners.filter((l) => l.state === "ACTIVE").length;
  const upcoming = dash.meetings.filter((m) => m.state !== "CANCELLED" && new Date(m.endsAt).getTime() >= Date.now());
  const disabled = !dash.emailConfigured || !!readOnly;

  const doSend = () => {
    const v = form.getValues();
    setErr(null); setLocked(true);
    send.mutate({ id: cohortId, data: { requestId, subject: v.subject.trim(), body: v.body.trim(), membershipIds: v.membershipIds, ...(v.meetingId ? { meetingId: v.meetingId } : {}) } }, {
      onSuccess: (m) => setResult(m),
      onError: (e) => {
        const status = (e as { status?: number })?.status;
        setErr(status === 503 ? "Email service is not configured. Nothing was sent." : apiErr(e).message);
        // Server rejected the request outright (validation / auth / not configured): nothing was sent, safe to edit.
        if (status && status >= 400 && status < 500 && status !== 409 && status !== 408 && status !== 429) setLocked(false);
        if (status === 503) setLocked(false);
      },
      onSettled: () => { setConfirming(false); void invalidateLearning(qc); },
    });
  };

  const newDraft = () => { form.reset(EMPTY); setRequestId(newRequestId()); setResult(null); setErr(null); setLocked(false); };
  const v = form.watch();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="panel-email">
      <div className="space-y-3">
        {!dash.emailConfigured && (
          <div className="border border-secondary rounded-md p-3 bg-secondary/15 flex gap-2 text-xs" role="status" data-testid="state-email-unconfigured">
            <AlertTriangle className="h-4 w-4 shrink-0 text-secondary-foreground" />
            <p><b>Email is not set up.</b> Sending needs the platform's existing email service configured by an administrator. You can still schedule meetings and write follow-ups; trainees see them on their training page.</p>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(() => setConfirming(true))} className="border rounded-md p-4 bg-card space-y-3" aria-busy={send.isPending} data-testid="form-email">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl flex-1">Compose</h3>
              <span className="font-mono text-[10px] text-muted-foreground" title="Idempotency key; retries reuse it so nobody is emailed twice">req {requestId.slice(0, 8)}</span>
            </div>
            <fieldset disabled={locked || disabled} className="space-y-3">
              <FormField control={form.control} name="membershipIds" render={({ field }) => (
                <FormItem><AudiencePicker learners={dash.learners} value={field.value} onChange={field.onChange} disabled={locked || disabled} testId="picker-email" /><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem><FormLabel className={lab}>Subject</FormLabel><FormControl><Input {...field} maxLength={160} data-testid="input-email-subject" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem><FormLabel className={lab}>Message</FormLabel><FormControl><Textarea {...field} rows={8} maxLength={10000} data-testid="input-email-body" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="meetingId" render={({ field }) => (
                <FormItem><FormLabel className={lab}>Attach meeting details (optional)</FormLabel><FormControl>
                  <select {...field} className="h-9 w-full rounded-md border bg-background px-2 text-sm" data-testid="select-email-meeting">
                    <option value="">None</option>
                    {upcoming.map((m) => <option key={m.id} value={m.id}>{m.title} · {fmtWhen(m.startsAt)}</option>)}
                  </select></FormControl>
                  <p className="text-[11px] text-muted-foreground">The server inserts the saved time, link and agenda, so the email always matches the meeting record.</p><FormMessage /></FormItem>
              )} />
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              {result ? (
                <Button type="button" variant="outline" onClick={newDraft} data-testid="button-new-draft"><FilePlus2 className="h-3.5 w-3.5 mr-1" /> New draft</Button>
              ) : locked && err ? (
                <Button type="button" onClick={() => setConfirming(true)} disabled={send.isPending || disabled} data-testid="button-retry-send"><RotateCw className="h-3.5 w-3.5 mr-1" /> Retry same send</Button>
              ) : (
                <Button type="submit" disabled={disabled || send.isPending || activeCount === 0} data-testid="button-send-email"><Send className="h-3.5 w-3.5 mr-1" /> {send.isPending ? "Sending…" : "Review and send"}</Button>
              )}
              <span className="text-[11px] text-muted-foreground">“Sending” means the outcome is uncertain and will not be retried automatically. “Accepted” means the provider took it, not that it reached an inbox.</span>
            </div>
            {send.isPending && <p className="text-xs" role="status" data-testid="status-sending">Sending to provider. Do not close this tab; if it fails, retry reuses the same request so nobody gets a duplicate.</p>}
            {err && <p role="alert" className="text-xs text-destructive" data-testid="text-email-error">{err}{locked ? " The outcome is unknown; retry is safe and will not double-send." : ""}</p>}
            {result && (
              <div className="border border-primary/40 rounded p-3 bg-primary/5 space-y-2" data-testid="panel-send-result">
                <div className={lab}>Result</div><Tally m={result} />
                <ul className="text-xs divide-y">{result.deliveries.map((d) => <li key={d.membershipId} className="flex items-center gap-2 py-1"><span className="flex-1 truncate">{names.get(d.membershipId) ?? d.membershipId.slice(0, 8)}</span>{d.error && <span className="text-destructive truncate max-w-[50%]">{d.error}</span>}<DeliveryPill state={d.state} /></li>)}</ul>
              </div>
            )}
          </form>
        </Form>
      </div>

      <section className="space-y-2 min-w-0" data-testid="list-messages">
        <div className={lab}>Sent history ({dash.messages.length})</div>
        {dash.messages.length === 0 ? (
          <p className="text-xs text-muted-foreground border border-dashed rounded p-6 text-center" data-testid="state-no-messages">No emails sent from this cohort yet.</p>
        ) : (
          <ul className="border rounded-md divide-y bg-card">
            {[...dash.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((m) => (
              <li key={m.id} className="p-3 space-y-1.5" data-testid={`row-message-${m.id}`}>
                <button type="button" className="w-full text-left" onClick={() => setOpenMsg(openMsg === m.id ? null : m.id)} aria-expanded={openMsg === m.id} data-testid={`button-toggle-message-${m.id}`}>
                  <div className="flex items-start gap-2"><span className="text-sm font-medium flex-1">{m.subject}</span><span className="font-mono text-[10px] text-muted-foreground">{fmtWhen(m.createdAt)}</span></div>
                </button>
                <Tally m={m} />
                {openMsg === m.id && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground border-l-2 pl-2">{m.body}</p>
                    <ul className="text-xs divide-y border rounded">{m.deliveries.map((d) => <li key={d.membershipId} className="flex items-center gap-2 px-2 py-1"><span className="flex-1 truncate">{names.get(d.membershipId) ?? "Former trainee"}</span>{d.error && <span className="text-destructive truncate max-w-[45%]" title={d.error}>{d.error}</span>}<DeliveryPill state={d.state} /></li>)}</ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={confirming} onOpenChange={(o) => !send.isPending && setConfirming(o)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Send this email?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p><b>To:</b> {audienceLabel(v.membershipIds, names)}{v.membershipIds.length === 0 ? ` (${activeCount})` : ""}</p>
                <p><b>Subject:</b> {v.subject}</p>
                {v.meetingId && <p><b>Includes meeting:</b> {dash.meetings.find((m) => m.id === v.meetingId)?.title}</p>}
                <p className="text-xs text-muted-foreground pt-1">This cannot be unsent. Addresses are resolved by the server and never shown here.</p>
              </div>
            </AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={send.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={send.isPending} onClick={(e) => { e.preventDefault(); doSend(); }} data-testid="button-confirm-send">{send.isPending ? "Sending…" : "Send now"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
