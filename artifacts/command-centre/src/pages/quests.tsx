import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { useListMyBadges, useClaimAiseBadge } from "@workspace/api-client-react";
import type { BadgeProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, CheckCircle2, Lock, ShieldCheck, Trophy } from "lucide-react";

const BADGE_META: Record<string, { name: string; description: string; reqText: string; icon: typeof Trophy }> = {
  ASPE: {
    name: "ASPE",
    description: "Adaptive SPC Practitioner — unlocks DE-SPC auto-evolution.",
    reqText: "Create at least 3 SPCs AND at least 4 Molecular Agent Birth Packages.",
    icon: ShieldCheck,
  },
  AISA: {
    name: "AISA",
    description: "AI Solution Architect — full ATLAS PDD lifecycle completion.",
    reqText: "Create at least 1 ATLAS PDD, 1 Micro PDD, and 1 MVP PDD.",
    icon: Award,
  },
  AISE: {
    name: "AISE",
    description: "AI Solution Engineer — shipped AI agents built with SPC DNA.",
    reqText: "Submit a verified URL to a working GPT, CoPilot, native app, or custom SPC-DNA agent.",
    icon: Trophy,
  },
};

export default function Quests() {
  const { data, isLoading, refetch } = useListMyBadges();
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
                return (
                  <Card key={b.badgeId} className={`bg-card ${locked ? "opacity-60" : ""}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`h-8 w-8 ${locked ? "text-muted-foreground" : "text-primary"}`} />
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
                          b.status === "CLAIMED" ? "bg-primary/20 text-primary border-primary/40" :
                          b.status === "UNLOCKED" ? "bg-secondary/20 text-secondary border-secondary/40" :
                          "bg-muted text-muted-foreground border-muted-foreground/20"
                        }`}>
                          {b.status === "CLAIMED" && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                          {b.status === "LOCKED" && <Lock className="h-3 w-3 inline mr-1" />}
                          {b.status}
                        </span>
                      </div>
                      <CardTitle className="font-display tracking-wide text-2xl">{meta.name}</CardTitle>
                      <CardDescription className="text-xs">{meta.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                <span className={met ? "text-primary font-bold" : "text-foreground"}>{cur} / {req}</span>
                              </div>
                              <div className="h-1 bg-muted rounded">
                                <div className={`h-full rounded transition-all ${met ? "bg-primary" : "bg-secondary"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
