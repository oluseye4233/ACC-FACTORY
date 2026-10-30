import { SignIn, SignUp } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { Link, useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMarketingMeta } from "@/components/marketing/use-marketing-meta";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Same guard as StudentIdentityProvider: ClerkProvider only mounts when this resolves. */
export function autoCommandClerkConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY));
}

export default function AutoCommandAuth() {
  const [location] = useLocation();
  const register = location.startsWith("/autocommand/register");
  useMarketingMeta(register ? "Create your AutoCommand identity | ATANDA" : "AutoCommand sign in | ATANDA",
    "Use your individual verified email to access private AutoCommand specification briefs. Shared staff access does not apply.");
  const configured = autoCommandClerkConfigured();
  const back = `${basePath}/autocommand`;
  return (
    <MarketingShell>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1fr_auto] md:px-6 md:py-20">
        <div className="max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-secondary">ATANDA AutoCommand</p>
          <h1 className="mt-4 font-display text-5xl leading-none md:text-6xl">{register ? "Create your individual identity" : "Sign in to your intake desk"}</h1>
          <p className="mt-5 text-muted-foreground">Your saved briefs belong to one verified email address. Shared staff codes are never used here, and signing in does not place an order, take payment or claim a free package.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {["Verify your primary email to save drafts.", "One first free package per verified email is checked at checkout, when checkout opens.", "Signing out clears this device's open form."].map((t) => (
              <li key={t} className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{t}</li>
            ))}
          </ul>
          <Link href="/autocommand" className="mt-8 inline-block font-mono text-xs uppercase tracking-wider underline" data-testid="link-auth-back">Back to AutoCommand</Link>
        </div>
        <div className="min-w-0" data-testid="panel-autocommand-auth">
          {!configured ? (
            <div role="alert" className="max-w-sm border border-destructive/40 bg-card p-6">
              <p className="font-display text-2xl">Individual sign-in unavailable</p>
              <p className="mt-2 text-sm text-muted-foreground">Verified individual sign-in is not configured in this environment, so private intake drafts cannot be saved. The public catalog remains available.</p>
            </div>
          ) : register ? (
            <SignUp routing="path" path={`${basePath}/autocommand/register`} signInUrl={`${basePath}/autocommand/login`} forceRedirectUrl={back} fallbackRedirectUrl={back} />
          ) : (
            <SignIn routing="path" path={`${basePath}/autocommand/login`} signUpUrl={`${basePath}/autocommand/register`} forceRedirectUrl={back} fallbackRedirectUrl={back} />
          )}
        </div>
      </section>
    </MarketingShell>
  );
}
