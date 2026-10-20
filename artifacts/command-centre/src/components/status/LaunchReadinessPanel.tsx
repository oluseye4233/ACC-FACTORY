import { Link } from "wouter";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useGetLaunchReadiness, getGetLaunchReadinessQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { deriveReadinessView, type ReadinessTone } from "@/lib/launch-readiness";

const toneClass: Record<ReadinessTone, string> = {
  good: "border-primary/30 bg-primary/10 text-primary",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
};

function fmt(ts: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : format(d, "yyyy-MM-dd HH:mm:ss");
}

function Row({ label, value, tone }: { label: string; value: string; tone: ReadinessTone }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 max-w-full break-words rounded border px-1.5 py-0.5 font-bold ${toneClass[tone]}`}>{value}</dd>
    </div>
  );
}

export function LaunchReadinessPanel({ compact = false }: { compact?: boolean }) {
  const q = useGetLaunchReadiness({
    query: {
      queryKey: getGetLaunchReadinessQueryKey(),
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  });
  const v = deriveReadinessView(q.data, q.isError, q.isLoading);
  const overallTone: ReadinessTone =
    v.overall === "ready" ? "good" : v.overall === "not_ready" ? "bad" : "unknown";
  const dbDown = !q.isError && q.data?.database === "unavailable";

  return (
    <div className="space-y-3" role="region" aria-label="Database and AI dependency status"
      aria-busy={q.isFetching} data-testid="launch-readiness">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`min-w-0 max-w-full break-words rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${toneClass[overallTone]}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="launch-readiness-overall"
        >
          {v.overallLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          data-testid="button-retry-launch-readiness"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          {q.isFetching ? "Checking…" : "Check now"}
        </Button>
      </div>

      {q.isError && (
        <p role="alert" className="rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 font-mono text-[10px] text-yellow-500" data-testid="launch-readiness-fetch-error">
          The status check could not be reached. Dependency state is unknown, not confirmed down. Retrying every 30 seconds.
        </p>
      )}

      <dl className="space-y-2">
        <Row label="Database" value={v.database.label} tone={v.database.tone} />
        <Row label="AI provider key" value={v.ai.label} tone={v.ai.tone} />
      </dl>

      {dbDown && (
        <p role="alert" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-[10px] text-destructive" data-testid="launch-readiness-db-down">
          The database is unavailable. An operator must restore it; there is nothing visitors need to enter or do. Never share credentials to fix this.
        </p>
      )}

      {v.message && !compact && <p className="break-words text-xs text-muted-foreground">{v.message}</p>}

      <p className="break-words font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {v.checkedAt ? `Checked ${fmt(v.checkedAt)}` : "No current check result"} · auto-refresh 30s
      </p>

      {!compact && v.deferred.length > 0 && (
        <div className="border-t border-border/50 pt-3" data-testid="launch-readiness-deferred">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deferred upgrades (not yet available)</p>
          <ul className="mt-2 space-y-1">
            {v.deferred.map((d) => (
              <li key={d} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 rounded border border-border px-1 font-mono text-[9px] uppercase">Deferred</span>
                <span className="min-w-0 break-words">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {compact && v.deferred.length > 0 && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{v.deferred.length} upgrade(s) deferred</p>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        "Configured" means an AI key is present; it is not verified against the provider. "Dependencies ready" covers database and AI configuration only, not full feature or certification readiness.
      </p>
      {compact && (
        <Link href="/status" className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">
          Full status
        </Link>
      )}
    </div>
  );
}
