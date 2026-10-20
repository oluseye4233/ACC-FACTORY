import { useId } from "react";
import { Link } from "wouter";
import {
  getListMyBadgesQueryKey,
  useListMyBadges,
  type BadgeProgress,
} from "@workspace/api-client-react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { questCompletion } from "@/lib/quest-progress";
import { cn } from "@/lib/utils";

export const QUEST_PATH = [
  { id: "ASPE", label: "ASPE", name: "Atomic Super Prompt Engineer", tier: "Badge path" },
  { id: "AISA", label: "AISA", name: "Atomic Intelligent Systems Architect", tier: "Badge path" },
  { id: "AISE", label: "AISE", name: "Atomic Intelligent Systems Engineer", tier: "Badge path" },
  { id: "AISA_PWDD", label: "AAISA", name: "Advanced Architect (PWDD)", tier: "Senior certificate" },
  { id: "AISE_BUILD", label: "AAISE", name: "Advanced Engineer (Build)", tier: "Senior certificate" },
] as const;

/** Badges whose credential requires a manual claim / verified evidence even after counts are met. */
const MANUAL_CLAIM = new Set(["AISE", "AISE_BUILD"]);
const REQUIREMENT_LABELS: Record<string, string> = {
  spcs: "SPCs", mas: "Micro Agents", atlas: "ATLAS PDDs", micro: "Micro PDDs",
  mvp: "MVP PDDs", pwdds: "Certified PWDD projects",
  verifiedUrls: "Verified deployments", verifiedBuilds: "Verified builds",
};

type Display = { label: string; tone: "earned" | "revoked" | "pending" | "progress" | "locked" | "unknown"; detail: string };

export function describeBadge(badge: BadgeProgress | undefined, percent: number | null): Display {
  if (!badge) return { label: "NOT REPORTED", tone: "unknown", detail: "No status reported for this badge yet." };
  if (badge.status === "REVOKED")
    return { label: "REVOKED", tone: "revoked", detail: "Revoked by an administrator. Not an active credential." };
  if (badge.status === "CLAIMED") return { label: "CLAIMED", tone: "earned", detail: "Credential claimed." };
  if (badge.status === "UNLOCKED") return { label: "EARNED", tone: "earned", detail: "Unlocked under Quest rules." };
  if (MANUAL_CLAIM.has(badge.badgeId) && (badge.eligible || percent === 100))
    return { label: "CLAIM PENDING", tone: "pending", detail: "Requirements met. Verified evidence and a claim are still needed." };
  if (badge.eligible || percent === 100)
    return { label: "AWAITING AWARD", tone: "pending", detail: "Requirements met. The credential is not issued until the Quest rules award it." };
  if (percent === null) return { label: "LOCKED", tone: "unknown", detail: "Progress unknown. No measurable requirements reported." };
  return { label: percent > 0 ? "IN PROGRESS" : "LOCKED", tone: percent > 0 ? "progress" : "locked", detail: "Working toward requirements." };
}

const toneClass: Record<Display["tone"], string> = {
  earned: "border-primary/50 bg-primary/15 text-primary",
  revoked: "border-destructive/60 bg-destructive/10 text-destructive",
  pending: "border-secondary/60 bg-secondary/15 text-foreground",
  progress: "border-border bg-muted text-foreground",
  locked: "border-border bg-muted/60 text-muted-foreground",
  unknown: "border-dashed border-border bg-transparent text-muted-foreground",
};

function Bar({ id, label, current, target, compact }: { id: string; label: string; current: number; target: number; compact?: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span id={id} className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{current} / {target}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(current, target)}
        aria-valuetext={`${current} of ${target}`}
        className={cn("mt-1 overflow-hidden rounded-full bg-muted", compact ? "h-1" : "h-1.5")}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function QuestProgress({ compact = false, className }: { compact?: boolean; className?: string }) {
  const instanceId = useId();
  const q = useListMyBadges({
    query: {
      queryKey: getListMyBadgesQueryKey(),
      refetchOnMount: "always",
      staleTime: 0,
      refetchInterval: 60000,
      refetchOnWindowFocus: true,
      retry: false,
    },
  });

  return (
    <section
      aria-label="Quest badge and certification progress"
      className={cn("rounded-xl border border-border/70 bg-card/70", compact ? "p-3" : "p-4 sm:p-5", className)}
      data-testid="quest-progress"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Quest progress</p>
        <Link href="/quests" className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:underline" data-testid="link-quest-progress-quests">
          Quest rules
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Counted Quest requirements, not course completion. Reaching 100% does not issue a credential.
      </p>

      {q.isLoading ? (
        <div className="space-y-2" data-testid="quest-progress-loading" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-muted/60 animate-pulse" />)}
        </div>
      ) : q.isError ? (
        <div role="alert" className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs" data-testid="quest-progress-error">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
          <span className="flex-1">Quest progress unavailable. No status is shown rather than a guess.</span>
          <Button size="sm" variant="outline" className="h-7" onClick={() => void q.refetch()} disabled={q.isFetching} data-testid="button-retry-quest-progress">
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
          </Button>
        </div>
      ) : (
        <ul className={cn("grid gap-2", compact ? "" : "sm:grid-cols-2 lg:grid-cols-5")}>
          {QUEST_PATH.map((meta) => {
            const badge = (q.data ?? []).find((b) => b.badgeId === meta.id);
            const { percent, requirements } = badge ? questCompletion(badge) : { percent: null, requirements: [] };
            const d = describeBadge(badge, percent);
            return (
              <li key={meta.id} className="rounded-lg border border-border/60 bg-background/60 p-2.5" data-testid={`quest-progress-${meta.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold">{meta.label}</p>
                    {!compact && <p className="truncate text-[10px] text-muted-foreground">{meta.tier} · {meta.name}</p>}
                  </div>
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold", toneClass[d.tone])} data-testid={`status-quest-${meta.id}`}>
                    {d.label}
                  </span>
                </div>
                {percent !== null && <p className="mt-2 font-mono text-xs text-foreground">{percent}% of counted requirements</p>}
                <div className="mt-2 space-y-1.5">
                  {requirements.length === 0 ? (
                    <p className="font-mono text-[10px] text-muted-foreground" data-testid={`unknown-quest-${meta.id}`}>Progress unknown</p>
                  ) : (
                    requirements.map((r) => (
                      <Bar key={r.key} id={`${instanceId}-qp-${meta.id}-${r.key}`} label={`${meta.label} ${REQUIREMENT_LABELS[r.key] ?? r.key}`} current={r.current} target={r.target} compact={compact} />
                    ))
                  )}
                </div>
                {d.tone !== "progress" && d.tone !== "locked" && (
                  <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{d.detail}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
