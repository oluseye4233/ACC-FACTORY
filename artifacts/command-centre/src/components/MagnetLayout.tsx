import type { ReactNode } from "react";
import { Link } from "wouter";

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
      <header className="border-b border-[#262626]">
        <div className="container flex h-20 items-center justify-between px-4">
          <Link href="/test-your-agent" className="flex items-center gap-3" aria-label="ATANDA home">
            <img
              src={`${import.meta.env.BASE_URL}atanda-logo.png`}
              alt="ATANDA"
              className="h-12 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-[#999999]">
            <Link href="/test-your-agent" className="hover:text-[#f2f2f2]">
              Test Kit
            </Link>
            <Link href="/calculate-your-savings" className="hover:text-[#f2f2f2]">
              Calculator
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#1A6B3A]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl tracking-wider text-[#f2f2f2] md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl font-mono text-sm text-[#999999]">{subtitle}</p>
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
    <div className="mt-8 rounded-xl border border-[#1A6B3A]/40 bg-[#1A6B3A]/10 p-6 text-center">
      <p className="font-display text-lg tracking-wide text-[#f2f2f2]">
        Ready to go from a quick check to a certified build?
      </p>
      <p className="mt-2 font-mono text-sm text-[#999999]">
        The full FORGE.BONSAI HARNESS diagnoses, rebuilds and certifies your prompt end-to-end.
      </p>
      <button
        type="button"
        onClick={onConvert}
        disabled={pending}
        className="mt-5 inline-flex h-12 items-center justify-center rounded bg-[#1A6B3A] px-8 font-display text-lg tracking-wider text-white transition-colors hover:bg-[#1A6B3A]/90 disabled:opacity-60"
        data-testid="button-magnet-convert"
      >
        {pending ? "OPENING…" : "ENTER THE COMMAND CENTRE →"}
      </button>
    </div>
  );
}
