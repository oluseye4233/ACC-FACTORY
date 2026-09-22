import { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ENGINES } from "@/lib/constants";
import { FeatureStatus, HarnessArtifact } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, Upload, Package, Info, Download } from "lucide-react";
import { ArtifactTray } from "@/components/shared/ArtifactTray";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface CockpitShellProps {
  sessionId: string;
  activeEngineId: number;
  getFeatureStatus: (id: number) => FeatureStatus;
  artifacts: HarnessArtifact[];
  onNavigate: (id: number) => void;
  children: ReactNode;
}

export function CockpitShell({
  sessionId,
  activeEngineId,
  getFeatureStatus,
  artifacts,
  onNavigate,
  children,
}: CockpitShellProps) {
  const activeEngine = ENGINES.find((e) => e.id === activeEngineId);
  
  // linear track 1-7
  const prevEngineId = activeEngineId > 1 && activeEngineId <= 7 ? activeEngineId - 1 : null;
  const prevEngine = prevEngineId ? ENGINES.find((e) => e.id === prevEngineId) : null;
  
  const nextEngineId = activeEngineId >= 1 && activeEngineId < 7 ? activeEngineId + 1 : null;
  const nextEngine = nextEngineId ? ENGINES.find((e) => e.id === nextEngineId) : null;
  const attentionEngineId = ENGINES
    .filter((engine) => engine.id <= 7)
    .find((engine) => getFeatureStatus(engine.id) === FeatureStatus.AVAILABLE)?.id;

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-background cockpit-shell"
      data-session-id={sessionId}
    >
      <div className="flex items-center justify-between gap-4 border-b bg-card px-3 py-2 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}atanda-mark.png`}
            alt=""
            className="h-7 w-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              ATOMIC UI
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              One stage. One clear action. The engine stays under the hood.
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-primary sm:block">
          Stage cockpit
        </span>
      </div>

      {/* Top Progress Bar */}
      <div
        className="flex items-center gap-1.5 p-2 overflow-x-auto border-b bg-card scrollbar-hide"
        aria-label="ATOMIC UI stage progress"
      >
        {ENGINES.map((engine, idx) => {
          const status = getFeatureStatus(engine.id);
          const isActive = engine.id === activeEngineId;
          const isLocked = status === FeatureStatus.LOCKED;
          
          return (
            <div key={engine.id} className="flex items-center">
              <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                  <button
                    disabled={isLocked}
                    onClick={() => !isLocked && onNavigate(engine.id)}
                     data-testid={`feature-nav-${engine.name.toLowerCase()}`}
                     data-next={
                       engine.id === attentionEngineId && !isActive && !isLocked
                         ? "true"
                         : undefined
                     }
                    className={`
                      flex items-center justify-center h-8 px-3 rounded text-[11px] font-mono whitespace-nowrap transition-all duration-200 border
                      ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : ''}
                      ${!isActive && !isLocked ? 'bg-background hover:bg-muted border-border/60 text-foreground' : ''}
                      ${isLocked ? 'opacity-40 cursor-not-allowed bg-muted/30 border-transparent text-muted-foreground' : ''}
                    `}
                  >
                    <span className="font-bold mr-1">{engine.name}</span>
                    <span className="hidden lg:inline opacity-80 truncate max-w-[120px]">{engine.title}</span>
                  </button>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start" className="w-64 p-3 bg-card/95 backdrop-blur-md border-border/50 shadow-xl">
                   <p className="text-xs font-mono font-bold text-primary mb-1">{engine.name} · {engine.title}</p>
                   <p className="text-[11px] text-muted-foreground leading-relaxed">{engine.description}</p>
                </HoverCardContent>
              </HoverCard>
              {idx < ENGINES.length - 1 && (
                <div className="w-3 h-px bg-border/40 mx-1 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Left Column: Where you came from */}
        <div className="w-[280px] hidden md:flex flex-col border-r bg-card/30 shrink-0 p-4 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] text-foreground">1</div>
              Where you came from
            </h3>
            {prevEngine ? (
              <div className="bg-background rounded-lg border border-border/60 p-4 shadow-sm hover:border-border transition-colors">
                <span className="text-xs font-mono font-bold text-primary block mb-1.5">{prevEngine.name}</span>
                <span className="text-[11px] font-semibold block mb-2">{prevEngine.title}</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{prevEngine.description}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 font-mono text-[10px] h-7"
                  onClick={() => onNavigate(prevEngine.id)}
                >
                  <ArrowLeft className="h-3 w-3 mr-1.5" /> RETURN TO {prevEngine.name}
                </Button>
              </div>
            ) : (
              <div className="bg-background rounded-lg border border-dashed border-border/60 p-4">
                <span className="text-xs font-mono font-bold text-secondary block mb-1.5">INGESTION ORIGIN</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">This session began from a seed prompt or uploaded document.</p>
              </div>
            )}
          </div>

          <div className="mt-auto">
             <Link href="/ingest" className="w-full">
               <Button variant="default" className="w-full font-mono text-[11px] bg-foreground text-background hover:bg-foreground/90 h-9">
                 <Upload className="h-3.5 w-3.5 mr-2" /> UPLOAD DOCUMENT
               </Button>
             </Link>
             <p className="text-[9px] text-muted-foreground mt-2.5 text-center flex items-center justify-center gap-1">
               <Info className="h-2.5 w-2.5" />
               New document via Ingest/Cartridge
             </p>
          </div>
        </div>

        {/* Center Column: What you are doing now */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative z-10 overflow-y-auto shadow-[0_0_40px_rgba(0,0,0,0.03)] dark:shadow-[0_0_40px_rgba(0,0,0,0.2)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />
          
          <div className="p-4 md:p-6 flex-1 flex flex-col relative z-10 min-h-0">
             <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1.5 md:hidden">
                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] text-foreground">2</div>
                    What you are doing now
                  </h3>
                  <h1 className="font-display text-2xl md:text-3xl tracking-wider text-foreground flex items-center gap-2.5">
                    <span className="text-primary font-mono text-xl md:text-2xl bg-primary/10 px-2 py-0.5 rounded">{activeEngine?.name}</span>
                    {activeEngine?.title}
                  </h1>
                  <p className="text-muted-foreground font-mono text-[11px] max-w-2xl mt-2 leading-relaxed">
                    {activeEngine?.description}
                  </p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2 pb-4 md:hidden">
               <button
                 type="button"
                 disabled={!prevEngine}
                 onClick={() => prevEngine && onNavigate(prevEngine.id)}
                 className="min-w-0 rounded-lg border border-border/60 bg-card p-3 text-left disabled:opacity-60"
               >
                 <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                   Where you came from
                 </span>
                 <span className="mt-1 block truncate text-xs font-semibold text-foreground">
                   {prevEngine ? `${prevEngine.name} · ${prevEngine.title}` : "Ingestion origin"}
                 </span>
               </button>
               <button
                 type="button"
                 disabled={!nextEngine || getFeatureStatus(nextEngine.id) === FeatureStatus.LOCKED}
                 onClick={() => nextEngine && onNavigate(nextEngine.id)}
                 className="min-w-0 rounded-lg border border-border/60 bg-card p-3 text-left disabled:opacity-60"
               >
                 <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                   Where you are going next
                 </span>
                 <span className="mt-1 block truncate text-xs font-semibold text-foreground">
                   {nextEngine ? `${nextEngine.name} · ${nextEngine.title}` : "Pipeline complete"}
                 </span>
               </button>
             </div>
             
             {/* Workspace renders here */}
             <div className="flex-1 flex flex-col min-h-0 bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
               {children}
             </div>
          </div>
        </div>

        {/* Right Column: Where you are going next */}
        <div className="w-[300px] hidden lg:flex flex-col border-l bg-card/30 shrink-0 p-4 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] text-foreground">3</div>
              Where are you going next
            </h3>
            {nextEngine ? (
              <div className="bg-background rounded-lg border border-border/60 p-4 shadow-sm hover:border-border transition-colors">
                <span className="text-xs font-mono font-bold text-primary block mb-1.5">{nextEngine.name}</span>
                <span className="text-[11px] font-semibold block mb-2">{nextEngine.title}</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">{nextEngine.description}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full font-mono text-[10px] h-7"
                  onClick={() => onNavigate(nextEngine.id)}
                  disabled={getFeatureStatus(nextEngine.id) === FeatureStatus.LOCKED}
                >
                  PROCEED TO {nextEngine.name} <ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
              </div>
            ) : (
              <div className="bg-background rounded-lg border border-dashed border-border/60 p-4">
                <span className="text-xs font-mono font-bold text-secondary block mb-1.5">PIPELINE COMPLETE</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">No further linear steps. Proceed to Code Oracle or external build.</p>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 mt-2">
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                 <Package className="h-3.5 w-3.5" /> SESSION ARTIFACTS
               </h3>
               <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                 {artifacts.length} TOTAL
               </span>
             </div>
             <div className="flex-1 overflow-y-auto bg-background rounded-lg border border-border/60 p-2 shadow-inner">
               <ArtifactTray artifacts={artifacts} />
             </div>
             <div className="mt-3 p-3 bg-muted/40 rounded border border-border/40 text-center">
               <p className="text-[10px] font-mono text-muted-foreground flex flex-col items-center gap-1">
                 <Download className="h-3.5 w-3.5 mb-1" />
                 Download/Export features available within active workspaces.
               </p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
