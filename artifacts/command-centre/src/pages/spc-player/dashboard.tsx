import { Link, useLocation } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { useListSpcPlayerRuns } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Plus, List, Search, Play, FileText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SpcPlayerDashboard() {
  const [, setLocation] = useLocation();
  const { data: runs, isLoading } = useListSpcPlayerRuns();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl tracking-wider text-foreground">
              SPC PLAYER
            </h1>
            <p className="text-muted-foreground font-mono text-[11px] mt-1 uppercase tracking-widest">
              Cognitive Production Cockpit
            </p>
          </div>
          <Button
            onClick={() => setLocation("/spc-player/new")}
            data-testid="button-create-run"
            className="font-mono text-xs uppercase tracking-wider"
          >
            <Plus className="mr-2 h-4 w-4" />
            Register New Brief
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : runs && runs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {runs.map((run) => (
              <div
                key={run.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/50 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
                onClick={() => setLocation(`/spc-player/${run.id}`)}
                data-testid={`card-run-${run.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold font-mono text-primary uppercase tracking-wider">
                      {run.status}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {format(new Date(run.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg truncate">{run.title}</h3>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {run.brief}
                  </p>
                </div>
                <div className="flex items-center gap-6 sm:shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-bold text-foreground">
                      {run.selectedCardIds.length}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      Card Refs
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:text-primary group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <List className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No Drafts Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
              You haven't registered any SPC Player briefs yet. Create a new run to begin specifying your capability requirements.
            </p>
            <Button
              onClick={() => setLocation("/spc-player/new")}
              variant="outline"
              data-testid="button-create-run-empty"
              className="font-mono text-xs uppercase tracking-wider"
            >
              Register Brief
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
