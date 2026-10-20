import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { focusMainContent, isCurrentDestination } from "@/lib/navigation";
import { StudentSignOut } from "@/components/learning-auth";
import { Button } from "@/components/ui/button";
import { useStaffSession, useLogout } from "@/lib/staff-session";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import {
  CompanySpendBanner,
  CompanySpendMeter,
} from "@/components/layout/CompanySpendMeter";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const STAFF_LINKS: Array<{ href: string; label: string }> = [
  { href: "/learn", label: "Training" },
  { href: "/command", label: "Command" },
  { href: "/guide", label: "Guide" },
  { href: "/boomerang", label: "Boomerang" },
  { href: "/spc-player", label: "SPC Player" },
  { href: "/f10", label: "F10 Release" },
  { href: "/sessions", label: "Sessions" },
  { href: "/exemplars", label: "Exemplar Library" },
  { href: "/ingest", label: "Ingest" },
  { href: "/cartridge", label: "Cartridge" },
  { href: "/f0", label: "F0 Advisory" },
  { href: "/operations?kind=imprima", label: "IMPRIMA" },
  { href: "/operations?kind=short-sprints", label: "Short Sprints" },
  { href: "/prompts", label: "Prompts" },
  { href: "/quests", label: "Quests" },
  { href: "/ascension", label: "Ascension" },
  { href: "/me/activity", label: "Activity" },
  { href: "/me/costs", label: "Costs" },
  { href: "/account", label: "Account" },
];

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const session = useStaffSession();
  const logout = useLogout();

  const allowedStudentLinks = new Set(["/learn", "/guide", "/sessions", "/ascension", "/quests", "/boomerang", "/spc-player", "/ingest", "/cartridge", "/f0"]);
  const links = session.student ? STAFF_LINKS.filter((l) => allowedStudentLinks.has(l.href)) :
    session.role === "ADMIN"
      ? [
          ...STAFF_LINKS,
          { href: "/admin/badges", label: "Admin" },
          { href: "/admin/ops", label: "Ops" },
          { href: "/admin/provider-billing", label: "Provider bills" },
        ]
      : STAFF_LINKS;

  const signOut = () => {
    setMobileOpen(false);
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/"),
    });
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <a
        href="#main-content"
        onClick={(event) => { if (focusMainContent()) event.preventDefault(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-3 focus:text-foreground"
      >
        Skip to main content
      </a>
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
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          {!session.student && <CompanySpendMeter />}
          {session.name ? (
            <span
              className="hidden sm:inline-block max-w-40 truncate font-mono text-xs uppercase tracking-wider text-muted-foreground"
              title={session.name}
              data-testid="text-staff-name"
            >
              {session.name}
            </span>
          ) : null}
          {session.student ? <StudentSignOut /> : <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            LOG OUT
          </Button>}
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
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-display tracking-wider text-primary">
                  NAVIGATION
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Choose a page. Your current destination is marked as the current page.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-6 flex flex-col">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isCurrentDestination(l.href, location, search) ? "page" : undefined}
                    className="text-left font-mono text-sm uppercase tracking-wider py-3 border-b border-border/60 text-foreground hover:text-primary transition-colors"
                    data-testid={`mobile-link-${l.label.toLowerCase()}`}
                  >
                    {l.label}
                  </Link>
                ))}
                {session.student ? <StudentSignOut /> : <Button
                  variant="ghost"
                  onClick={signOut}
                  className="mt-6 justify-start font-mono text-sm text-muted-foreground"
                >
                  LOG OUT
                </Button>}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <nav
        className="container hidden flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 pt-1 text-xs font-medium text-muted-foreground lg:flex"
        aria-label="Main navigation"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrentDestination(link.href, location, search) ? "page" : undefined}
            className="whitespace-nowrap transition-colors hover:text-foreground aria-[current=page]:font-bold aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {!session.student && <CompanySpendBanner />}
    </header>
  );
}
