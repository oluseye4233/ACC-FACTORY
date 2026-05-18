import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import {
  useCreateSession,
  getListSessionsQueryKey,
  useListExemplars,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GitFork, Play } from "lucide-react";

export default function SessionNew() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const createSession = useCreateSession();
  const [sessionName, setSessionName] = useState("");

  const exemplarId = (() => {
    const qIdx = location.indexOf("?");
    const search = qIdx >= 0 ? location.slice(qIdx) : window.location.search;
    return new URLSearchParams(search).get("exemplar");
  })();
  const { data: exemplars } = useListExemplars(
    { query: { enabled: Boolean(exemplarId) } as never } as never,
  );
  const sourceExemplar = exemplarId
    ? exemplars?.find((e) => e.id === exemplarId)
    : undefined;

  useEffect(() => {
    if (sourceExemplar && !sessionName) {
      setSessionName(`Fork: ${sourceExemplar.title}`);
    }
  }, [sourceExemplar, sessionName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;
    
    createSession.mutate(
      { data: { sessionName: sessionName.trim() } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setLocation(`/session/${res.id}`);
        },
        onError: (err) => {
          toast({
            title: "Failed to create session",
            description: (err as any)?.data?.error || "An unexpected error occurred",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container flex items-center justify-center py-12 px-4">
        
        <Card className="w-full max-w-md border-secondary/20 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-3">
            <Button variant="ghost" size="sm" asChild className="w-fit -ml-2 text-muted-foreground hover:text-foreground">
              <Link href="/command" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                RETURN TO COMMAND
              </Link>
            </Button>
            <CardTitle className="font-display text-3xl tracking-wider text-primary">INITIALIZE HARNESS</CardTitle>
            <CardDescription className="font-mono text-sm">
              Define the workspace parameter for this sequence.
            </CardDescription>
            {sourceExemplar && (
              <div className="mt-2 p-3 rounded border border-primary/20 bg-primary/5 flex items-start gap-2">
                <GitFork className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs font-mono">
                  <div className="text-primary font-bold">FORKING FROM</div>
                  <div className="text-foreground">{sourceExemplar.title}</div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    {sourceExemplar.tagline}
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-4 pb-6">
              <div className="space-y-2">
                <label htmlFor="sessionName" className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  SESSION DESIGNATION
                </label>
                <Input 
                  id="sessionName"
                  placeholder="e.g. Project Titan, Q4 Marketing Strategy..." 
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="bg-background font-mono text-sm h-12"
                  autoFocus
                  disabled={createSession.isPending}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 bg-accent/20">
              <Button 
                type="submit" 
                disabled={!sessionName.trim() || createSession.isPending} 
                className="w-full font-display text-lg tracking-wider h-12"
              >
                {createSession.isPending ? "INITIALIZING..." : (
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4 fill-current" />
                    ENGAGE SYSTEM
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
      </main>
    </div>
  );
}
