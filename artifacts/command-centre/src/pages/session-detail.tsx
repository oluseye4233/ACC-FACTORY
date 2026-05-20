import { useState } from "react";
import { useParams, Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { 
  useGetSession, 
  useListFeatureState, 
  useListSessionArtifacts,
  useGetSessionIngestion,
  FeatureStatus
} from "@workspace/api-client-react";
import { ENGINES } from "@/lib/constants";
import { IngestionBanner } from "@/components/shared/IngestionBanner";
import { FeatureNavItem } from "@/components/shared/FeatureNavItem";
import { ArtifactTray } from "@/components/shared/ArtifactTray";
import { EscalationModal } from "@/components/shared/EscalationModal";
import { GRODot } from "@/components/shared/GRODot";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, ListOrdered, Package } from "lucide-react";
import { F1TestPrompt } from "@/components/workspaces/F1TestPrompt";
import { F2BuildAtomic } from "@/components/workspaces/F2BuildAtomic";
import { F3BuildMa } from "@/components/workspaces/F3BuildMa";
import { F4MicroPdd } from "@/components/workspaces/F4MicroPdd";
import { F5BuildSpc } from "@/components/workspaces/F5BuildSpc";
import { F6DraftPdd } from "@/components/workspaces/F6DraftPdd";
import { F7ConvertMvp } from "@/components/workspaces/F7ConvertMvp";

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: sessionData, isLoading: isLoadingSession, isError } = useGetSession(id || "");
  const { data: featureStates, isLoading: isLoadingFeatures } = useListFeatureState(id || "");
  const { data: artifacts, isLoading: isLoadingArtifacts } = useListSessionArtifacts(id || "");
  const isIngested = sessionData?.session?.origin === "ingested";
  const { data: ingestion } = useGetSessionIngestion(id || "", {
    query: { enabled: Boolean(id) && isIngested } as never,
  } as never);
  
  const [activeEngineId, setActiveEngineId] = useState<number>(1);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav />
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h1 className="font-display text-3xl mb-2">SESSION NOT FOUND</h1>
          <p className="text-muted-foreground font-mono mb-6">The requested session ID could not be located or you lack authorization.</p>
          <Link href="/command" className="text-primary hover:underline font-mono">
            RETURN TO COMMAND
          </Link>
        </main>
      </div>
    );
  }

  const session = sessionData?.session;
  const activeEngine = ENGINES.find(e => e.id === activeEngineId) || ENGINES[0];
  
  const getFeatureStatus = (engineId: number) => {
    const state = featureStates?.find(fs => fs.featureId === engineId);
    return state?.status || FeatureStatus.LOCKED;
  };

  const renderSequenceList = (onPick?: () => void) =>
    isLoadingFeatures ? (
      Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-1" />)
    ) : (
      ENGINES.map((engine) => (
        <FeatureNavItem
          key={engine.id}
          {...engine}
          status={getFeatureStatus(engine.id)}
          isActive={activeEngineId === engine.id}
          onClick={() => {
            if (getFeatureStatus(engine.id) !== FeatureStatus.LOCKED) {
              setActiveEngineId(engine.id);
              onPick?.();
            }
          }}
        />
      ))
    );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />

      {/* Session Header / Breadcrumb */}
      <header className="border-b bg-card flex items-center justify-between gap-2 px-3 md:px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link
            href="/command"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Back to command"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="hidden md:block h-4 w-px bg-border"></div>

          {isLoadingSession ? (
            <Skeleton className="h-5 w-32 md:w-48" />
          ) : (
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <span className="font-mono text-xs md:text-sm font-bold text-primary truncate max-w-[140px] sm:max-w-[220px] md:max-w-md">
                {session?.sessionName}
              </span>
              <span className="hidden sm:inline text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                {session?.id.substring(0, 8)}
              </span>
              {session?.status === 'COMPLETE' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                  COMPLETE
                </span>
              )}
              {isIngested && (
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/30"
                  title="This session was seeded from an ingested document. Its final artefact is a PWDD."
                >
                  INGESTED · PWDD
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mobile-only: open Harness Sequence */}
          <Sheet open={sequenceOpen} onOpenChange={setSequenceOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="md:hidden h-8 px-2 font-mono text-[10px] gap-1"
                aria-label="Open harness sequence"
                data-testid="button-mobile-sequence"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                F{activeEngineId}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">
                  HARNESS SEQUENCE
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {renderSequenceList(() => setSequenceOpen(false))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile/Tablet-only: open Artifact Tray */}
          <Sheet open={trayOpen} onOpenChange={setTrayOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden h-8 px-2 font-mono text-[10px] gap-1"
                aria-label="Open artifact tray"
                data-testid="button-mobile-tray"
              >
                <Package className="h-3.5 w-3.5" />
                {artifacts?.length ?? 0}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
                <SheetTitle className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">
                  ARTIFACT TRAY
                </SheetTitle>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {artifacts?.length || 0} TOTAL
                </span>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingArtifacts ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : (
                  <ArtifactTray artifacts={artifacts || []} />
                )}
              </div>
            </SheetContent>
          </Sheet>

          {id && <EscalationModal sessionId={id} />}
        </div>
      </header>
      
      {/* 3-Column Layout (collapses to single column on mobile via sheets in header) */}
      <main className="flex-1 flex">

        {/* Left Column: Navigation (desktop only) */}
        <div className="w-[280px] border-r bg-card/50 flex-col shrink-0 hidden md:flex">
          <div className="p-4 border-b">
            <h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
              HARNESS SEQUENCE
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {renderSequenceList()}
          </div>
        </div>

        {/* Center Column: Workspace */}
        <div className="flex-1 flex flex-col bg-background relative min-w-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="p-4 md:p-8 flex-1 flex flex-col relative z-10">
            <div className="mb-6 md:mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-wider text-foreground">
                  {activeEngine.title}
                </h1>
                <GRODot state="GREY" className="mt-1" />
              </div>
              <p className="text-muted-foreground font-mono text-xs md:text-sm max-w-2xl">
                {activeEngine.description}
              </p>
            </div>
            
            {isIngested && ingestion && (
              <IngestionBanner ingestion={ingestion} isF7={activeEngineId === 7} />
            )}

            {/* STAGE 3 WORKSPACES */}
            {id && (
              <>
                {activeEngineId === 1 && <F1TestPrompt sessionId={id} />}
                {activeEngineId === 2 && <F2BuildAtomic sessionId={id} artifacts={artifacts || []} />}
                {activeEngineId === 3 && <F3BuildMa sessionId={id} artifacts={artifacts || []} />}
                {activeEngineId === 4 && <F4MicroPdd sessionId={id} artifacts={artifacts || []} />}
                {activeEngineId === 5 && <F5BuildSpc sessionId={id} />}
                {activeEngineId === 6 && <F6DraftPdd sessionId={id} artifacts={artifacts || []} />}
                {activeEngineId === 7 && <F7ConvertMvp sessionId={id} artifacts={artifacts || []} />}
              </>
            )}
          </div>
        </div>
        
        {/* Right Column: Artifacts (large screens only) */}
        <div className="w-[300px] border-l bg-card/50 flex-col shrink-0 hidden lg:flex">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
              ARTIFACT TRAY
            </h2>
            <div className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {artifacts?.length || 0} TOTAL
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingArtifacts ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : (
              <ArtifactTray artifacts={artifacts || []} />
            )}
          </div>
        </div>
        
      </main>
    </div>
  );
}
