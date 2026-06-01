import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  useListMyBadges,
  useClaimAiseBadge,
  useClaimEngineerBadge,
  useGetMe,
  useListMyContextCraftBadges,
  useListSessions,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Hexagon } from "lucide-react";
import { PillarTriangle } from "@/components/shared/PillarTriangle";
import type { BadgeProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Award, CheckCircle2, Download, Lock, ShieldCheck, Trophy } from "lucide-react";
import {
  downloadBadgeCertificate,
  type BadgeFormat,
  type CertificateBadgeId,
} from "@/lib/badge-certificate";

const BADGE_META: Record<string, { name: string; fullName: string; description: string; reqText: string; icon: typeof Trophy }> = {
  ASPE: {
    name: "ASPE",
    fullName: "ATOMIC SUPER PROMPT ENGINEER",
    description: "Atomic Super Prompt Engineer — unlocks DE-SPC auto-evolution.",
    reqText: "Create at least 3 SPCs AND at least 4 Micro Agent (MA) Birth Packages.",
    icon: ShieldCheck,
  },
  AISA: {
    name: "AISA",
    fullName: "ATOMIC INTELLIGENT SYSTEMS ARCHITECT",
    description: "Atomic Intelligent Systems Architect — full ATLAS PDD lifecycle completion.",
    reqText: "Create at least 1 ATLAS PDD, 1 Micro PDD, and 1 MVP PDD.",
    icon: Award,
  },
  AISE: {
    name: "AISE",
    fullName: "ATOMIC INTELLIGENT SYSTEMS ENGINEER",
    description: "Atomic Intelligent Systems Engineer — shipped AI agents built with SPC DNA.",
    reqText: "Submit a verified URL to a working GPT, CoPilot, native app, or custom SPC-DNA agent.",
    icon: Trophy,
  },
};

export default function Quests() {
  const { data, isLoading, refetch } = useListMyBadges();
  const { data: contextCraft, isLoading: isLoadingCC } = useListMyContextCraftBadges();
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const recipientName =
    (me?.displayName && me.displayName.trim().length > 0
      ? me.displayName.trim()
      : me?.email?.split("@")[0]) ?? "Operator";
  const recipientEmail = me?.email ?? null;

  const handleDownload = async (b: BadgeProgress, format: BadgeFormat): Promise<void> => {
    const meta = BADGE_META[b.badgeId];
    if (!meta) return;
    try {
      await downloadBadgeCertificate({
        badgeId: b.badgeId as "ASPE" | "AISA" | "AISE",
        badgeFullName: meta.fullName,
        description: meta.description,
        recipientName,
        recipientEmail,
        unlockedAt: b.unlockedAt ?? null,
        format,
      });
      toast({
        title: "Badge downloaded",
        description: `Your personalized ${b.badgeId} certificate has been saved.`,
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: (err as Error).message ?? "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleSeniorDownload = async (
    badgeId: CertificateBadgeId,
    badgeFullName: string,
    description: string,
    thresholdNote: string,
    unlockedAt: string | null,
    format: BadgeFormat,
    extras: { verifiedUrl?: string | null; evidenceExcerpt?: string | null } = {},
  ): Promise<void> => {
    try {
      await downloadBadgeCertificate({
        badgeId,
        badgeFullName,
        description,
        recipientName,
        recipientEmail,
        unlockedAt,
        format,
        senior: {
          thresholdNote,
          verifiedUrl: extras.verifiedUrl ?? null,
          evidenceExcerpt: extras.evidenceExcerpt ?? null,
        },
      });
      toast({
        title: "Certificate downloaded",
        description: `Your personalized ${badgeId} senior certificate has been saved.`,
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: (err as Error).message ?? "Try again.",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-wider mb-2">QUEST BADGES</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Achievements that unlock advanced FORGE.BONSAI capabilities and credentials.
          </p>
        </div>

        {/* CONTEXT CRAFT MINI-QUESTS */}
        <Card className="mb-8 border-l-4 border-l-secondary/60 bg-card">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="font-display tracking-wider text-xl">
                  CONTEXT CRAFT MINI-QUESTS
                </CardTitle>
                <CardDescription className="font-serif text-sm mt-1">
                  Training badges for the 7 pillars of a well-structured prompt.
                  Each badge auto-activates when an F1 or F2 prompt scores ≥ 6
                  on that pillar.
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted-foreground">EARNED</div>
                <div className="font-display text-2xl tracking-wider text-primary">
                  {(contextCraft ?? []).filter((b) => b.earned).length}
                  <span className="text-muted-foreground text-base"> / 7</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingCC ? (
              <div className="flex flex-wrap gap-4 justify-center">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-16" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 sm:gap-6 justify-center sm:justify-start">
                {(contextCraft ?? []).map((b) => (
                  <PillarTriangle key={b.pillar} badge={b} />
                ))}
              </div>
            )}
            <p className="mt-5 text-xs font-mono text-muted-foreground">
              Tip: open a session, run the F1 Diagnostic on a richer prompt, and
              watch the triangles light up as each pillar crosses the threshold.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <>
            <SeniorBadgesSection
              badges={data ?? []}
              onChanged={() => refetch()}
              recipientName={recipientName}
              onDownload={handleSeniorDownload}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {(data ?? []).filter((b) => BADGE_META[b.badgeId]).map((b) => {
                const meta = BADGE_META[b.badgeId]!;
                const Icon = meta.icon;
                const locked = b.status === "LOCKED";
                const claimed = b.status === "CLAIMED";
                return (
                  <Card
                    key={b.badgeId}
                    className={`bg-white text-black border-2 border-black rounded-md overflow-hidden flex flex-col ${
                      claimed ? "ring-2 ring-black" : ""
                    } ${locked ? "opacity-70" : ""}`}
                  >
                    {/* Header: small logo top-left + status */}
                    <div className="flex items-start justify-between gap-3 p-4 border-b-2 border-black">
                      <img
                        src={`${import.meta.env.BASE_URL}atanda-logo.png`}
                        alt="ATANDA"
                        className={`h-8 w-auto ${locked ? "grayscale opacity-60" : ""}`}
                      />
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-1 rounded border border-black ${
                          claimed ? "bg-black text-white" : "bg-white text-black"
                        }`}
                      >
                        {claimed && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                        {locked && <Lock className="h-3 w-3 inline mr-1" />}
                        {b.status}
                      </span>
                    </div>

                    {/* Badge identity */}
                    <div className="flex items-center gap-3 px-4 pt-4">
                      <Icon className="h-8 w-8 text-black shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <div className="font-display text-3xl tracking-[0.18em] text-black leading-none">
                          {meta.name}
                        </div>
                        <div className="font-mono text-[9px] tracking-widest text-black/70 mt-1">
                          {meta.fullName}
                        </div>
                      </div>
                    </div>

                    <CardHeader className="pb-3 pt-3">
                      <CardDescription className="text-xs text-black/80">{meta.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="text-xs font-mono text-black/70 mb-3">{meta.reqText}</div>
                      <div className="space-y-1.5">
                        {Object.entries(b.requirements).map(([k, req]) => {
                          const cur = (b.progress[k] as number | undefined) ?? 0;
                          const pct = Math.min(100, (cur / req) * 100);
                          const met = cur >= req;
                          return (
                            <div key={k}>
                              <div className="flex justify-between text-[10px] font-mono mb-0.5">
                                <span className="text-black/60 uppercase">{k}</span>
                                <span className={met ? "text-black font-bold" : "text-black/80"}>
                                  {cur} / {req}
                                </span>
                              </div>
                              <div className="h-1 bg-black/10 rounded">
                                <div
                                  className={`h-full rounded transition-all ${met ? "bg-black" : "bg-black/40"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!locked && (
                        <div className="mt-4 pt-3 border-t border-black/20">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full font-mono text-xs gap-2 border-black text-black hover:bg-black hover:text-white"
                                data-testid={`button-download-${b.badgeId.toLowerCase()}`}
                              >
                                <Download className="h-3.5 w-3.5" />
                                DOWNLOAD CERTIFICATE
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="font-mono text-xs">
                              <DropdownMenuLabel>
                                Personalized for{" "}
                                <span className="text-foreground">{recipientName}</span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void handleDownload(b, "png")}
                                data-testid={`menu-${b.badgeId.toLowerCase()}-png`}
                              >
                                PNG — highest quality
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleDownload(b, "jpeg")}
                                data-testid={`menu-${b.badgeId.toLowerCase()}-jpeg`}
                              >
                                JPEG — easier to share
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleDownload(b, "svg")}
                                data-testid={`menu-${b.badgeId.toLowerCase()}-svg`}
                              >
                                SVG — vector, scales to any size
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <AiseClaimCard onClaimed={() => refetch()} aiseBadge={(data ?? []).find(b => b.badgeId === "AISE")} />
          </>
        )}
      </main>
    </div>
  );
}

function SeniorBadgesSection({
  badges,
  onChanged,
  recipientName,
  onDownload,
}: {
  badges: BadgeProgress[];
  onChanged: () => void;
  recipientName: string;
  onDownload: (
    badgeId: CertificateBadgeId,
    badgeFullName: string,
    description: string,
    thresholdNote: string,
    unlockedAt: string | null,
    format: BadgeFormat,
    extras?: { verifiedUrl?: string | null; evidenceExcerpt?: string | null },
  ) => Promise<void>;
}) {
  const architect = badges.find((b) => b.badgeId === "AISA_PWDD");
  const engineer = badges.find((b) => b.badgeId === "AISE_BUILD");

  const pwdds = (architect?.progress.pwdds as number | undefined) ?? 0;
  const pwddTarget = (architect?.requirements.pwdds as number | undefined) ?? 3;
  const architectEarned = !!architect && architect.eligible;

  const engineerClaimed = engineer?.status === "CLAIMED";
  const engineerRevoked = engineer?.status === "REVOKED";
  const engineerEvidence = (engineer?.evidence ?? {}) as {
    verifiedUrl?: string;
    evidenceNote?: string;
    sessionId?: string | null;
    verifiedAt?: string;
  };

  return (
    <Card className="mb-8 bg-white text-black border-2 border-black">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src={`${import.meta.env.BASE_URL}atanda-logo.png`}
                alt="ATANDA"
                className="h-8 w-auto"
              />
              <span className="inline-block px-2 py-0.5 rounded bg-black text-white font-mono text-[10px] tracking-widest">
                SENIOR · ADVANCED SYSTEMS
              </span>
            </div>
            <CardTitle className="font-display tracking-wider text-xl text-black">
              SENIOR OPERATOR BADGES
            </CardTitle>
            <CardDescription className="font-serif text-sm mt-1 text-black/70">
              Reputational tier reserved for operators who finish real
              projects at PWDD stage and ship live systems built from them.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Architect tile */}
          <div
            className={`relative p-5 rounded-md border-2 border-black bg-white text-black ${architectEarned ? "ring-2 ring-black" : "opacity-90"}`}
            data-testid="senior-badge-architect"
          >
            <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b-2 border-black">
              <img
                src={`${import.meta.env.BASE_URL}atanda-logo.png`}
                alt="ATANDA"
                className={`h-7 w-auto ${architectEarned ? "" : "grayscale opacity-60"}`}
              />
              <span
                className={`text-[10px] font-mono font-bold px-2 py-1 rounded border border-black ${
                  architectEarned ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {architectEarned ? "EARNED" : "IN PROGRESS"}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Hexagon className="h-8 w-8 text-black shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] tracking-widest text-black/70">
                  AAISA · PWDD
                </div>
                <div className="font-display tracking-wide text-lg leading-tight text-black">
                  Advanced Atomic Intelligent Systems Architect
                </div>
              </div>
            </div>
            <p className="font-serif text-xs text-black/70 mt-3">
              Auto-awarded the moment you reach 3 completed projects at
              PWDD stage (a session with a SPARTAN-certified MVP-PDD /
              PWDD artefact).
            </p>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-black/60 uppercase">PWDDs</span>
                <span
                  className={architectEarned ? "text-black font-bold" : "text-black/80"}
                  data-testid="text-architect-progress"
                >
                  {pwdds} / {pwddTarget}
                </span>
              </div>
              <div className="h-1.5 bg-black/10 rounded">
                <div
                  className={`h-full rounded transition-all ${architectEarned ? "bg-black" : "bg-black/40"}`}
                  style={{ width: `${Math.min(100, (pwdds / pwddTarget) * 100)}%` }}
                />
              </div>
            </div>
            {architectEarned && (
              <div className="mt-4 pt-3 border-t border-black/20">
                <SeniorDownloadMenu
                  recipientName={recipientName}
                  testIdPrefix="architect"
                  onPick={(format) =>
                    void onDownload(
                      "AISA_PWDD",
                      "Advanced Atomic Intelligent Systems Architect",
                      "Earned for shipping 3 SPARTAN-certified PWDD-stage projects.",
                      `${pwdds} of ${pwddTarget} PWDD-stage projects certified`,
                      architect?.unlockedAt ?? null,
                      format,
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* Engineer tile */}
          <div
            className={`relative p-5 rounded-md border-2 border-black bg-white text-black ${engineerClaimed ? "ring-2 ring-black" : "opacity-90"}`}
            data-testid="senior-badge-engineer"
          >
            <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b-2 border-black">
              <img
                src={`${import.meta.env.BASE_URL}atanda-logo.png`}
                alt="ATANDA"
                className={`h-7 w-auto ${engineerClaimed ? "" : "grayscale opacity-60"}`}
              />
              <span
                className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
                  engineerClaimed
                    ? "bg-black text-white border-black"
                    : engineerRevoked
                    ? "bg-destructive/15 text-destructive border-destructive/60"
                    : "bg-white text-black border-black"
                }`}
                data-testid="badge-engineer-status"
              >
                {engineerClaimed ? "CLAIMED" : engineerRevoked ? "REVOKED" : "EVIDENCE NEEDED"}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Hexagon className="h-8 w-8 text-black shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] tracking-widest text-black/70">
                  AAISE · BUILD
                </div>
                <div className="font-display tracking-wide text-lg leading-tight text-black">
                  Advanced Atomic Intelligent Systems Engineer
                </div>
              </div>
            </div>
            <p className="font-serif text-xs text-black/70 mt-3">
              Submit a public URL to a live AI agent or application you
              built from one of your PWDDs. The URL is checked through the
              same SSRF-hardened verifier as AISE.
            </p>
            {engineerRevoked && engineer && (
              <RevocationNotice
                badge={engineer}
                testIdPrefix="engineer"
                resubmitHint="Re-submit fresh evidence below to restore the badge."
              />
            )}
            {engineerClaimed && engineer && (
              <RestorationNotice badge={engineer} testIdPrefix="engineer" />
            )}
            <div className="mt-4">
              {engineerClaimed ? (
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-black/60">URL: </span>
                    <a
                      href={engineerEvidence.verifiedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-black underline break-all"
                      data-testid="link-engineer-verified-url"
                    >
                      {engineerEvidence.verifiedUrl}
                    </a>
                  </div>
                  {engineerEvidence.evidenceNote && (
                    <div className="font-serif text-black/90">
                      "{engineerEvidence.evidenceNote}"
                    </div>
                  )}
                  {engineerEvidence.verifiedAt && (
                    <div className="text-black/60">
                      Verified {new Date(engineerEvidence.verifiedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ) : (
                <EngineerClaimDialog onClaimed={onChanged} />
              )}
            </div>
            {engineerClaimed && (
              <div className="mt-4 pt-3 border-t border-black/20">
                <SeniorDownloadMenu
                  recipientName={recipientName}
                  testIdPrefix="engineer"
                  onPick={(format) =>
                    void onDownload(
                      "AISE_BUILD",
                      "Advanced Atomic Intelligent Systems Engineer",
                      "Awarded for shipping a verified live system built from a PWDD.",
                      "Verified live build",
                      engineerEvidence.verifiedAt ?? null,
                      format,
                      {
                        verifiedUrl: engineerEvidence.verifiedUrl ?? null,
                        evidenceExcerpt: engineerEvidence.evidenceNote ?? null,
                      },
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RestorationNotice({
  badge,
  testIdPrefix,
}: {
  badge: BadgeProgress;
  testIdPrefix: string;
}) {
  if (!badge.restoredAt) return null;
  const restoredAt = new Date(badge.restoredAt).toLocaleString();
  return (
    <div
      className="mt-4 p-3 rounded border border-emerald-500/60 bg-emerald-500/10 space-y-2"
      data-testid={`notice-${testIdPrefix}-restored`}
    >
      <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold tracking-wider">
        BADGE RESTORED BY ADMIN
      </div>
      <div className="text-[10px] font-mono text-muted-foreground">
        Restored {restoredAt}
      </div>
      {badge.restoredNote && (
        <div
          className="font-serif text-xs text-foreground/90 whitespace-pre-wrap"
          data-testid={`text-${testIdPrefix}-restore-note`}
        >
          "{badge.restoredNote}"
        </div>
      )}
      <div className="font-mono text-[11px] text-muted-foreground">
        The previous revocation has been cleared. Your badge is active again — the audit history is preserved.
      </div>
    </div>
  );
}

function RevocationNotice({
  badge,
  testIdPrefix,
  resubmitHint,
}: {
  badge: BadgeProgress;
  testIdPrefix: string;
  resubmitHint: string;
}) {
  const revokedAt = badge.revokedAt ? new Date(badge.revokedAt).toLocaleString() : null;
  const repeat = badge.revocationCount > 1;
  return (
    <div
      className="mt-4 p-3 rounded border border-destructive/60 bg-destructive/10 space-y-2"
      data-testid={`notice-${testIdPrefix}-revoked`}
    >
      <div className="flex items-center gap-2 text-destructive font-mono text-xs font-bold tracking-wider">
        <AlertTriangle className="h-4 w-4" />
        BADGE REVOKED BY ADMIN
        {repeat && (
          <span className="ml-auto text-[10px] uppercase opacity-80">
            ×{badge.revocationCount}
          </span>
        )}
      </div>
      {revokedAt && (
        <div className="text-[10px] font-mono text-muted-foreground">
          Revoked {revokedAt}
        </div>
      )}
      {badge.revokedReason && (
        <div
          className="font-serif text-xs text-foreground/90 whitespace-pre-wrap"
          data-testid={`text-${testIdPrefix}-revoke-reason`}
        >
          "{badge.revokedReason}"
        </div>
      )}
      <div className="font-mono text-[11px] text-muted-foreground">{resubmitHint}</div>
    </div>
  );
}

function SeniorDownloadMenu({
  recipientName,
  testIdPrefix,
  onPick,
}: {
  recipientName: string;
  testIdPrefix: string;
  onPick: (format: BadgeFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full font-mono text-xs gap-2 border-black text-black hover:bg-black hover:text-white"
          data-testid={`button-download-${testIdPrefix}`}
        >
          <Download className="h-3.5 w-3.5" />
          DOWNLOAD CERTIFICATE
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="font-mono text-xs">
        <DropdownMenuLabel>
          Senior · Personalized for{" "}
          <span className="text-foreground">{recipientName}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onPick("png")}
          data-testid={`menu-${testIdPrefix}-png`}
        >
          PNG — highest quality
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPick("jpeg")}
          data-testid={`menu-${testIdPrefix}-jpeg`}
        >
          JPEG — easier to share
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPick("svg")}
          data-testid={`menu-${testIdPrefix}-svg`}
        >
          SVG — vector, scales to any size
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EngineerClaimDialog({ onClaimed }: { onClaimed: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const mut = useClaimEngineerBadge();
  const { data: sessions } = useListSessions();

  async function submit() {
    setError(null);
    if (!url.trim()) {
      setError("URL is required.");
      return;
    }
    if (!evidenceNote.trim()) {
      setError("Evidence note is required.");
      return;
    }
    if (evidenceNote.length > 500) {
      setError("Evidence note must be 500 characters or fewer.");
      return;
    }
    try {
      const payload: { url: string; evidenceNote: string; sessionId?: string } = {
        url: url.trim(),
        evidenceNote: evidenceNote.trim(),
      };
      if (sessionId) payload.sessionId = sessionId;
      await mut.mutateAsync({ data: payload });
      setOpen(false);
      setUrl("");
      setEvidenceNote("");
      setSessionId("");
      onClaimed();
    } catch (e) {
      setError((e as Error).message ?? "Verification failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full font-mono text-xs border-black text-black hover:bg-black hover:text-white"
          data-testid="button-engineer-submit-evidence"
        >
          SUBMIT EVIDENCE
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            Advanced Atomic Intelligent Systems Engineer
          </DialogTitle>
          <DialogDescription className="font-serif text-sm">
            Submit a live HTTPS URL for the AI agent or application you
            built from one of your PWDDs, plus a short evidence note (≤ 500
            chars) so reviewers can see what was shipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="font-mono text-xs">LIVE URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-shipped-system.example.com"
              className="font-mono text-xs"
              data-testid="input-engineer-url"
            />
          </div>
          <div>
            <Label className="font-mono text-xs">
              EVIDENCE NOTE ({evidenceNote.length} / 500)
            </Label>
            <Textarea
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              placeholder="Describe what was built, which PWDD it came from, and what it does for users."
              className="font-serif text-sm min-h-24"
              maxLength={500}
              data-testid="textarea-engineer-evidence"
            />
          </div>
          <div>
            <Label className="font-mono text-xs">
              SOURCE PWDD SESSION (OPTIONAL)
            </Label>
            <Select
              value={sessionId || "none"}
              onValueChange={(v) => setSessionId(v === "none" ? "" : v)}
            >
              <SelectTrigger
                className="font-mono text-xs"
                data-testid="select-engineer-session"
              >
                <SelectValue placeholder="Select a session…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {(sessions ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sessionName || s.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div
              className="text-destructive font-mono text-xs"
              data-testid="text-engineer-error"
            >
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={mut.isPending}
            className="font-display tracking-wider"
            data-testid="button-engineer-submit"
          >
            {mut.isPending ? "VERIFYING…" : "VERIFY & CLAIM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiseClaimCard({
  onClaimed,
  aiseBadge,
}: {
  onClaimed: () => void;
  aiseBadge: BadgeProgress | undefined;
}) {
  const [spcDnaAgentUrl, setSpcDna] = useState("");
  const [gptUrl, setGpt] = useState("");
  const [copilotUrl, setCopilot] = useState("");
  const [nativeAppUrl, setNative] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mut = useClaimAiseBadge();

  async function submit() {
    setError(null);
    const data: Record<string, string> = {};
    if (spcDnaAgentUrl) data.spcDnaAgentUrl = spcDnaAgentUrl;
    if (gptUrl) data.gptUrl = gptUrl;
    if (copilotUrl) data.copilotUrl = copilotUrl;
    if (nativeAppUrl) data.nativeAppUrl = nativeAppUrl;
    if (notes) data.notes = notes;
    if (Object.keys(data).length === 0 || (Object.keys(data).length === 1 && data.notes)) {
      setError("Provide at least one URL.");
      return;
    }
    try {
      await mut.mutateAsync({ data });
      onClaimed();
    } catch (e) {
      setError((e as Error).message ?? "Claim failed.");
    }
  }

  const verified = (aiseBadge?.evidence as { verified?: unknown[] } | undefined)?.verified ?? [];
  const aiseRevoked = aiseBadge?.status === "REVOKED";

  return (
    <Card className={`bg-card border-l-4 ${aiseRevoked ? "border-l-destructive/60" : "border-l-primary/50"}`}>
      <CardHeader>
        <CardTitle className="font-display tracking-wide text-xl">
          {aiseRevoked ? "APPEAL AISE" : "CLAIM AISE"}
        </CardTitle>
        <CardDescription className="text-xs font-mono">
          {aiseRevoked
            ? "Your AISE badge was revoked by an admin. Submit fresh evidence below to restore it."
            : "Submit any combination of URLs. Each is checked against the AISE allowlist and verified reachable."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aiseRevoked && aiseBadge && (
          <RevocationNotice
            badge={aiseBadge}
            testIdPrefix="aise"
            resubmitHint="A successful re-submission immediately clears the revoked state."
          />
        )}
        {aiseBadge?.status === "CLAIMED" && (
          <RestorationNotice badge={aiseBadge} testIdPrefix="aise" />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-mono text-xs">CUSTOM GPT (chatgpt.com/g/…)</Label>
            <Input value={gptUrl} onChange={(e) => setGpt(e.target.value)} placeholder="https://chatgpt.com/g/g-..." className="font-mono text-xs" />
          </div>
          <div>
            <Label className="font-mono text-xs">COPILOT</Label>
            <Input value={copilotUrl} onChange={(e) => setCopilot(e.target.value)} placeholder="https://copilot.microsoft.com/..." className="font-mono text-xs" />
          </div>
          <div>
            <Label className="font-mono text-xs">NATIVE APP (App Store / Play / Chrome)</Label>
            <Input value={nativeAppUrl} onChange={(e) => setNative(e.target.value)} placeholder="https://apps.apple.com/..." className="font-mono text-xs" />
          </div>
          <div>
            <Label className="font-mono text-xs">SPC-DNA AGENT</Label>
            <Input value={spcDnaAgentUrl} onChange={(e) => setSpcDna(e.target.value)} placeholder="https://your-agent.example.com" className="font-mono text-xs" />
          </div>
        </div>
        <div>
          <Label className="font-mono text-xs">NOTES (OPTIONAL)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief description of how SPC DNA was used" className="font-mono text-xs" />
        </div>
        {error && <div className="text-destructive font-mono text-xs">{error}</div>}
        <div className="flex justify-between items-center">
          <div className="text-xs font-mono text-muted-foreground">
            {verified.length > 0 && `${verified.length} verified URL${verified.length === 1 ? "" : "s"} on record`}
          </div>
          <Button onClick={submit} disabled={mut.isPending} className="font-display tracking-wider">
            {mut.isPending ? "VERIFYING..." : "SUBMIT CLAIM"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
