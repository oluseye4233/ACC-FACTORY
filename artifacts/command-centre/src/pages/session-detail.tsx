import { useState } from "react";
import { useParams, Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { 
  useGetSession, 
  useListFeatureState, 
  useListSessionArtifacts,
  FeatureStatus
} from "@workspace/api-client-react";
import { ENGINES } from "@/lib/constants";
import { FeatureNavItem } from "@/components/shared/FeatureNavItem";
import { ArtifactTray } from "@/components/shared/ArtifactTray";
import { EscalationModal } from "@/components/shared/EscalationModal";
import { GRODot } from "@/components/shared/GRODot";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Terminal, AlertTriangle } from "lucide-react";

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: sessionData, isLoading: isLoadingSession, isError } = useGetSession(id || "");
  const { data: featureStates, isLoading: isLoadingFeatures } = useListFeatureState(id || "");
  const { data: artifacts, isLoading: isLoadingArtifacts } = useListSessionArtifacts(id || "");
  
  const [activeEngineId, setActiveEngineId] = useState<number>(1);

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopNav />
      
      {/* Session Header / Breadcrumb */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/command" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-border"></div>
          
          {isLoadingSession ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-primary truncate max-w-[200px] md:max-w-md">
                {session?.sessionName}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                {session?.id.substring(0, 8)}
              </span>
              {session?.status === 'COMPLETE' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                  COMPLETE
                </span>
              )}
            </div>
          )}
        </div>
        
        <div>
          {id && <EscalationModal sessionId={id} />}
        </div>
      </header>
      
      {/* 3-Column Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Navigation */}
        <div className="w-[280px] border-r bg-card/50 flex flex-col shrink-0 hidden md:flex">
          <div className="p-4 border-b">
            <h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
              HARNESS SEQUENCE
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingFeatures ? (
              Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-1" />)
            ) : (
              ENGINES.map((engine) => (
                <FeatureNavItem
                  key={engine.id}
                  {...engine}
                  status={getFeatureStatus(engine.id)}
                  isActive={activeEngineId === engine.id}
                  onClick={() => {
                    // Only allow clicking if not locked
                    if (getFeatureStatus(engine.id) !== FeatureStatus.LOCKED) {
                      setActiveEngineId(engine.id);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Center Column: Workspace */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
          
          <div className="p-4 md:p-8 flex-1 flex flex-col relative z-10">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-4xl tracking-wider text-foreground">
                  {activeEngine.title}
                </h1>
                <GRODot state="GREY" className="mt-1" />
              </div>
              <p className="text-muted-foreground font-mono text-sm max-w-2xl">
                {activeEngine.description}
              </p>
            </div>
            
            {/* STAGE 3 PLACEHOLDER */}
            <div className="flex-1 border border-border/50 bg-card/30 backdrop-blur rounded-lg flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              
              <Terminal className="h-16 w-16 text-muted-foreground/30 mb-6" />
              
              <div className="space-y-4 max-w-md relative z-10">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary">
                  STAGE 3 — WORKSPACE PENDING
                </div>
                
                <h3 className="font-display text-2xl text-foreground">
                  {activeEngine.name} INTERFACE OFFLINE
                </h3>
                
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  The internal mechanics for {activeEngine.title} are scheduled for Stage 3 deployment. 
                  This surface will house the functional workspace for the engine.
                </p>
              </div>
              
              <div className="absolute bottom-4 left-4 text-[10px] font-mono text-muted-foreground/50">
                SYS.MODULE_{activeEngine.name}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column: Artifacts */}
        <div className="w-[300px] border-l bg-card/50 flex flex-col shrink-0 hidden lg:flex">
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
