import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useManageCohortResource, type CohortResource, type ConvenerDashboard, type LearningLesson } from "@workspace/api-client-react";
import { Archive, BookOpen, Download, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiErr, invalidateLearning } from "@/components/learning/learning-model";
import { ResourceReader, downloadResource } from "./ResourceReader";
import { fmtWhen, lab } from "./convener-model";

const schema = z.object({
  sourceId: z.string().min(1, "Choose a source"),
  notes: z.string().max(2000),
  lessonKey: z.string(),
  authorized: z.boolean().refine((v) => v, "Confirm you are authorised to share this"),
});
type Values = z.infer<typeof schema>;
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function LibraryPanel({ cohortId, dash, lessons, readOnly }: { cohortId: string; dash: ConvenerDashboard; lessons: LearningLesson[]; readOnly?: boolean }) {
  const qc = useQueryClient();
  const manage = useManageCohortResource();
  const [reading, setReading] = useState<CohortResource | null>(null);
  const [archiving, setArchiving] = useState<CohortResource | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { sourceId: "", notes: "", lessonKey: "", authorized: false } });
  const lessonTitle = new Map(lessons.map((l) => [l.key, l.title]));
  const live = dash.resources.filter((r) => r.state !== "ARCHIVED");
  const archived = dash.resources.filter((r) => r.state === "ARCHIVED");
  const list = showArchived ? archived : live;

  const share = (v: Values) => {
    setErr(null);
    manage.mutate({ id: cohortId, data: { action: "SHARE", sourceId: v.sourceId, notes: v.notes, lessonKey: v.lessonKey || null } }, {
      onSuccess: () => form.reset({ sourceId: "", notes: "", lessonKey: "", authorized: false }),
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };
  const archive = (r: CohortResource) => {
    setErr(null);
    manage.mutate({ id: cohortId, data: { action: "ARCHIVE", id: r.id } }, {
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { setArchiving(null); void invalidateLearning(qc); },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="panel-library">
      <section className="space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`${lab} flex-1`}>{live.length} shared · {archived.length} archived</div>
          <Button size="sm" variant="ghost" onClick={() => setShowArchived((s) => !s)} data-testid="button-toggle-archived">{showArchived ? "Show shared" : "Show archived"}</Button>
        </div>
        {list.length === 0 ? (
          <div className="border border-dashed rounded-md p-8 text-center" data-testid="state-no-resources">
            <Library className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="font-display text-xl mt-2">{showArchived ? "Nothing archived." : "The shelf is empty."}</p>
            <p className="text-xs text-muted-foreground mt-1">Share a curated source or one of your own active exemplars. Trainees get a frozen snapshot, not a live link.</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="list-resources">
            {list.map((r) => (
              <li key={r.id} className="border rounded-md bg-card p-3 flex flex-col gap-2" data-testid={`card-resource-${r.id}`}>
                <div className="flex items-start gap-2"><span className="font-medium text-sm flex-1">{r.title}</span><span className="font-mono text-[10px] px-1.5 py-0.5 border rounded">{r.kind}</span></div>
                <div className="font-mono text-[10px] text-muted-foreground">{r.lessonKey ? `${lessonTitle.get(r.lessonKey) ?? r.lessonKey} · ` : ""}shared {fmtWhen(r.createdAt)}</div>
                {r.notes && <p className="text-xs text-muted-foreground line-clamp-2">{r.notes}</p>}
                <div className="flex flex-wrap gap-1 mt-auto">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setReading(r)} data-testid={`button-read-resource-${r.id}`}><BookOpen className="h-3 w-3 mr-1" /> Read</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadResource(r)} data-testid={`button-download-resource-${r.id}`}><Download className="h-3 w-3 mr-1" /> Download</Button>
                  {r.state !== "ARCHIVED" && !readOnly && <Button size="sm" variant="ghost" className="h-7 text-destructive ml-auto" onClick={() => setArchiving(r)} data-testid={`button-archive-resource-${r.id}`}><Archive className="h-3 w-3 mr-1" /> Archive</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {err && <p role="alert" className="text-xs text-destructive" data-testid="text-library-error">{err}</p>}
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(share)} className="border rounded-md p-4 bg-card space-y-3 self-start" aria-busy={manage.isPending} data-testid="form-share-resource">
          <h3 className="font-display text-xl">Share to cohort library</h3>
          {readOnly ? <p className="text-xs text-muted-foreground">This cohort is closed. The library is read-only.</p> : dash.exemplarOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="state-no-exemplar-options">No shareable sources. Only curated sources and your own active exemplars appear here.</p>
          ) : <>
            <FormField control={form.control} name="sourceId" render={({ field }) => (
              <FormItem><FormLabel className={lab}>Source</FormLabel><FormControl>
                <select {...field} className={sel} data-testid="select-resource-source">
                  <option value="">Choose…</option>
                  {dash.exemplarOptions.map((o) => <option key={o.id} value={o.id}>{o.title} · {o.kind}</option>)}
                </select></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="lessonKey" render={({ field }) => (
              <FormItem><FormLabel className={lab}>Lesson (optional)</FormLabel><FormControl>
                <select {...field} className={sel} data-testid="select-resource-lesson">
                  <option value="">Whole cohort</option>
                  {lessons.map((l) => <option key={l.key} value={l.key}>{l.title}</option>)}
                </select></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel className={lab}>Notes for trainees</FormLabel><FormControl><Textarea {...field} rows={3} maxLength={2000} data-testid="input-resource-notes" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="authorized" render={({ field }) => (
              <FormItem>
                <label className="flex items-start gap-2 text-xs">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} data-testid="checkbox-resource-authorized" /></FormControl>
                  <span>I am authorised to share this material with this cohort. A snapshot is copied now; later edits to the source are not reflected.</span>
                </label><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={manage.isPending} data-testid="button-share-resource">{manage.isPending ? "Sharing…" : "Share snapshot"}</Button>
          </>}
          <p className="text-[11px] text-muted-foreground">Cohort-only. Does not publish to the Exemplar Library or any marketplace.</p>
        </form>
      </Form>

      <ResourceReader resource={reading} onClose={() => setReading(null)} />
      <AlertDialog open={!!archiving} onOpenChange={(o) => !o && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive “{archiving?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Trainees will no longer see this snapshot in their library. Copies they already downloaded are unaffected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction disabled={manage.isPending} onClick={(e) => { e.preventDefault(); if (archiving) archive(archiving); }} data-testid="button-confirm-archive">Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
