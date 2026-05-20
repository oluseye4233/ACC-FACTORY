import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  useListMyBadges,
  useClaimAiseBadge,
  useGetMe,
  useListMyContextCraftBadges,
} from "@workspace/api-client-react";
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
import { Award, CheckCircle2, Download, Lock, ShieldCheck, Trophy } from "lucide-react";
import badgeBg from "@assets/copilot_image_1779143975171_1779147194124.jpeg";
import {
  downloadBadgeCertificate,
  type BadgeFormat,
} from "@/lib/badge-certificate";

const BADGE_META: Record<string, { name: string; fullName: string; description: string; reqText: string; icon: typeof Trophy }> = {
  ASPE: {
    name: "ASPE",
    fullName: "ADAPTIVE SPC PRACTITIONER",
    description: "Adaptive SPC Practitioner — unlocks DE-SPC auto-evolution.",
    reqText: "Create at least 3 SPCs AND at least 4 Micro Agent (MA) Birth Packages.",
    icon: ShieldCheck,
  },
  AISA: {
    name: "AISA",
    fullName: "AI SOLUTION ARCHITECT",
    description: "AI Solution Architect — full ATLAS PDD lifecycle completion.",
    reqText: "Create at least 1 ATLAS PDD, 1 Micro PDD, and 1 MVP PDD.",
    icon: Award,
  },
  AISE: {
    name: "AISE",
    fullName: "AI SOLUTION ENGINEER",
    description: "AI Solution Engineer — shipped AI agents built with SPC DNA.",
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {(data ?? []).map((b) => {
                const meta = BADGE_META[b.badgeId]!;
                const Icon = meta.icon;
                const locked = b.status === "LOCKED";
                const claimed = b.status === "CLAIMED";
                return (
                  <Card
                    key={b.badgeId}
                    className={`bg-card overflow-hidden flex flex-col ${
                      claimed ? "ring-2 ring-primary/60 shadow-lg shadow-primary/20" : ""
                    }`}
                  >
                    {/* Hero badge crest */}
                    <div className="relative aspect-square w-full overflow-hidden border-b">
                      <img
                        src={badgeBg}
                        alt={`${meta.name} badge`}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
                          locked ? "grayscale brightness-50" : "saturate-150"
                        }`}
                      />
                      {/* Vignette */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
                      {/* Status chip */}
                      <span
                        className={`absolute top-3 right-3 text-[10px] font-mono font-bold px-2 py-1 rounded border backdrop-blur-sm ${
                          claimed
                            ? "bg-primary/30 text-primary-foreground border-primary/60"
                            : b.status === "UNLOCKED"
                            ? "bg-secondary/30 text-secondary-foreground border-secondary/60"
                            : "bg-background/60 text-muted-foreground border-muted-foreground/30"
                        }`}
                      >
                        {claimed && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                        {locked && <Lock className="h-3 w-3 inline mr-1" />}
                        {b.status}
                      </span>
                      {/* Icon corner */}
                      <Icon
                        className={`absolute top-3 left-3 h-7 w-7 drop-shadow-lg ${
                          locked ? "text-muted-foreground/70" : "text-yellow-300"
                        }`}
                      />
                      {/* Centerpiece label */}
                      <div className="absolute inset-x-0 bottom-3 text-center">
                        <div
                          className={`font-display text-4xl tracking-[0.2em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${
                            locked ? "text-muted-foreground" : "text-yellow-200"
                          }`}
                        >
                          {meta.name}
                        </div>
                        <div className="font-mono text-[9px] tracking-widest text-muted-foreground mt-0.5">
                          {meta.fullName}
                        </div>
                      </div>
                      {/* Lock overlay for locked badges */}
                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="h-16 w-16 text-background/80 drop-shadow-lg" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">{meta.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="text-xs font-mono text-muted-foreground mb-3">{meta.reqText}</div>
                      <div className="space-y-1.5">
                        {Object.entries(b.requirements).map(([k, req]) => {
                          const cur = (b.progress[k] as number | undefined) ?? 0;
                          const pct = Math.min(100, (cur / req) * 100);
                          const met = cur >= req;
                          return (
                            <div key={k}>
                              <div className="flex justify-between text-[10px] font-mono mb-0.5">
                                <span className="text-muted-foreground uppercase">{k}</span>
                                <span className={met ? "text-primary font-bold" : "text-foreground"}>
                                  {cur} / {req}
                                </span>
                              </div>
                              <div className="h-1 bg-muted rounded">
                                <div
                                  className={`h-full rounded transition-all ${met ? "bg-primary" : "bg-secondary"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!locked && (
                        <div className="mt-4 pt-3 border-t border-border/60">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full font-mono text-xs gap-2"
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

  return (
    <Card className="bg-card border-l-4 border-l-primary/50">
      <CardHeader>
        <CardTitle className="font-display tracking-wide text-xl">CLAIM AISE</CardTitle>
        <CardDescription className="text-xs font-mono">
          Submit any combination of URLs. Each is checked against the AISE allowlist and verified reachable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
