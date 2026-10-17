import type { ReactNode } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Self-contained public shell for the anonymous acquisition-magnet tools (D25).
 * Deliberately does NOT use the authenticated TopNav/Footer (those depend on the
 * staff session context) so these pages render for signed-out visitors.
 */
export function MagnetLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border">
        <div className="container flex h-20 items-center justify-between px-4">
          <Link href="/test-your-agent" className="flex items-center gap-3" aria-label="ATANDA home">
            <img
              src={`${import.meta.env.BASE_URL}atanda-logo.png`}
              alt="ATANDA"
              className="h-12 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <Link href="/test-your-agent" className="hover:text-foreground">
              Test Kit
            </Link>
            <Link href="/calculate-your-savings" className="hover:text-foreground">
              Calculator
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl tracking-wider text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl font-mono text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

/**
 * Shared conversion CTA. Records the conversion against the magnet session, then
 * routes the visitor into the staff front door (`/command`, which triggers the
 * AccessGate for signed-out visitors).
 */
export function ConversionCta({
  onConvert,
  pending,
}: {
  onConvert: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-8 rounded-xl border border-primary/40 bg-primary/10 p-6 text-center">
      <p className="font-display text-lg tracking-wide text-foreground">
        Ready to go from a quick check to a certified build?
      </p>
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        The full FORGE.BONSAI HARNESS diagnoses, rebuilds and certifies your prompt end-to-end.
      </p>
      <button
        type="button"
        onClick={onConvert}
        disabled={pending}
        className="mt-5 inline-flex h-12 items-center justify-center rounded bg-primary px-8 font-display text-lg tracking-wider text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        data-testid="button-magnet-convert"
      >
        {pending ? "OPENING…" : "ENTER THE COMMAND CENTRE →"}
      </button>
    </div>
  );
}
