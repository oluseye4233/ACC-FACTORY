import { useState, type JSX } from "react";
import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import {
  useGetMyAscension,
  useGetMyJst,
  useSubmitMyJst,
  useClaimReaderCode,
  type AscensionRung,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Lock, Sparkles, Target } from "lucide-react";

const BAND_BLURB: Record<string, string> = {
  SEEKER: "You're naming the gap. The protocol begins here.",
  BUILDER: "Skills are compounding. Keep shipping atoms.",
  OPERATOR: "You run the floor. Certification is within reach.",
  ASCENDANT: "Talent, skill and demand are aligned. Lead the hive.",
};

function jstComposite(jobs: number, skills: number, talent: number): number {
  return Math.round(((jobs + skills + talent - 3) / 27) * 100 * 100) / 100;
}

function bandForComposite(c: number): string {
  if (c < 40) return "SEEKER";
  if (c < 60) return "BUILDER";
  if (c < 80) return "OPERATOR";
  return "ASCENDANT";
}

export default function Ascension() {
  const { data: journey, isLoading, refetch } = useGetMyAscension();
  const { data: jst, refetch: refetchJst } = useGetMyJst();
  const submitJst = useSubmitMyJst();
  const claimCode = useClaimReaderCode();
  const { toast } = useToast();

  const [jobs, setJobs] = useState(5);
  const [skills, setSkills] = useState(5);
  const [talent, setTalent] = useState(5);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");

  const previewComposite = jstComposite(jobs, skills, talent);
  const previewBand = bandForComposite(previewComposite);

  const handleSubmitJst = (): void => {
    submitJst.mutate(
      { data: { jobsScore: jobs, skillsScore: skills, talentScore: talent, notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "JST recorded", description: `Your number: ${previewComposite} (${previewBand}).` });
          setNotes("");
          void refetchJst();
          void refetch();
        },
        onError: (e) => toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" }),
      },
    );
  };

  const handleClaim = (): void => {
    if (!code.trim()) return;
    claimCode.mutate(
      { data: { code: code.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Reader unlocked", description: "You're on the Atomic Prompt track." });
          setCode("");
          void refetch();
        },
        onError: (e) =>
          toast({
            title: "Code not recognised",
            description: (e as Error).message ?? "Check the code in your book.",
            variant: "destructive",
          }),
      },
    );
  };

  const onTrack = journey?.track === "atomic_prompt_v1";
  const latest = jst?.latest ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 mb-3 rounded bg-primary/15 text-primary font-mono text-[10px] tracking-widest border border-primary/30">
            <BookOpen className="h-3 w-3" /> THE ATOMIC PROMPT · ONBOARDING SPINE
          </div>
          <h1 className="font-display text-4xl tracking-wider mb-2">THE ASCENSION PROTOCOL</h1>
          <p className="text-muted-foreground font-serif text-sm max-w-2xl">
            A guided climb from your raw number to a certified, shipped system — each rung anchored to a
            chapter of <em>The Atomic Prompt</em> and proven by real work in the HARNESS, never self-reported.
          </p>
        </div>

        {/* Progress banner */}
        {isLoading ? (
          <Skeleton className="h-24 w-full mb-8" />
        ) : journey ? (
          <Card className="mb-8 border-l-4 border-l-primary/60">
            <CardContent className="py-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">ASCENT PROGRESS</div>
                  <div className="font-display text-2xl tracking-wider">
                    {journey.completedCount}
                    <span className="text-muted-foreground text-base"> / {journey.totalCount} rungs</span>
                  </div>
                </div>
                {journey.band && (
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest">CURRENT BAND</div>
                    <div className="font-display text-xl tracking-wider text-primary">{journey.band}</div>
                  </div>
                )}
              </div>
              <Progress
                className="mt-4 h-2"
                value={(journey.completedCount / journey.totalCount) * 100}
              />
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* JST self-assessment */}
          <Card id="jst" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="font-display tracking-wider text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> KNOW YOUR NUMBER (JST)
              </CardTitle>
              <CardDescription className="font-serif">
                Rate yourself honestly on the three axes. Your composite is computed from these — that's your number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { label: "JOBS — market demand for what you do", val: jobs, set: setJobs },
                { label: "SKILLS — learned, practised capability", val: skills, set: setSkills },
                { label: "TALENT — innate edge / natural advantage", val: talent, set: setTalent },
              ].map((ax) => (
                <div key={ax.label}>
                  <div className="flex justify-between text-[11px] font-mono mb-1.5">
                    <span className="text-muted-foreground">{ax.label}</span>
                    <span className="text-foreground font-bold">{ax.val}/10</span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[ax.val]}
                    onValueChange={(v) => ax.set(v[0] ?? 1)}
                    data-testid={`slider-${ax.label.split(" ")[0]!.toLowerCase()}`}
                  />
                </div>
              ))}
              <div>
                <Label className="text-[11px] font-mono text-muted-foreground">NOTES (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What's driving these scores right now?"
                  className="mt-1.5 h-16 text-sm"
                  maxLength={2000}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">YOUR NUMBER</div>
                  <div className="font-display text-3xl tracking-wider">{previewComposite}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg tracking-wider text-primary">{previewBand}</div>
                  <div className="text-[10px] font-serif text-muted-foreground max-w-[12rem]">
                    {BAND_BLURB[previewBand]}
                  </div>
                </div>
              </div>
              <Button
                className="w-full font-mono"
                onClick={handleSubmitJst}
                disabled={submitJst.isPending}
                data-testid="button-submit-jst"
              >
                {latest ? "RE-TAKE & RECORD" : "RECORD MY NUMBER"}
              </Button>
              {latest && (
                <p className="text-[11px] font-mono text-muted-foreground text-center">
                  Last recorded: {latest.composite} ({latest.band}) ·{" "}
                  {new Date(latest.createdAt).toLocaleDateString()} · {jst?.count ?? 0} total
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reader access */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display tracking-wider text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> READER ACCESS
              </CardTitle>
              <CardDescription className="font-serif">
                Reading <em>The Atomic Prompt</em>? Enter the code from your copy to join the dedicated reader track.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {onTrack ? (
                <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                  <div className="flex items-center gap-2 font-display tracking-wider text-primary">
                    <CheckCircle2 className="h-5 w-5" /> ATOMIC PROMPT TRACK ACTIVE
                  </div>
                  <p className="text-xs font-serif text-muted-foreground mt-2">
                    You're following the book's onboarding spine. Each rung below maps to a chapter — work them in order
                    for the smoothest ascent.
                  </p>
                  {journey?.readerCode && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-2">CODE: {journey.readerCode}</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-[11px] font-mono text-muted-foreground">READER CODE</Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. ATOMICPROMPT"
                      className="mt-1.5 font-mono"
                      data-testid="input-reader-code"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full font-mono"
                    onClick={handleClaim}
                    disabled={claimCode.isPending || !code.trim()}
                    data-testid="button-claim-code"
                  >
                    UNLOCK READER TRACK
                  </Button>
                  <p className="text-[11px] font-serif text-muted-foreground">
                    No code yet? The protocol still works for everyone — the ladder below tracks your real progress
                    regardless of track.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* The ladder */}
        <h2 className="font-display text-2xl tracking-wider mb-4">
          THE {journey?.totalCount ?? 13} RUNGS
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-border/60 pl-6 ml-2">
            {(journey?.rungs ?? []).map((rung) => (
              <RungRow key={rung.key} rung={rung} />
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}

function RungRow({ rung }: { rung: AscensionRung }): JSX.Element {
  const pct = Math.min(100, (rung.progress / rung.target) * 100);
  return (
    <li className="relative" data-testid={`rung-${rung.key}`}>
      <span
        className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full border-2 ${
          rung.complete
            ? "border-primary bg-primary text-primary-foreground"
            : rung.current
            ? "border-primary bg-background text-primary animate-pulse"
            : "border-muted-foreground/40 bg-background text-muted-foreground"
        }`}
      >
        {rung.complete ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : rung.current ? (
          <Circle className="h-3 w-3 fill-current" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
      </span>
      <Card
        className={`${
          rung.current ? "ring-2 ring-primary/50 shadow-md shadow-primary/10" : ""
        } ${rung.complete ? "bg-primary/5" : ""}`}
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-muted-foreground">RUNG {rung.index + 1}</span>
                <span className="font-display text-lg tracking-wider">{rung.title}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {rung.role}
                </span>
              </div>
              <div className="text-[11px] font-mono text-primary/80 mt-0.5">{rung.engine}</div>
              <p className="text-xs font-serif text-muted-foreground mt-1.5 max-w-2xl">{rung.blurb}</p>
              <div className="text-[10px] font-mono text-muted-foreground mt-1.5 flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {rung.chapter}
              </div>
            </div>
            <div className="text-right shrink-0">
              {rung.complete ? (
                <span className="font-mono text-[10px] text-primary font-bold">COMPLETE</span>
              ) : (
                <Button asChild size="sm" variant={rung.current ? "default" : "outline"} className="font-mono text-xs gap-1">
                  <Link href={rung.actionHref}>
                    {rung.actionLabel} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              )}
              {rung.target > 1 && (
                <div className="mt-2 w-28">
                  <div className="flex justify-between text-[9px] font-mono mb-0.5">
                    <span className="text-muted-foreground">PROGRESS</span>
                    <span>{rung.progress}/{rung.target}</span>
                  </div>
                  <div className="h-1 bg-muted rounded">
                    <div
                      className={`h-full rounded ${rung.complete ? "bg-primary" : "bg-secondary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
