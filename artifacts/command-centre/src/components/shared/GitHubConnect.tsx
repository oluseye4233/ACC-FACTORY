import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Github, Link2Off } from "lucide-react";

type Status =
  | { connected: false }
  | {
      connected: true;
      login: string | null;
      lastUsedAt: string | null;
      createdAt: string;
    };

export function GitHubConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const refresh = () =>
    api
      .get<Status>("/api/integrations/github")
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async () => {
    if (!token.trim()) return;
    setPending(true);
    try {
      const r = await api.post<{ connected: true; login: string }>(
        "/api/integrations/github",
        { token: token.trim() },
      );
      setToken("");
      toast({ title: "GitHub connected", description: `as ${r.login}` });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not connect GitHub",
        description: e instanceof ApiError ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const disconnect = async () => {
    setPending(true);
    try {
      await api.delete("/api/integrations/github");
      toast({ title: "GitHub disconnected" });
      await refresh();
    } catch (e) {
      toast({
        title: "Disconnect failed",
        description: e instanceof ApiError ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  if (status === null) return null;

  if (status.connected) {
    return (
      <div className="space-y-3" data-testid="github-connected">
        <div className="flex items-center justify-between gap-3 rounded border p-3 bg-card/40">
          <div className="flex items-center gap-3 min-w-0">
            <Github className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold truncate">
                {status.login ?? "GitHub account"}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground truncate">
                {status.lastUsedAt
                  ? `last used ${new Date(status.lastUsedAt).toISOString().slice(0, 10)}`
                  : "never used"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={disconnect}
            disabled={pending}
            data-testid="github-disconnect"
          >
            <Link2Off className="h-3.5 w-3.5 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="github-not-connected">
      <p className="text-xs text-muted-foreground font-mono">
        Paste a GitHub personal access token (with the <span className="font-bold">repo</span>{" "}
        scope) to enable “Push to GitHub” on F8 CODE DJ codebases — repos land in
        your own account.
      </p>
      <div className="space-y-2">
        <Label htmlFor="github-token" className="font-mono text-xs uppercase tracking-wider">
          GitHub token
        </Label>
        <Input
          id="github-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_… or github_pat_…"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          data-testid="github-token-input"
        />
      </div>
      <Button
        onClick={connect}
        disabled={pending || !token.trim()}
        data-testid="github-connect"
      >
        <Github className="h-4 w-4 mr-2" />
        {pending ? "SAVING…" : "CONNECT GITHUB"}
      </Button>
    </div>
  );
}
