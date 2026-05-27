import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Show } from "@clerk/react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.post<{ ok: true; organizationId: string }>(
        `/api/invites/${token}/accept`,
      );
      setAccepted(res.organizationId);
      setTimeout(() => setLocation(`/orgs/${res.organizationId}`), 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    // Auto-store the invite in sessionStorage so a redirect through sign-in
    // can come back to it.
    if (token) sessionStorage.setItem("pendingInvite", token);
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container max-w-xl py-16 px-4 text-center space-y-6">
        <h1 className="font-display text-3xl tracking-wider">TEAM INVITE</h1>
        <Show when="signed-in">
          {accepted ? (
            <p className="font-mono text-sm text-primary">
              Joined. Redirecting…
            </p>
          ) : (
            <>
              <p className="font-mono text-sm text-muted-foreground">
                You're about to join an organization on ATANDA Command Centre.
              </p>
              {error && (
                <p className="font-mono text-sm text-destructive border border-destructive/30 rounded p-3">
                  {error}
                </p>
              )}
              <Button onClick={accept} disabled={pending} size="lg">
                {pending ? "ACCEPTING…" : "ACCEPT INVITE"}
              </Button>
            </>
          )}
        </Show>
        <Show when="signed-out">
          <p className="font-mono text-sm text-muted-foreground">
            Sign in (or create an account) using the email this invite was sent to.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild size="lg">
              <Link href="/sign-in">SIGN IN</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-up">SIGN UP</Link>
            </Button>
          </div>
        </Show>
      </main>
    </div>
  );
}
