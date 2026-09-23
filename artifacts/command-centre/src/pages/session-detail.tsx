import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
import { F0AdvisoryPrompt } from "@/components/shared/F0AdvisoryPrompt";
import { FeatureNavItem } from "@/components/shared/FeatureNavItem";
import { CockpitShell } from "@/components/shared/CockpitShell";
import { EscalationModal } from "@/components/shared/EscalationModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ArrowLeft, AlertTriangle, ListOrdered } from "lucide-react";
import { F1TestPrompt } from "@/components/workspaces/F1TestPrompt";
import { F2BuildAtomic } from "@/components/workspaces/F2BuildAtomic";
import { F3BuildMa } from "@/components/workspaces/F3BuildMa";
import { F4MicroPdd } from "@/components/workspaces/F4MicroPdd";
import { F5BuildSpc } from "@/components/workspaces/F5BuildSpc";
import { F6DraftPdd } from "@/components/workspaces/F6DraftPdd";
import { F7ConvertMvp } from "@/components/workspaces/F7ConvertMvp";
import { F6VdjBuild } from "@/components/workspaces/F6VdjBuild";
import { F8CodeDj } from "@/components/workspaces/F8CodeDj";
import { MathmonLayer } from "@/components/workspaces/MathmonLayer";
import { F9MachineFloor } from "@/components/workspaces/F9MachineFloor";
import F10Console from "@/pages/f10";
import { F11HostConnector } from "@/components/workspaces/F11HostConnector";
import { ProviderSelector } from "@/components/shared/ProviderSelector";
import { SessionOrgVisibility } from "@/components/shared/SessionOrgVisibility";

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
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [hasEmittedF9, setHasEmittedF9] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ id: string }>("/api/me")
      .then((m) => {
        if (!cancelled) setMyUserId(m?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    setHasEmittedF9(false);
    let cancelled = false;
    api
      .get<Array<{ status?: string }>>(
        `/api/harness/f9/runs?sessionId=${encodeURIComponent(id)}`,
      )
      .then((runs) => {
        if (!cancelled) setHasEmittedF9(runs.some((run) => run.status === "EMITTED"));
      })
      .catch(() => {
        if (!cancelled) setHasEmittedF9(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sessionAuthorId = (sessionData?.session as unknown as { userId?: string } | undefined)
    ?.userId ?? null;
  const isSessionOwner = Boolean(myUserId && sessionAuthorId && myUserId === sessionAuthorId);

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
    const latestCodeBundle = artifacts
      ?.filter((artifact) => artifact.artifactType === "CODEBASE_BUNDLE")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const isSoftwareBundle =
      (latestCodeBundle?.artifactContent as { artifactClass?: unknown } | null | undefined)
        ?.artifactClass === "SOFTWARE";
    // Side-step engines are not represented in feature_states. F8 still needs
    // the same certified MVP input that the server requires, so do not surface
    // a dead navigation target before F7 has produced one.
    if (engineId === 9) {
      const hasCertifiedMvp = artifacts?.some(
        (artifact) =>
          artifact.artifactType === "MVP_PDD" &&
          Boolean((artifact as unknown as { spartanCert?: unknown }).spartanCert),
      );
      return hasCertifiedMvp ? FeatureStatus.AVAILABLE : FeatureStatus.LOCKED;
    }
    if (engineId === 11) {
      const hasCertifiedMvp = artifacts?.some(
        (artifact) =>
          artifact.artifactType === "MVP_PDD" &&
          Boolean((artifact as unknown as { spartanCert?: unknown }).spartanCert),
      );
      const hasCodeBundle = artifacts?.some((artifact) => artifact.artifactType === "CODEBASE_BUNDLE");
      return hasCertifiedMvp && hasCodeBundle && !isSoftwareBundle
        ? FeatureStatus.AVAILABLE
        : FeatureStatus.LOCKED;
    }
    if (engineId === 12) {
      return hasEmittedF9 || isSoftwareBundle ? FeatureStatus.AVAILABLE : FeatureStatus.LOCKED;
    }
    if (engineId === 13) {
      const hasCertifiedMvp = artifacts?.some(
        (artifact) =>
          artifact.artifactType === "MVP_PDD" &&
          Boolean((artifact as unknown as { spartanCert?: unknown }).spartanCert),
      );
      const hasCodeBundle = artifacts?.some((artifact) => artifact.artifactType === "CODEBASE_BUNDLE");
      return hasCertifiedMvp && hasCodeBundle ? FeatureStatus.AVAILABLE : FeatureStatus.LOCKED;
    }
    if (engineId > 7) return FeatureStatus.AVAILABLE;
    const state = featureStates?.find(fs => fs.featureId === engineId);
    return state?.status || FeatureStatus.LOCKED;
  };

  // The "next" engine to attract attention to is the lowest-id stage in the
  // linear F1→F7 pipeline that is AVAILABLE (not yet COMPLETE and not LOCKED).
  // Side-step engines (F6-VDJ and MM) are never marked NEXT. F8, F9, and F10
  // remain on the production line and are gated by their upstream artifacts.
  const nextEngineId = ENGINES.filter((e) => e.id <= 7)
    .find((e) => getFeatureStatus(e.id) === FeatureStatus.AVAILABLE)?.id;

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
          isNext={engine.id === nextEngineId}
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
                <HoverCard openDelay={120} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/30 cursor-help"
                      data-testid="badge-ingested-pwdd"
                    >
                      INGESTED → PWDD
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent side="bottom" align="start" sideOffset={6} className="w-80 p-0 overflow-hidden">
                    <div className="px-4 py-2 border-b bg-secondary/10">
                      <span className="font-mono text-xs font-bold text-secondary">PWDD output session</span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        PromptWare Design Document
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        This session was seeded by ingesting an <strong>IPDD</strong> (Ingestion Product Design
                        Document — a human-authored INPUT). Its terminal F7 artefact is a HARNESS-certified
                        <strong> PWDD</strong>, not a regular MVP-PDD.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {session && (
            <ProviderSelector
              sessionId={session.id}
              value={session.preferredModelProvider}
            />
          )}
          {session && (
            <SessionOrgVisibility
              sessionId={session.id}
              initialOrgId={(session as unknown as { orgId?: string | null }).orgId ?? null}
              initialOrgVisible={(session as unknown as { orgVisible?: boolean }).orgVisible}
              readOnly={!isSessionOwner}
            />
          )}
          {session && !isSessionOwner && sessionAuthorId && (
            <span
              className="hidden md:inline-flex items-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-dashed rounded px-2 py-1"
              title={`Shared by author ${sessionAuthorId}`}
              data-testid="badge-session-author"
            >
              shared · author {sessionAuthorId.slice(0, 8)}
            </span>
          )}
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
                  NAVIGATION
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {renderSequenceList(() => setSequenceOpen(false))}
              </div>
            </SheetContent>
          </Sheet>

          {id && <EscalationModal sessionId={id} />}
        </div>
      </header>
      
      {/* Cockpit Layout */}
      <CockpitShell
        sessionId={id || ""}
        activeEngineId={activeEngineId}
        getFeatureStatus={getFeatureStatus}
        artifacts={artifacts || []}
        onNavigate={(engineId) => setActiveEngineId(engineId)}
      >
        {isIngested && ingestion && (
          <div className="p-4 border-b border-border/40 bg-muted/20">
            <IngestionBanner ingestion={ingestion} isF7={activeEngineId === 7} />
          </div>
        )}

        {/* F0 advisory nudge — before F1 (frame the idea) */}
        {activeEngineId === 1 && (
          <div className="p-4 border-b border-border/40">
            <F0AdvisoryPrompt
              dismissKey={`${id}:pre-f1`}
              headline="Before you run F1 — want an advisory read?"
              body="F0 Business Intelligence can pressure-test viability, positioning, and the numbers before you commit the idea to the production floor."
            />
          </div>
        )}
        
        {/* F0 advisory nudge — after F7/F8 (pressure-test before shipping) */}
        {(activeEngineId === 7 || activeEngineId === 9) && (
          <div className="p-4 border-b border-border/40">
            <F0AdvisoryPrompt
              dismissKey={`${id}:post-f${activeEngineId}`}
              headline="Certified — pressure-test before you ship?"
              body="Commission an F0 SOLVA bear-case and range-based financials to stress the certified spec against the market before go-to-market."
            />
          </div>
        )}

        {/* STAGE 3 WORKSPACES */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {id && (
            <>
              {activeEngineId === 1 && <F1TestPrompt sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 2 && <F2BuildAtomic sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 3 && <F3BuildMa sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 4 && <F4MicroPdd sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 5 && <F5BuildSpc sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 6 && <F6DraftPdd sessionId={id} sessionOrigin={session?.origin} artifacts={artifacts || []} />}
              {activeEngineId === 7 && <F7ConvertMvp sessionId={id} sessionOrigin={session?.origin} artifacts={artifacts || []} />}
              {activeEngineId === 8 && <F6VdjBuild sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 9 && (
                <F8CodeDj
                  sessionId={id}
                  artifacts={artifacts || []}
                  onComplete={(artifactClass) => setActiveEngineId(artifactClass === "SOFTWARE" ? 12 : 11)}
                />
              )}
              {activeEngineId === 10 && <MathmonLayer sessionId={id} artifacts={artifacts || []} />}
              {activeEngineId === 11 && getFeatureStatus(11) !== FeatureStatus.LOCKED && (
                <F9MachineFloor sessionId={id} artifacts={artifacts || []} />
              )}
              {activeEngineId === 12 && getFeatureStatus(12) !== FeatureStatus.LOCKED && (
                <F10Console embedded sessionId={id} />
              )}
              {activeEngineId === 13 && getFeatureStatus(13) !== FeatureStatus.LOCKED && (
                <F11HostConnector sessionId={id} artifacts={artifacts || []} />
              )}
            </>
          )}
        </div>
      </CockpitShell>
    </div>
  );
}
