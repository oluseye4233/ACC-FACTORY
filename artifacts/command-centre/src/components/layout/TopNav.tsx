import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useStaffSession, useLogout } from "@/lib/staff-session";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import {
  CompanySpendBanner,
  CompanySpendMeter,
} from "@/components/layout/CompanySpendMeter";

const STAFF_LINKS: Array<{ href: string; label: string }> = [
  { href: "/command", label: "Command" },
  { href: "/guide", label: "Guide" },
  { href: "/sessions", label: "Sessions" },
  { href: "/ingest", label: "Ingest" },
  { href: "/cartridge", label: "Cartridge" },
  { href: "/f0", label: "F0 Advisory" },
  { href: "/prompts", label: "Prompts" },
  { href: "/quests", label: "Quests" },
  { href: "/ascension", label: "Ascension" },
  { href: "/me/activity", label: "Activity" },
  { href: "/me/costs", label: "Costs" },
  { href: "/account", label: "Account" },
];

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();
  const session = useStaffSession();
  const logout = useLogout();

  const links =
    session.role === "ADMIN"
      ? [
          ...STAFF_LINKS,
          { href: "/admin/badges", label: "Admin" },
          { href: "/admin/ops", label: "Ops" },
        ]
      : STAFF_LINKS;

  const go = (href: string) => {
    setMobileOpen(false);
    setLocation(href);
  };

  const signOut = () => {
    setMobileOpen(false);
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/"),
    });
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-20 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/command"
            className="flex flex-col items-start gap-0.5 shrink-0"
            aria-label="ATANDA home"
            data-testid="link-home"
          >
            <img
              src={`${import.meta.env.BASE_URL}atanda-logo.png`}
              alt="ATANDA"
              className="h-14 md:h-16 w-auto drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]"
            />
            <span className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground uppercase whitespace-nowrap">
              A Cognitive Engineering Project
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-4 text-sm font-medium text-muted-foreground">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <CompanySpendMeter />
          {session.name ? (
            <span
              className="hidden sm:inline font-mono text-xs uppercase tracking-wider text-muted-foreground"
              data-testid="text-staff-name"
            >
              {session.name}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            LOG OUT
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
                data-testid="button-mobile-nav"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-display tracking-wider text-primary">
                  NAVIGATION
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col">
                {links.map((l) => (
                  <button
                    key={l.href}
                    type="button"
                    onClick={() => go(l.href)}
                    className="text-left font-mono text-sm uppercase tracking-wider py-3 border-b border-border/60 text-foreground hover:text-primary transition-colors"
                    data-testid={`mobile-link-${l.label.toLowerCase()}`}
                  >
                    {l.label}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  onClick={signOut}
                  className="mt-6 justify-start font-mono text-sm text-muted-foreground"
                >
                  LOG OUT
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <CompanySpendBanner />
    </header>
  );
}
