import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Show, useAuth } from "@clerk/react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import {
  F1000_PENDING_KEY,
  type F1000ActivateResult,
  type F1000StatusResult,
} from "@/lib/f1000";
import { CheckCircle, Loader2, Ticket } from "lucide-react";

export default function F1000() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [status, setStatus] = useState<F1000StatusResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemedSeq, setRedeemedSeq] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<F1000StatusResult>("/api/f1000/status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // A shared/forwarded ?invite=CODE link skips the claim step: stash it so the
  // post-auth redeemer (or the signed-in branch below) can bind it.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const code = params.get("invite");
    if (code) localStorage.setItem(F1000_PENDING_KEY, code);
  }, [search]);

  const claim = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await api.post<F1000ActivateResult>("/api/f1000/activate");
      localStorage.setItem(F1000_PENDING_KEY, res.code);
      if (isSignedIn) {
        // Already authenticated — bind immediately and show confirmation.
        const redeem = await api.post<{ ok: true; seq: number }>(
          "/api/f1000/redeem",
          { code: res.code },
        );
        localStorage.removeItem(F1000_PENDING_KEY);
        setRedeemedSeq(redeem.seq);
      } else {
        // Hand off to sign-up; F1000Redeemer binds the stashed code after auth.
        setLocation("/sign-up");
      }
    } catch (err) {
      const e = err as ApiError;
      setError(
        e.status === 410
          ? "The First 1000 offer is fully claimed. Standard pricing now applies."
          : e.message,
      );
    } finally {
      setPending(false);
    }
  };

  const remaining = status?.remaining ?? null;
  const closed = status ? !status.open : false;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 sm:py-20 md:py-28">
          <video
            className="absolute inset-0 w-full h-full object-cover -z-20"
            src={`${import.meta.env.BASE_URL}atanda-hero.mp4`}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] -z-10" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm font-mono text-primary">
                <Ticket className="h-3.5 w-3.5" />
                SOFT LAUNCH · THE FIRST 1000
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl tracking-wider text-foreground">
                BE ONE OF THE <span className="text-primary">FIRST 1000</span>
              </h1>
              <p className="font-serif text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                Claim a founding seat: free EXPLORER onboarding, then the
                PRACTITIONER tier at{" "}
                <span className="text-foreground font-bold">$10/month</span>{" "}
                (normally $49) with a $49 AI-usage budget. One click upgrades you
                to ARCHITECT the moment you outgrow it.
              </p>

              {remaining !== null && !closed && (
                <p className="font-mono text-sm text-secondary tracking-wider">
                  {remaining.toLocaleString()} / {status?.total.toLocaleString()}{" "}
                  founding seats remaining
                </p>
              )}

              <Card className="w-full max-w-md p-6 bg-card/60 backdrop-blur border-primary/20 space-y-4">
                {redeemedSeq !== null ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <CheckCircle className="h-10 w-10 text-primary" />
                    <p className="font-display text-xl tracking-wider">
                      SEAT #{redeemedSeq} SECURED
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Your $10/mo Practitioner offer is active at checkout.
                    </p>
                    <Button asChild size="lg" className="font-display tracking-wider mt-2">
                      <Link href="/pricing">GO TO PRICING →</Link>
                    </Button>
                  </div>
                ) : closed ? (
                  <div className="space-y-3 py-2">
                    <p className="font-display text-xl tracking-wider text-muted-foreground">
                      OFFER CLOSED
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      All 1000 founding seats have been claimed. Standard pricing
                      applies.
                    </p>
                    <Button asChild variant="outline" className="font-display tracking-wider">
                      <Link href="/pricing">VIEW PRICING</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={claim}
                      disabled={pending}
                      size="lg"
                      className="w-full h-12 font-display tracking-wider text-lg"
                      data-testid="f1000-claim"
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          CLAIMING…
                        </>
                      ) : (
                        "CLAIM MY INVITE"
                      )}
                    </Button>
                    <Show when="signed-out">
                      <p className="font-mono text-xs text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                          href="/sign-in"
                          className="text-primary hover:underline"
                        >
                          Sign in
                        </Link>{" "}
                        first, then claim.
                      </p>
                    </Show>
                    {error && (
                      <p className="font-mono text-xs text-destructive border border-destructive/30 rounded p-2">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
