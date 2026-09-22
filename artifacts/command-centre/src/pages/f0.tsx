import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetF0Dashboard,
  useCreateF0Engagement,
  useGetF0Engagement,
  useGenerateF0Discovery,
  useRecordF0Discovery,
  useGenerateF0Challenge,
  useCreateF0Retainer,
  useGetF0Retainer,
  useCreateF0RetainerTask,
  useUpdateF0RetainerTask,
  useGenerateF0Commentary,
  useGenerateF0Monitoring,
  useAcknowledgeF0MonitoringAlert,
  getGenerateF0ReportUrl,
  getGetF0DashboardQueryKey,
  getGetF0EngagementQueryKey,
  getGetF0RetainerQueryKey,
  type F0Engagement,
  type F0Report,
  type F0Retainer,
  type F0RetainerTask,
  type F0Commentary,
  type F0Monitoring,
  type F0MonitoringDashboard,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { streamSse, extractApiError } from "@/lib/sse";
import {
  Briefcase,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  Radar,
  ClipboardList,
  Plus,
  Clock,
  BellRing,
  Check,
  ArrowRight,
  Upload,
} from "lucide-react";

const F0_SERVICE_GROUPS: { group: string; services: { value: string; label: string }[] }[] = [
  {
    group: "Core Services",
    services: [
      { value: "PRODUCT_VIABILITY", label: "Product Viability" },
      { value: "MARKET_VIABILITY", label: "Market Viability" },
      { value: "CAPI_POSITIONING", label: "CAPI Positioning" },
      { value: "CUSTOMER_ACQUISITION", label: "Customer Acquisition" },
      { value: "GO_TO_MARKET", label: "Go-to-Market" },
      { value: "FINANCIAL_PROJECTIONS", label: "Financial Projections" },
      { value: "PRODUCT_SYNTHESIS_ADVISORY", label: "Product Synthesis Advisory" },
      { value: "OFFICER_ANALYSIS", label: "Officer Analysis" },
    ],
  },
  {
    group: "Boutique Add-ons",
    services: [
      { value: "COMPETITIVE_TEARDOWN", label: "Competitive Teardown" },
      { value: "PRICING_STRATEGY", label: "Pricing Strategy" },
      { value: "BRAND_NARRATIVE", label: "Brand Narrative" },
      { value: "INVESTOR_READINESS", label: "Investor Readiness" },
    ],
  },
  {
    group: "ULTRA SI · High-Level",
    services: [
      { value: "MATHMON_MAX", label: "MATHMON MAX ULTRA SI" },
      { value: "EVE_MAX", label: "EVE MAX ULTRA SI" },
    ],
  },
];

const F0_SERVICES = F0_SERVICE_GROUPS.flatMap((g) => g.services);

const REPORT_STEPS = [
  "DISCOVERY",
  "ENSEMBLE",
  "SOLVA",
  "FINANCIALS",
  "HONESTY",
  "CODE",
] as const;

export default function F0Dashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: dash, isLoading } = useGetF0Dashboard();

  const [engagementId, setEngagementId] = useState<string | null>(null);
  const [retainerId, setRetainerId] = useState<string | null>(null);

  const createEngagement = useCreateF0Engagement();
  const createRetainer = useCreateF0Retainer();
  const [newEngTitle, setNewEngTitle] = useState("");
  const [newRetTitle, setNewRetTitle] = useState("");

  const openEngagement = async () => {
    if (!newEngTitle.trim()) return;
    const eng = await createEngagement.mutateAsync({ data: { title: newEngTitle.trim() } });
    setNewEngTitle("");
    qc.invalidateQueries({ queryKey: getGetF0DashboardQueryKey() });
    setEngagementId(eng.id);
  };

  const openRetainer = async () => {
    if (!newRetTitle.trim()) return;
    const ret = await createRetainer.mutateAsync({ data: { title: newRetTitle.trim() } });
    setNewRetTitle("");
    qc.invalidateQueries({ queryKey: getGetF0DashboardQueryKey() });
    setRetainerId(ret.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <section className="border-b bg-card" aria-label="ATOMIC UI stage context">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}atanda-mark.png`}
              alt=""
              className="h-8 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                ATOMIC UI · F0 cockpit
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Advisory intelligence before, during, or after the production floor.
              </p>
            </div>
          </div>
          <Link href="/ingest">
            <Button size="sm" variant="outline" className="font-mono text-[10px]">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload document
            </Button>
          </Link>
        </div>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-3 md:px-8">
          <div className="rounded-md border border-border/60 bg-background px-3 py-2">
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              1 · Where you came from
            </p>
            <p className="mt-1 text-xs font-semibold">Idea, prompt, document, or live venture</p>
          </div>
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
              2 · What you are doing now
            </p>
            <p className="mt-1 text-xs font-semibold">Pressure-testing the business case</p>
          </div>
          <Link
            href="/command"
            className="group rounded-md border border-border/60 bg-background px-3 py-2 transition-colors hover:border-primary/50"
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              3 · Where you are going next
            </p>
            <p className="mt-1 flex items-center justify-between gap-2 text-xs font-semibold">
              F1 production workflow
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-3 md:px-8">
          {["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"].map((stage, index) => (
            <div key={stage} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={`min-w-8 rounded px-2 py-1 text-center font-mono text-[9px] font-bold ${
                  index === 0
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 text-muted-foreground"
                }`}
              >
                {stage}
              </span>
              {index < 8 && <span className="h-px min-w-2 flex-1 bg-border" />}
            </div>
          ))}
        </div>
      </section>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Briefcase className="h-7 w-7 text-secondary" />
            <h1 className="font-display text-3xl md:text-4xl tracking-wider text-foreground">
              F0 · Business Intelligence
            </h1>
          </div>
          <p className="font-mono text-xs md:text-sm text-muted-foreground max-w-3xl">
            A boutique advisory layer alongside — never inside — the F1–F9 production floor. SOCRATES
            opens and closes every engagement; a 9-SPC ensemble authors reports with a SOLVA bear
            case, range-based financials, and a non-suppressible Honesty Gate.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
          </div>
        ) : (
          <>
            <TotalsStrip totals={dash?.totals} />

            <MonitoringBanner
              monitoring={dash?.monitoring}
              onOpenRetainer={(id) => setRetainerId(id)}
            />
            <OsirisStatus
              status={(dash as typeof dash & {
                osiris?: { custodyCount: number; activeCount: number; openDeviationCount: number };
              })?.osiris}
            />

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              {/* Engagements column */}
              <Card className="p-5 bg-card/50">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl tracking-wider">Engagements</h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newEngTitle}
                    onChange={(e) => setNewEngTitle(e.target.value)}
                    placeholder="New engagement title…"
                    className="font-mono text-xs"
                    data-testid="input-new-engagement"
                  />
                  <Button
                    onClick={openEngagement}
                    disabled={createEngagement.isPending || !newEngTitle.trim()}
                    data-testid="button-open-engagement"
                    className="font-mono text-xs shrink-0"
                  >
                    <Plus className="h-3 w-3 mr-1" /> OPEN
                  </Button>
                </div>
                <div className="space-y-2">
                  {(dash?.engagements ?? []).length === 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      No engagements yet.
                    </p>
                  )}
                  {(dash?.engagements ?? []).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEngagementId(e.id)}
                      data-testid={`engagement-${e.id}`}
                      className={`w-full text-left border rounded p-3 transition-colors ${
                        engagementId === e.id
                          ? "border-secondary bg-secondary/10"
                          : "border-border/40 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold truncate">{e.title}</span>
                        <StatusChip status={e.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Retainers column */}
              <Card className="p-5 bg-card/50">
                <div className="flex items-center gap-2 mb-4">
                  <Radar className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl tracking-wider">Retainer Mode</h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newRetTitle}
                    onChange={(e) => setNewRetTitle(e.target.value)}
                    placeholder="New retainer title…"
                    className="font-mono text-xs"
                    data-testid="input-new-retainer"
                  />
                  <Button
                    onClick={openRetainer}
                    disabled={createRetainer.isPending || !newRetTitle.trim()}
                    data-testid="button-open-retainer"
                    className="font-mono text-xs shrink-0"
                  >
                    <Plus className="h-3 w-3 mr-1" /> ACTIVATE
                  </Button>
                </div>
                <div className="space-y-2">
                  {(dash?.retainers ?? []).length === 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      No retainers active.
                    </p>
                  )}
                  {(dash?.retainers ?? []).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRetainerId(r.id)}
                      data-testid={`retainer-${r.id}`}
                      className={`w-full text-left border rounded p-3 transition-colors ${
                        retainerId === r.id
                          ? "border-secondary bg-secondary/10"
                          : "border-border/40 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold truncate">{r.title}</span>
                        <StatusChip status={r.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {engagementId && (
              <EngagementPanel engagementId={engagementId} onClose={() => setEngagementId(null)} />
            )}
            {retainerId && (
              <RetainerPanel retainerId={retainerId} onClose={() => setRetainerId(null)} />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function OsirisStatus({
  status,
}: {
  status?: { custodyCount: number; activeCount: number; openDeviationCount: number };
}) {
  if (!status) return null;
  return (
    <Card className="mt-3 border-primary/30 bg-primary/5 p-4" data-testid="osiris-status">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
            F9.5 · OSIRIS custody
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Continuous custody status and SOLVA deviation routing.
          </p>
        </div>
        <ShieldAlert className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
        <div className="rounded border border-border/60 bg-background p-2">
          <strong className="block text-base">{status.custodyCount}</strong> registered
        </div>
        <div className="rounded border border-border/60 bg-background p-2">
          <strong className="block text-base text-emerald-500">{status.activeCount}</strong> active
        </div>
        <div className="rounded border border-border/60 bg-background p-2">
          <strong className="block text-base text-amber-500">{status.openDeviationCount}</strong> open deviations
        </div>
      </div>
    </Card>
  );
}

function TotalsStrip({
  totals,
}: {
  totals?: {
    engagementCount: number;
    reportCount: number;
    accruedReportCostUsd: string;
    accruedTaskCostUsd: string;
  };
}) {
  const items = [
    { label: "Engagements", value: totals?.engagementCount ?? 0 },
    { label: "Reports", value: totals?.reportCount ?? 0 },
    { label: "Accrued report cost", value: `$${totals?.accruedReportCostUsd ?? "0"}` },
    { label: "Accrued task cost", value: `$${totals?.accruedTaskCostUsd ?? "0"}` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-4 bg-card/50">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {it.label}
          </div>
          <div className="font-display text-2xl tracking-wider text-secondary mt-1">
            {it.value}
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatRunAt(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const rel =
    diffMs < 60_000
      ? "just now"
      : diffMs < 60 * 60_000
        ? `${Math.floor(diffMs / 60_000)}m ago`
        : diffMs < day
          ? `${Math.floor(diffMs / (60 * 60_000))}h ago`
          : `${Math.floor(diffMs / day)}d ago`;
  return `${d.toLocaleString()} · ${rel}`;
}

function MonitoringBanner({
  monitoring,
  onOpenRetainer,
}: {
  monitoring?: F0MonitoringDashboard;
  onOpenRetainer: (retainerId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const acknowledge = useAcknowledgeF0MonitoringAlert();
  const openAlerts = monitoring?.openAlerts ?? [];

  const ack = async (retainerId: string, runId: string) => {
    try {
      await acknowledge.mutateAsync({ id: retainerId, runId });
      qc.invalidateQueries({ queryKey: getGetF0DashboardQueryKey() });
    } catch (err) {
      const x = extractApiError(err);
      toast({ title: "Error", description: x.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-4 bg-card/50 mt-3" data-testid="monitoring-banner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider uppercase">Weekly CAPI Monitoring</h2>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1" data-testid="text-monitoring-last-run">
            <Clock className="h-3 w-3" /> Last run: {formatRunAt(monitoring?.lastRunAt)}
          </span>
          <span
            className={`flex items-center gap-1 ${
              (monitoring?.openAlertCount ?? 0) > 0 ? "text-destructive font-bold" : ""
            }`}
            data-testid="text-monitoring-open-alerts"
          >
            <BellRing className="h-3 w-3" /> {monitoring?.openAlertCount ?? 0} open alert
            {(monitoring?.openAlertCount ?? 0) === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {openAlerts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {openAlerts.map((a) => (
            <li
              key={a.id}
              data-testid={`open-alert-${a.id}`}
              className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-destructive bg-background/30 rounded px-3 py-2 font-mono text-[11px]"
            >
              <div className="min-w-0">
                <button
                  onClick={() => onOpenRetainer(a.retainerId)}
                  className="font-bold text-secondary hover:underline"
                  data-testid={`open-alert-retainer-${a.id}`}
                >
                  {a.retainerTitle}
                </button>
                <span className="ml-2">
                  {a.highestUrgency && (
                    <span className="font-bold text-destructive">[{a.highestUrgency}]</span>
                  )}{" "}
                  {a.alertCount} alert{a.alertCount === 1 ? "" : "s"}
                  {a.capiPosture ? ` · ${a.capiPosture}` : ""}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {a.source === "cron" ? "auto" : "manual"} · {formatRunAt(a.ranAt)}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-[10px] h-7 shrink-0"
                disabled={acknowledge.isPending}
                onClick={() => ack(a.retainerId, a.id)}
                data-testid={`button-acknowledge-${a.id}`}
              >
                <Check className="h-3 w-3 mr-1" /> ACK
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground shrink-0">
      {status}
    </span>
  );
}

// ── Engagement panel ──────────────────────────────────────────────────────────

function EngagementPanel({
  engagementId,
  onClose,
}: {
  engagementId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetF0Engagement(engagementId);
  const generateDiscovery = useGenerateF0Discovery();
  const recordDiscovery = useRecordF0Discovery();
  const generateChallenge = useGenerateF0Challenge();

  const [service, setService] = useState(F0_SERVICES[0]!.value);
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [report, setReport] = useState<F0Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const engagement = data?.engagement;
  const transcript = engagement?.discoveryTranscript as
    | { intro?: string; questions?: { id: string; prompt: string; why: string }[]; answers?: { id: string; answer: string }[] }
    | undefined
    | null;
  const questions = transcript?.questions ?? [];
  const hasAnswers = Array.isArray(transcript?.answers) && transcript!.answers!.length > 0;

  const refetch = () => {
    qc.invalidateQueries({ queryKey: getGetF0EngagementQueryKey(engagementId) });
    qc.invalidateQueries({ queryKey: getGetF0DashboardQueryKey() });
  };

  const doGenerateDiscovery = async () => {
    try {
      await generateDiscovery.mutateAsync({ id: engagementId, data: { notes: notes || undefined } });
      refetch();
      toast({ title: "SOCRATES", description: "Discovery questions generated." });
    } catch (err) {
      handleMutError(err);
    }
  };

  const doRecordAnswers = async () => {
    const payload = questions
      .map((q) => ({ id: q.id, answer: (answers[q.id] ?? "").trim() }))
      .filter((a) => a.answer.length > 0);
    if (payload.length === 0) {
      toast({ title: "Answers required", description: "Answer at least one question.", variant: "destructive" });
      return;
    }
    try {
      await recordDiscovery.mutateAsync({ id: engagementId, data: { answers: payload } });
      refetch();
      toast({ title: "Recorded", description: "Discovery answers saved." });
    } catch (err) {
      handleMutError(err);
    }
  };

  const doGenerateReport = async () => {
    setError(null);
    setReport(null);
    setRunning(true);
    setStepIdx(-1);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(
        getGenerateF0ReportUrl(engagementId),
        { service, notes: notes || undefined },
        (e) => {
          if (e.event === "step") {
            const d = e.data as { index?: number; status?: string };
            if (typeof d.index === "number" && d.status === "DONE") setStepIdx(d.index);
          } else if (e.event === "complete") {
            const d = e.data as { report: F0Report };
            setReport(d.report);
            setStepIdx(REPORT_STEPS.length - 1);
            refetch();
            toast({ title: "Report ready", description: `Report code ${d.report.reportCode}` });
          } else if (e.event === "error") {
            const d = e.data as { error?: string };
            setError(d.error || "Stream error");
          }
        },
        ac.signal,
      );
    } catch (err) {
      const x = extractApiError(err);
      setError(x.message);
    } finally {
      setRunning(false);
    }
  };

  const doChallenge = async () => {
    try {
      await generateChallenge.mutateAsync({ id: engagementId, data: { notes: notes || undefined } });
      refetch();
      toast({ title: "SOCRATES close", description: "Challenge recorded; engagement closed." });
    } catch (err) {
      handleMutError(err);
    }
  };

  const handleMutError = (err: unknown) => {
    const x = extractApiError(err);
    toast({
      title: x.status === 402 ? "Cost cap reached" : "Error",
      description: x.message,
      variant: "destructive",
    });
  };

  return (
    <Card className="p-5 bg-card/50 mt-6" data-testid="engagement-panel">
      {isLoading || !engagement ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl tracking-wider">{engagement.title}</h2>
              <StatusChip status={engagement.status} />
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="font-mono text-xs">
              CLOSE
            </Button>
          </div>

          {/* Step 1 — SOCRATES discovery */}
          <section className="mb-6">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2">
              1 · SOCRATES Discovery
            </h3>
            {questions.length === 0 ? (
              <Button
                onClick={doGenerateDiscovery}
                disabled={generateDiscovery.isPending}
                data-testid="button-generate-discovery"
                className="font-mono text-xs"
              >
                {generateDiscovery.isPending ? "GENERATING…" : "GENERATE 7 QUESTIONS"}
              </Button>
            ) : (
              <div className="space-y-3">
                {transcript?.intro && (
                  <p className="font-mono text-[11px] text-muted-foreground italic">
                    {transcript.intro}
                  </p>
                )}
                {questions.map((q, i) => {
                  const existing = transcript?.answers?.find((a) => a.id === q.id)?.answer;
                  return (
                    <div key={q.id}>
                      <label className="font-mono text-[11px] font-bold block mb-1">
                        Q{i + 1}. {q.prompt}
                      </label>
                      <Textarea
                        defaultValue={existing ?? ""}
                        onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                        placeholder={q.why}
                        className="font-mono text-xs min-h-[60px]"
                        data-testid={`answer-${q.id}`}
                      />
                    </div>
                  );
                })}
                <Button
                  onClick={doRecordAnswers}
                  disabled={recordDiscovery.isPending}
                  variant="outline"
                  data-testid="button-record-answers"
                  className="font-mono text-xs"
                >
                  {recordDiscovery.isPending ? "SAVING…" : "SAVE ANSWERS"}
                </Button>
              </div>
            )}
          </section>

          {/* Step 2 — Report */}
          <section className="mb-6">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2">
              2 · Ensemble Report
            </h3>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="flex-1 min-w-[220px]">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Service
                </label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="font-mono text-xs" data-testid="select-service">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {F0_SERVICE_GROUPS.map((g) => (
                      <SelectGroup key={g.group}>
                        <SelectLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {g.group}
                        </SelectLabel>
                        {g.services.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="font-mono text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={doGenerateReport}
                disabled={running || !hasAnswers}
                data-testid="button-generate-report"
                className="font-mono text-xs"
              >
                {running ? "AUTHORING…" : "GENERATE REPORT"}
              </Button>
            </div>
            {!hasAnswers && (
              <p className="font-mono text-[11px] text-muted-foreground mb-2">
                Record the discovery answers first.
              </p>
            )}
            {(running || report) && (
              <div className="flex items-center gap-1 mb-3">
                {REPORT_STEPS.map((s, i) => {
                  const done = i <= stepIdx;
                  const active = running && i === stepIdx + 1;
                  return (
                    <div
                      key={s}
                      className={`flex-1 h-7 rounded border flex items-center justify-center font-mono text-[9px] font-bold uppercase ${
                        done
                          ? "border-secondary bg-secondary/20 text-secondary"
                          : active
                            ? "border-primary bg-primary/20 text-primary animate-pulse"
                            : "border-border/40 bg-muted/20 text-muted-foreground"
                      }`}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
            )}
            {error && (
              <p className="font-mono text-[11px] text-destructive mb-2">{error}</p>
            )}
            {report && <ReportView report={report} />}
          </section>

          {/* Existing reports */}
          {(data?.reports ?? []).length > 0 && (
            <section className="mb-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Prior reports
              </h3>
              <div className="space-y-2">
                {data!.reports.map((r) => (
                  <details
                    key={r.id}
                    className="border border-border/40 rounded p-2 bg-background/30"
                    data-testid={`report-${r.id}`}
                  >
                    <summary className="font-mono text-xs cursor-pointer">
                      {r.service} · <span className="text-secondary">{r.reportCode}</span>
                    </summary>
                    <div className="mt-2">
                      <ReportView report={r} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Step 3 — SOCRATES close */}
          <section>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2">
              3 · SOCRATES Close (Challenge)
            </h3>
            {engagement.challengeResponse ? (
              <ChallengeView challenge={engagement.challengeResponse} />
            ) : (
              <Button
                onClick={doChallenge}
                disabled={generateChallenge.isPending || engagement.status === "CLOSED"}
                variant="outline"
                data-testid="button-generate-challenge"
                className="font-mono text-xs"
              >
                <ShieldAlert className="h-3 w-3 mr-1" />
                {generateChallenge.isPending ? "CHALLENGING…" : "WHAT WOULD MAKE YOU NOT PROCEED?"}
              </Button>
            )}
          </section>
        </>
      )}
    </Card>
  );
}

function ReportView({ report }: { report: F0Report }) {
  const c = report.content as {
    executivePosition?: string;
    findings?: { title: string; detail: string; evidenceBasis: string }[];
    solvaBearCase?: { thesis: string; arguments: string[] };
    financials?: {
      currency: string;
      scenarios: Record<string, { assumptions: string[]; lineItems: { label: string; value: string }[] }>;
    };
    honestyGate?: { modelledVsSourced: string; confidence: string; biggestReasonToDistrust: string };
    recommendations?: { action: string; rationale: string }[];
  };
  return (
    <div className="space-y-3 font-mono text-[11px]">
      <div className="flex items-center gap-2">
        <span className="text-secondary font-bold">{report.reportCode}</span>
        {report.sku && <span className="text-muted-foreground">· SKU {report.sku}</span>}
      </div>
      {c.executivePosition && (
        <p className="text-foreground/90 leading-relaxed">{c.executivePosition}</p>
      )}
      {c.findings && c.findings.length > 0 && (
        <div>
          <div className="font-bold uppercase tracking-wider text-muted-foreground">Findings</div>
          <ul className="mt-1 space-y-1">
            {c.findings.map((f, i) => (
              <li key={i} className="border-l-2 border-border pl-2">
                <span className="font-bold">{f.title}:</span> {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.solvaBearCase && (
        <div className="border border-destructive/40 rounded p-2 bg-destructive/5">
          <div className="font-bold uppercase tracking-wider text-destructive flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> SOLVA Bear Case
          </div>
          <p className="mt-1">{c.solvaBearCase.thesis}</p>
          <ul className="mt-1 list-disc pl-4">
            {c.solvaBearCase.arguments.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {c.financials && (
        <div>
          <div className="font-bold uppercase tracking-wider text-muted-foreground">
            Financials ({c.financials.currency}) — bear / base / bull
          </div>
          <div className="grid md:grid-cols-3 gap-2 mt-1">
            {(["bear", "base", "bull"] as const).map((k) => {
              const sc = c.financials!.scenarios[k];
              if (!sc) return null;
              return (
                <div key={k} className="border border-border/40 rounded p-2">
                  <div className="font-bold uppercase text-secondary">{k}</div>
                  <ul className="mt-1">
                    {sc.lineItems.map((li, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{li.label}</span>
                        <span>{li.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {c.honestyGate && (
        <div className="border border-secondary/40 rounded p-2 bg-secondary/5">
          <div className="font-bold uppercase tracking-wider text-secondary">
            Honesty Gate · confidence {c.honestyGate.confidence}
          </div>
          <p className="mt-1">{c.honestyGate.modelledVsSourced}</p>
          <p className="mt-1 text-muted-foreground">
            Biggest reason to distrust: {c.honestyGate.biggestReasonToDistrust}
          </p>
        </div>
      )}
      {c.recommendations && c.recommendations.length > 0 && (
        <div>
          <div className="font-bold uppercase tracking-wider text-muted-foreground">
            Recommendations
          </div>
          <ol className="mt-1 list-decimal pl-4 space-y-1">
            {c.recommendations.map((r, i) => (
              <li key={i}>
                <span className="font-bold">{r.action}</span> — {r.rationale}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ChallengeView({ challenge }: { challenge: unknown }) {
  const c = challenge as {
    challenge?: string;
    killCriteria?: string[];
    proceedConditions?: string[];
    closingCounsel?: string;
  };
  return (
    <div className="space-y-2 font-mono text-[11px] border border-border/40 rounded p-3 bg-background/30">
      {c.challenge && <p className="italic text-foreground/90">{c.challenge}</p>}
      {c.killCriteria && c.killCriteria.length > 0 && (
        <div>
          <div className="font-bold uppercase tracking-wider text-destructive">Kill criteria</div>
          <ul className="list-disc pl-4">
            {c.killCriteria.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </div>
      )}
      {c.proceedConditions && c.proceedConditions.length > 0 && (
        <div>
          <div className="font-bold uppercase tracking-wider text-secondary">Proceed conditions</div>
          <ul className="list-disc pl-4">
            {c.proceedConditions.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </div>
      )}
      {c.closingCounsel && <p className="text-muted-foreground">{c.closingCounsel}</p>}
    </div>
  );
}

// ── Retainer panel ────────────────────────────────────────────────────────────

function RetainerPanel({ retainerId, onClose }: { retainerId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetF0Retainer(retainerId);
  const createTask = useCreateF0RetainerTask();
  const updateTask = useUpdateF0RetainerTask();
  const generateCommentary = useGenerateF0Commentary();
  const generateMonitoring = useGenerateF0Monitoring();

  const [taskTitle, setTaskTitle] = useState("");
  const [taskStage, setTaskStage] = useState("");
  const [stage, setStage] = useState("F5");
  const [signals, setSignals] = useState("");
  const [commentary, setCommentary] = useState<F0Commentary | null>(null);
  const [monitoring, setMonitoring] = useState<F0Monitoring | null>(null);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: getGetF0RetainerQueryKey(retainerId) });
    qc.invalidateQueries({ queryKey: getGetF0DashboardQueryKey() });
  };

  const handleErr = (err: unknown) => {
    const x = extractApiError(err);
    toast({
      title: x.status === 402 ? "Cost cap reached" : "Error",
      description: x.message,
      variant: "destructive",
    });
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        id: retainerId,
        data: { title: taskTitle.trim(), stage: taskStage || undefined },
      });
      setTaskTitle("");
      setTaskStage("");
      refetch();
    } catch (err) {
      handleErr(err);
    }
  };

  const setStatus = async (taskId: string, status: F0RetainerTask["status"]) => {
    try {
      await updateTask.mutateAsync({ id: retainerId, taskId, data: { status } });
      refetch();
    } catch (err) {
      handleErr(err);
    }
  };

  const runCommentary = async () => {
    try {
      const res = await generateCommentary.mutateAsync({ id: retainerId, data: { stage } });
      setCommentary(res);
    } catch (err) {
      handleErr(err);
    }
  };

  const runMonitoring = async () => {
    try {
      const res = await generateMonitoring.mutateAsync({
        id: retainerId,
        data: { signals: signals || undefined },
      });
      setMonitoring(res);
      refetch();
    } catch (err) {
      handleErr(err);
    }
  };

  return (
    <Card className="p-5 bg-card/50 mt-6" data-testid="retainer-panel">
      {isLoading || !data?.retainer ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl tracking-wider">{data.retainer.title}</h2>
              <StatusChip status={data.retainer.status} />
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="font-mono text-xs">
              CLOSE
            </Button>
          </div>

          {/* Task catalog */}
          <section className="mb-6">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> Task catalog & approvals
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Propose a task…"
                className="font-mono text-xs flex-1 min-w-[180px]"
                data-testid="input-task-title"
              />
              <Input
                value={taskStage}
                onChange={(e) => setTaskStage(e.target.value)}
                placeholder="Stage (e.g. F5)"
                className="font-mono text-xs w-32"
                data-testid="input-task-stage"
              />
              <Button
                onClick={addTask}
                disabled={createTask.isPending || !taskTitle.trim()}
                data-testid="button-add-task"
                className="font-mono text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> PROPOSE
              </Button>
            </div>
            <div className="space-y-2">
              {(data.tasks ?? []).length === 0 && (
                <p className="font-mono text-[11px] text-muted-foreground">No tasks proposed.</p>
              )}
              {(data.tasks ?? []).map((t) => (
                <div
                  key={t.id}
                  className="border border-border/40 rounded p-2 flex items-center justify-between gap-2"
                  data-testid={`task-${t.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold truncate">
                      {t.title}
                      {t.stage && (
                        <span className="ml-2 text-[9px] text-muted-foreground">[{t.stage}]</span>
                      )}
                    </div>
                    <StatusChip status={t.status} />
                  </div>
                  {t.status === "PROPOSED" && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(t.id, "APPROVED")}
                        className="font-mono text-[10px] h-7"
                        data-testid={`approve-${t.id}`}
                      >
                        APPROVE
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(t.id, "DECLINED")}
                        className="font-mono text-[10px] h-7"
                        data-testid={`decline-${t.id}`}
                      >
                        DECLINE
                      </Button>
                    </div>
                  )}
                  {t.status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(t.id, "COMPLETED")}
                      className="font-mono text-[10px] h-7 shrink-0"
                      data-testid={`complete-${t.id}`}
                    >
                      COMPLETE
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Stage commentary */}
          <section className="mb-6">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Stage F1–F9 commentary
            </h3>
            <div className="flex gap-2 mb-3">
              <Input
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="Stage (e.g. F5)"
                className="font-mono text-xs w-32"
                data-testid="input-commentary-stage"
              />
              <Button
                onClick={runCommentary}
                disabled={generateCommentary.isPending || !stage.trim()}
                data-testid="button-commentary"
                className="font-mono text-xs"
              >
                {generateCommentary.isPending ? "READING…" : "GET COMMENTARY"}
              </Button>
            </div>
            {commentary && (
              <div className="border border-border/40 rounded p-3 bg-background/30 font-mono text-[11px] space-y-2">
                <div className="font-bold text-secondary uppercase">{commentary.stage}</div>
                <p>{commentary.read}</p>
                {commentary.strengths.length > 0 && (
                  <div>
                    <span className="font-bold">Strengths:</span>
                    <ul className="list-disc pl-4">
                      {commentary.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {commentary.watchouts.length > 0 && (
                  <div>
                    <span className="font-bold text-destructive">Watch-outs:</span>
                    <ul className="list-disc pl-4">
                      {commentary.watchouts.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-muted-foreground">One thing to fix: {commentary.oneThingToFix}</p>
              </div>
            )}
          </section>

          {/* Weekly monitoring */}
          <section>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1">
              <Radar className="h-3 w-3" /> Weekly CAPI monitoring
            </h3>
            <Textarea
              value={signals}
              onChange={(e) => setSignals(e.target.value)}
              placeholder="Optional: paste this week's market signals, competitor moves, metrics…"
              className="font-mono text-xs min-h-[60px] mb-2"
              data-testid="input-signals"
            />
            <Button
              onClick={runMonitoring}
              disabled={generateMonitoring.isPending}
              data-testid="button-monitoring"
              className="font-mono text-xs mb-3"
            >
              {generateMonitoring.isPending ? "SCANNING…" : "RUN MONITORING BRIEF"}
            </Button>
            {monitoring && (
              <div className="border border-border/40 rounded p-3 bg-background/30 font-mono text-[11px] space-y-2">
                <p>
                  <span className="font-bold text-secondary uppercase">CAPI posture:</span>{" "}
                  {monitoring.capiPosture}
                </p>
                {monitoring.eventAlerts.length > 0 && (
                  <div>
                    <span className="font-bold text-destructive uppercase">Alerts</span>
                    <ul className="mt-1 space-y-1">
                      {monitoring.eventAlerts.map((a, i) => (
                        <li key={i} className="border-l-2 border-destructive pl-2">
                          <span className="font-bold">[{a.urgency}]</span> {a.alert} —{" "}
                          <span className="text-muted-foreground">{a.recommendedAction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {monitoring.movements.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-muted-foreground">Movements</span>
                    <ul className="list-disc pl-4">
                      {monitoring.movements.map((m, i) => (
                        <li key={i}>
                          [{m.significance}] {m.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-muted-foreground">{monitoring.weeklyCounsel}</p>
              </div>
            )}
          </section>
        </>
      )}
    </Card>
  );
}
