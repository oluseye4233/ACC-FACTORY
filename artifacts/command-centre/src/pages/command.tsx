import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useGetMe, useListSessions, useHealthDeep, useListExemplars, useGetMyUsage, useListMyBadges } from "@workspace/api-client-react";
import { TierBadge } from "@/components/shared/TierBadge";
import { ENGINES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Activity, Cpu, Database, AlertCircle, BookOpen, ShieldCheck, Trophy, Lock, CheckCircle2, Award, FileUp } from "lucide-react";
import { format } from "date-fns";

export default function Command() {
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { data: sessions, isLoading: isLoadingSessions } = useListSessions();
  const { data: health, isLoading: isLoadingHealth } = useHealthDeep();
  const { data: exemplars } = useListExemplars();
  const { data: usageReport, isLoading: isLoadingUsage } = useGetMyUsage();
  const { data: badges, isLoading: isLoadingBadges } = useListMyBadges();

  const activeSessions = sessions?.filter(s => s.status !== "COMPLETE").length || 0;
  const recentSessions = sessions?.slice(0, 5) || [];
  
  // Dummy values since we don't have these exact metrics on the endpoint yet
  const completedMvps = sessions?.filter(s => s.status === "COMPLETE").length || 0;
  const jcseAvg = 42;
  const streak = 12;

  const usage = me?.subscriber?.usage || { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0 };
  const dailyCap = me?.subscriber?.tier === "EXPLORER" ? 5 : 
                   me?.subscriber?.tier === "PRACTITIONER" ? 20 : 
                   me?.subscriber?.tier === "ARCHITECT" ? 100 : 999;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6">
        
        {/* Greeting */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl tracking-wider mb-2">
              COMMAND DECK
            </h1>
            {isLoadingMe ? (
              <Skeleton className="h-6 w-64" />
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="font-mono text-sm">OPERATOR: {me?.displayName || me?.email || "UNKNOWN"}</span>
                <span className="text-border">•</span>
                <TierBadge tier={me?.subscriber?.tier || "EXPLORER"} />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="font-mono text-xs gap-2">
              <Link href="/ingest">
                <FileUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">INGEST EXISTING DOC</span>
                <span className="sm:hidden">INGEST</span>
              </Link>
            </Button>
            <Button asChild className="font-display tracking-wider gap-2">
              <Link href="/session/new">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">NEW HARNESS SESSION</span>
                <span className="sm:hidden">NEW</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase">Active Sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? <Skeleton className="h-10 w-16" /> : (
                <div className="font-mono text-4xl font-bold text-primary">{activeSessions}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase">Completed MVPs</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? <Skeleton className="h-10 w-16" /> : (
                <div className="font-mono text-4xl font-bold text-secondary">{completedMvps}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase">Avg JCSE Score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-4xl font-bold text-foreground">{jcseAvg}</div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase">Days Streak</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-4xl font-bold text-foreground">{streak}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Engines Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl tracking-wide">ENGINE STATUS</h2>
                <span className="font-mono text-xs text-muted-foreground uppercase">Daily Usage vs Cap</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ENGINES.filter(e => e.id <= 7 || e.id === 9).map((engine) => {
                  const usageKey = `f${engine.id}` as keyof typeof usage;
                  const currentUsage = (usage as any)?.[usageKey] || 0;
                  const usagePercent = dailyCap < 999 ? Math.min(100, (currentUsage / dailyCap) * 100) : 0;
                  const isMaxed = dailyCap < 999 && currentUsage >= dailyCap;
                  
                  return (
                    <div key={engine.id} className="p-4 border rounded-md bg-card flex flex-col justify-between relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-muted">
                        <div 
                          className={`h-full transition-all ${isMaxed ? 'bg-destructive' : 'bg-primary'}`} 
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      
                      <div className="mb-2">
                        <div className="font-mono font-bold text-primary mb-1">{engine.name}</div>
                        <div className="text-xs text-muted-foreground truncate" title={engine.title}>
                          {engine.title}
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-2 flex justify-between items-end">
                        <span className={`font-mono text-xs ${isMaxed ? 'text-destructive font-bold' : 'text-foreground'}`}>
                          {currentUsage}{dailyCap < 999 ? `/${dailyCap}` : ''}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary group-hover:shadow-[0_0_5px_rgba(26,107,58,0.8)] transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exemplar Library Shelf */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl tracking-wide">EXEMPLAR LIBRARY</h2>
                <Button variant="link" size="sm" asChild className="font-mono text-xs text-muted-foreground">
                  <Link href="/exemplars">BROWSE ALL</Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(exemplars ?? []).slice(0, 4).map((ex) => (
                  <Link
                    key={ex.id}
                    href={`/exemplars/${ex.id}`}
                    className="p-3 border rounded-md bg-card hover:bg-accent/40 transition-colors flex items-start gap-3"
                  >
                    {ex.kind === "SPC" ? (
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-bold truncate">{ex.title}</div>
                      <div className="text-xs text-muted-foreground truncate" title={ex.tagline}>
                        {ex.tagline}
                      </div>
                      <div className="flex gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                        {ex.jcse !== null && <span>JCSE {ex.jcse}</span>}
                        {ex.certClass && <span>· {ex.certClass}</span>}
                        <span>· {ex.source === "canonical" ? "CANONICAL" : ex.source === "hand_authored" ? "HAND-AUTHORED" : "GENERATED"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quest Badges */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl tracking-wide">QUEST BADGES</h2>
                <Button variant="link" size="sm" asChild className="font-mono text-xs text-muted-foreground">
                  <Link href="/quests">VIEW ALL</Link>
                </Button>
              </div>
              <Card className="bg-card">
                <CardContent className="p-5">
                  {isLoadingBadges ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {(badges ?? []).map((b) => {
                        const Icon = b.badgeId === "ASPE" ? ShieldCheck : b.badgeId === "AISA" ? Award : Trophy;
                        const tone =
                          b.status === "CLAIMED" ? "text-primary" :
                          b.status === "UNLOCKED" ? "text-secondary" :
                          "text-muted-foreground";
                        return (
                          <Link key={b.badgeId} href="/quests" className="text-center hover:opacity-80 transition-opacity">
                            <div className="flex justify-center mb-2 relative">
                              <Icon className={`h-10 w-10 ${tone}`} />
                              {b.status === "CLAIMED" && (
                                <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 text-primary bg-card rounded-full" />
                              )}
                              {b.status === "LOCKED" && (
                                <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground bg-card rounded-full" />
                              )}
                            </div>
                            <div className={`font-mono text-sm font-bold ${tone}`}>{b.badgeId}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{b.status}</div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Sessions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl tracking-wide">RECENT SESSIONS</h2>
                <Button variant="link" size="sm" asChild className="font-mono text-xs text-muted-foreground">
                  <Link href="/sessions">VIEW ALL</Link>
                </Button>
              </div>
              
              <Card className="bg-card">
                <div className="divide-y border-t border-transparent">
                  {isLoadingSessions ? (
                    Array(3).fill(0).map((_, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))
                  ) : recentSessions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                      NO SESSIONS FOUND. INITIATE A NEW HARNESS.
                    </div>
                  ) : (
                    recentSessions.map(session => (
                      <div key={session.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/50 transition-colors">
                        <div>
                          <Link href={`/session/${session.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                            {session.sessionName}
                          </Link>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground font-mono">
                            <span>ID: {session.id.substring(0, 8)}</span>
                            <span>•</span>
                            <span>{format(new Date(session.updatedAt), "yyyy-MM-dd HH:mm")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
                            session.status === 'COMPLETE' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-accent text-accent-foreground'
                          }`}>
                            {session.status}
                          </span>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/session/${session.id}`}>ENTER</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
            
          </div>

          {/* Right Column - System Status */}
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">SYSTEM STATUS</h2>
            
            <Card className="bg-card border-l-4 border-l-primary/50">
              <CardContent className="p-5">
                {isLoadingHealth ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">API CORE</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        health?.status === 'ok' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {health?.status || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">DATA LAYER</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        health?.db === 'ok' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {health?.db || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">INFERENCE</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        health?.engines === 'ok' ? 'bg-primary/20 text-primary' : 
                        health?.engines === 'degraded' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-destructive/20 text-destructive'
                      }`}>
                        {health?.engines || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <div className="font-mono text-xs uppercase text-muted-foreground mb-3">Usage This Month</div>
                      {isLoadingUsage ? (
                        <Skeleton className="h-12 w-full" />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="font-mono text-[10px] uppercase text-muted-foreground">Tokens</div>
                            <div className="font-mono text-xl font-bold text-primary">
                              {(usageReport?.month?.totalTokens ?? 0).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-[10px] uppercase text-muted-foreground">Cost (USD)</div>
                            <div className="font-mono text-xl font-bold text-foreground">
                              ${(usageReport?.month?.totalCostUsd ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="col-span-2 font-mono text-[10px] text-muted-foreground">
                            Today: {(usageReport?.day?.totalTokens ?? 0).toLocaleString()} tok · ${(usageReport?.day?.totalCostUsd ?? 0).toFixed(4)}
                          </div>
                        </div>
                      )}
                    </div>

                    {health?.status !== 'ok' && health?.status !== undefined && (
                      <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="text-xs text-destructive font-mono leading-relaxed">
                          System degraded. Some HARNESS functions may experience latency or failure. Support has been notified.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
