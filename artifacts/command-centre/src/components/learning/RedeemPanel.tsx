import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRedeemLearningInvitation } from "@workspace/api-client-react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErr, clearInviteToken, invalidateLearning, readInviteToken } from "./learning-model";

export function RedeemPanel({ terms, compact }: { terms: string; compact?: boolean }) {
  const qc = useQueryClient();
  const redeem = useRedeemLearningInvitation();
  const [token, setToken] = useState(() => readInviteToken() ?? "");
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const valid = token.trim().length >= 40 && token.trim().length <= 200;

  const go = () => {
    setErr(null);
    redeem.mutate({ data: { token: token.trim(), acceptFreeTerms: true } }, {
      onSuccess: () => { clearInviteToken(); setToken(""); setAccept(false); setDone(true); },
      onError: (e) => setErr(apiErr(e).message),
      onSettled: () => { void invalidateLearning(qc); },
    });
  };

  return (
    <section className={`border rounded-md bg-card ${compact ? "p-3" : "p-5"} space-y-3`} data-testid="panel-redeem">
      <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><h3 className="font-display text-lg">Redeem an invitation</h3></div>
      <p className="text-xs text-muted-foreground">Cohorts are invite-only. Paste the single-use link token your instructor sent, or open the link directly.</p>
      <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Invitation token" className="font-mono text-xs" data-testid="input-invite-token" />
      <div className="border rounded p-2.5 bg-muted/30 text-xs whitespace-pre-wrap max-h-40 overflow-auto" data-testid="text-terms">{terms}</div>
      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} data-testid="checkbox-accept-terms" />
        <span>I accept the free cohort terms above.</span>
      </label>
      <Button disabled={!accept || !valid || redeem.isPending} onClick={go} data-testid="button-redeem">Join cohort</Button>
      {done && <p className="text-xs text-primary" data-testid="text-redeemed">Joined. Your cohort appears below.</p>}
      {err && <p role="alert" className="text-xs text-destructive" data-testid="text-redeem-error">{err}</p>}
    </section>
  );
}
