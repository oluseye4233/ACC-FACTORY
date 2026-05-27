import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link2, Link2Off } from "lucide-react";

type Status =
  | { connected: false }
  | {
      connected: true;
      label: string | null;
      maskedKey: string;
      lastUsedAt: string | null;
      createdAt: string;
    };

export function SphinxConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const refresh = () =>
    api
      .get<Status>("/api/integrations/sphinx")
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async () => {
    if (!apiKey.trim()) return;
    setPending(true);
    try {
      await api.post("/api/integrations/sphinx", {
        apiKey: apiKey.trim(),
        label: label.trim() || undefined,
      });
      setApiKey("");
      setLabel("");
      toast({ title: "Sphinx connected" });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not save key",
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
      await api.delete("/api/integrations/sphinx");
      toast({ title: "Sphinx disconnected" });
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
      <div className="space-y-3" data-testid="sphinx-connected">
        <div className="flex items-center justify-between gap-3 rounded border p-3 bg-card/40">
          <div className="flex items-center gap-3 min-w-0">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold truncate">
                {status.label ?? "Sphinx Marketplace"}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground truncate">
                {status.maskedKey}
                {status.lastUsedAt
                  ? ` · last used ${new Date(status.lastUsedAt).toISOString().slice(0, 10)}`
                  : " · never used"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={disconnect}
            disabled={pending}
            data-testid="sphinx-disconnect"
          >
            <Link2Off className="h-3.5 w-3.5 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="sphinx-not-connected">
      <p className="text-xs text-muted-foreground font-mono">
        Paste a personal API key from your Sphinx Marketplace account to enable the
        “Upload to Sphinx” button on F5 SPC artifacts.
      </p>
      <div className="space-y-2">
        <Label htmlFor="sphinx-key" className="font-mono text-xs uppercase tracking-wider">
          Sphinx API key
        </Label>
        <Input
          id="sphinx-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sphinx_live_…"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          data-testid="sphinx-key-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sphinx-label" className="font-mono text-xs uppercase tracking-wider">
          Label (optional)
        </Label>
        <Input
          id="sphinx-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Personal Sphinx account"
          className="font-mono"
          data-testid="sphinx-label-input"
        />
      </div>
      <Button
        onClick={connect}
        disabled={pending || !apiKey.trim()}
        data-testid="sphinx-connect"
      >
        <Link2 className="h-4 w-4 mr-2" />
        {pending ? "SAVING…" : "CONNECT SPHINX"}
      </Button>
    </div>
  );
}
