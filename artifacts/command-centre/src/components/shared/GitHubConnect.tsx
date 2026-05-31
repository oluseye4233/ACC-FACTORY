import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Github, Link2Off } from "lucide-react";

type Status =
  | { connected: false; oauthAvailable: boolean }
  | {
      connected: true;
      login: string | null;
      lastUsedAt: string | null;
      createdAt: string;
      oauthAvailable: boolean;
    };

export function GitHubConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const refresh = () =>
    api
      .get<Status>("/api/integrations/github")
      .then(setStatus)
      .catch(() => setStatus({ connected: false, oauthAvailable: false }));

  useEffect(() => {
    void refresh();
  }, []);

  // Surface the result of the OAuth round-trip (the callback redirects back to
  // /account?github=…) as a toast, then strip the query so a refresh is clean.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("github");
    if (!outcome) return;
    const messages: Record<string, { title: string; description?: string; destructive?: boolean }> = {
      connected: { title: "GitHub connected" },
      denied: { title: "GitHub authorization cancelled", destructive: true },
      error: {
        title: "Could not connect GitHub",
        description: "Something went wrong during authorization. Try again.",
        destructive: true,
      },
      oauth_unavailable: {
        title: "One-click connect is unavailable",
        description: "Paste a personal access token instead.",
        destructive: true,
      },
    };
    const m = messages[outcome];
    if (m) {
      toast({
        title: m.title,
        description: m.description,
        variant: m.destructive ? "destructive" : undefined,
      });
      if (outcome !== "connected") setShowPaste(true);
    }
    params.delete("github");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectOAuth = () => {
    const scope = publicOnly ? "public_repo" : "repo";
    window.location.href = `/api/integrations/github/oauth/start?scope=${scope}`;
  };

  const connect = async () => {
    if (!token.trim()) return;
    setPending(true);
    try {
      const r = await api.post<{ connected: true; login: string }>(
        "/api/integrations/github",
        { token: token.trim() },
      );
      setToken("");
      setShowPaste(false);
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

  const oauthAvailable = status.oauthAvailable;

  return (
    <div className="space-y-3" data-testid="github-not-connected">
      <p className="text-xs text-muted-foreground font-mono">
        Connect GitHub to enable “Push to GitHub” on F8 CODE ORACLE codebases — repos
        land in your own account. For the tightest control, paste a{" "}
        <span className="font-bold">fine-grained token</span> limited to only the
        repos you choose.
      </p>

      {oauthAvailable ? (
        <>
          <div className="flex items-center justify-between rounded border border-border/50 p-2.5">
            <div className="min-w-0 pr-3">
              <Label
                htmlFor="github-public-only"
                className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Public repos only
              </Label>
              <p className="font-mono text-[10px] text-muted-foreground/70">
                {publicOnly
                  ? "Grants the public_repo scope — private repos stay off-limits."
                  : "Grants the repo scope (public + private)."}
              </p>
            </div>
            <Switch
              id="github-public-only"
              checked={publicOnly}
              onCheckedChange={setPublicOnly}
              disabled={pending}
              data-testid="github-public-only"
            />
          </div>
          <Button onClick={connectOAuth} disabled={pending} data-testid="github-connect-oauth">
            <Github className="h-4 w-4 mr-2" />
            CONNECT GITHUB
          </Button>
          <p className="text-[10px] text-muted-foreground/70 font-mono">
            One-click connect can’t limit access to individual repos. To expose
            only specific repos, paste a fine-grained token below.
          </p>
          <button
            type="button"
            className="block text-[10px] font-mono text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => setShowPaste((v) => !v)}
            data-testid="github-paste-toggle"
          >
            {showPaste ? "Hide manual token entry" : "Paste a token instead"}
          </button>
        </>
      ) : null}

      {(!oauthAvailable || showPaste) && (
        <div className="space-y-2">
          <Label htmlFor="github-token" className="font-mono text-xs uppercase tracking-wider">
            GitHub token
          </Label>
          <Input
            id="github-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_… or ghp_…"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            data-testid="github-token-input"
          />
          <div className="text-[10px] text-muted-foreground font-mono space-y-1">
            <p>
              Recommended: a{" "}
              <span className="font-bold">fine-grained token</span> scoped to
              only the repositories you choose, with:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Contents: Read and write (push the scaffold)</li>
              <li>
                Administration: Read and write (only needed to create a new repo)
              </li>
            </ul>
            <p className="text-muted-foreground/70">
              A classic token with the <span className="font-bold">repo</span>{" "}
              scope also works, but grants access to all your repos.
            </p>
          </div>
          <Button
            onClick={connect}
            disabled={pending || !token.trim()}
            data-testid="github-connect"
            variant={oauthAvailable ? "outline" : "default"}
          >
            <Github className="h-4 w-4 mr-2" />
            {pending ? "SAVING…" : "CONNECT WITH TOKEN"}
          </Button>
        </div>
      )}
    </div>
  );
}
