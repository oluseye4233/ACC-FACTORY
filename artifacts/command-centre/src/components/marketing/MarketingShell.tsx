import { useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useStaffSession } from "@/lib/staff-session";

const NAV = [
  { href: "/#how", label: "How it works", id: "how" },
  { href: "/#workflow", label: "Workflow", id: "workflow" },
  { href: "/pricing", label: "Pricing", id: "pricing" },
  { href: "/learn-register", label: "FORGE", id: "forge" },
];

type MarketingNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  "data-testid"?: string;
};

function MarketingNavLink({ href, children, ...props }: MarketingNavLinkProps) {
  // Native fragment navigation also scrolls after mounting the landing page
  // from /pricing. Wouter's pushState-only links do not guarantee that scroll.
  if (typeof href === "string" && href.includes("#")) {
    return <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${href}`} {...props}>{children}</a>;
  }
  return <Link href={href} {...props}>{children}</Link>;
}

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const enterLabel = useStaffSession().authenticated ? "Enter Platform" : "Staff access";
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="ATANDA home" data-testid="link-home">
            <img src={`${import.meta.env.BASE_URL}atanda-logo.png`} alt="ATANDA" className="h-8 w-auto" />
            <span className="font-display text-xl tracking-widest">ATANDA</span>
            <span className="hidden xl:inline font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">ARK Harness</span>
          </Link>
          <ul className="ml-auto hidden md:flex items-center gap-6 font-mono text-xs uppercase tracking-wider">
            {NAV.map((n) => (
              <li key={n.id}><MarketingNavLink href={n.href} className="hover:text-primary" data-testid={`link-nav-${n.id}`}>{n.label}</MarketingNavLink></li>
            ))}
          </ul>
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            <ThemeToggle />
            <Link href="/command" className="hidden sm:inline-flex h-9 items-center bg-primary px-4 font-display tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-nav-command">{enterLabel}</Link>
            <button type="button" className="md:hidden inline-flex h-9 w-9 items-center justify-center border" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} data-testid="button-mobile-nav">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
        {open && (
          <ul id="mobile-nav" className="md:hidden border-t px-4 py-3 space-y-1 font-mono text-sm uppercase tracking-wider">
            {[...NAV, { href: "/command", label: enterLabel, id: "command" }].map((n) => (
              <li key={n.id}><MarketingNavLink href={n.href} onClick={() => setOpen(false)} className="block py-2" data-testid={`link-mobile-${n.id}`}>{n.label}</MarketingNavLink></li>
            ))}
          </ul>
        )}
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 grid gap-6 md:grid-cols-[1fr_auto] text-sm text-muted-foreground">
          <p className="max-w-xl">ATANDA is the corporate identity behind the ARK Harness and Command Centre. The platform is in private preview. Outputs support your own review and are not independent certification.</p>
          <div className="flex flex-wrap gap-5 font-mono text-xs uppercase tracking-wider">
            <Link href="/" data-testid="link-footer-home">Home</Link>
            <Link href="/pricing" data-testid="link-footer-pricing">Pricing</Link>
            <Link href="/learn-register" data-testid="link-footer-forge">FORGE</Link>
            <Link href="/command" data-testid="link-footer-command">Command Centre</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
