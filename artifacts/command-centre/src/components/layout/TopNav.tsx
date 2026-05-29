import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useGetMe } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const SIGNED_IN_LINKS: Array<{ href: string; label: string }> = [
  { href: "/command", label: "Command" },
  { href: "/sessions", label: "Sessions" },
  { href: "/ingest", label: "Ingest" },
  { href: "/cartridge", label: "Cartridge" },
  { href: "/prompts", label: "Prompts" },
  { href: "/quests", label: "Quests" },
  { href: "/ascension", label: "Ascension" },
  { href: "/orgs", label: "Teams" },
  { href: "/me/activity", label: "Activity" },
  { href: "/me/costs", label: "Costs" },
  { href: "/demo", label: "Demo" },
  { href: "/pricing", label: "Pricing" },
  { href: "/billing", label: "Billing" },
  { href: "/account", label: "Account" },
];

export function TopNav() {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();

  const signedInLinks =
    me?.role === "ADMIN"
      ? [...SIGNED_IN_LINKS, { href: "/admin/badges", label: "Admin" }]
      : SIGNED_IN_LINKS;

  const go = (href: string) => {
    setMobileOpen(false);
    setLocation(href);
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-20 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/"
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
          <Show when="signed-in">
            <nav className="hidden lg:flex items-center gap-4 text-sm font-medium text-muted-foreground">
              {signedInLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </Show>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Show when="signed-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
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
                  {signedInLinks.map((l) => (
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
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ redirectUrl: basePath || "/" });
                    }}
                    className="mt-6 justify-start font-mono text-sm text-muted-foreground"
                  >
                    LOG OUT
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </Show>
          <Show when="signed-out">
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/demo"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Demo
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
              {DEMO_MODE ? (
                <Button asChild size="sm" className="font-display tracking-wider">
                  <Link href="/demo">VIEW DEMO</Link>
                </Button>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign In
                  </Link>
                  <Button asChild size="sm" className="font-display tracking-wider">
                    <Link href="/sign-up">INITIATE</Link>
                  </Button>
                </>
              )}
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  aria-label="Open navigation menu"
                  data-testid="button-mobile-nav-out"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-display tracking-wider text-primary">
                    MENU
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => go("/demo")}
                    className="text-left font-mono text-sm uppercase tracking-wider py-3 border-b border-border/60"
                  >
                    Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => go("/pricing")}
                    className="text-left font-mono text-sm uppercase tracking-wider py-3 border-b border-border/60"
                  >
                    Pricing
                  </button>
                  {DEMO_MODE ? (
                    <Button
                      onClick={() => go("/demo")}
                      className="font-display tracking-wider mt-2"
                    >
                      VIEW DEMO
                    </Button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => go("/sign-in")}
                        className="text-left font-mono text-sm uppercase tracking-wider py-3 border-b border-border/60"
                      >
                        Sign In
                      </button>
                      <Button
                        onClick={() => go("/sign-up")}
                        className="font-display tracking-wider mt-2"
                      >
                        INITIATE
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </Show>
        </div>
      </div>
    </header>
  );
}
