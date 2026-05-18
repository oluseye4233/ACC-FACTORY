import { Link } from "wouter";
import { useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";

export function TopNav() {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl tracking-wider text-primary">ATANDA</span>
          </Link>
          <Show when="signed-in">
            <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <Link href="/command" className="hover:text-foreground transition-colors">Command</Link>
              <Link href="/sessions" className="hover:text-foreground transition-colors">Sessions</Link>
              <Link href="/prompts" className="hover:text-foreground transition-colors">Prompts</Link>
              <Link href="/quests" className="hover:text-foreground transition-colors">Quests</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/billing" className="hover:text-foreground transition-colors">Billing</Link>
            </nav>
          </Show>
        </div>
        
        <div className="flex items-center gap-4">
          <Show when="signed-in">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="text-muted-foreground hover:text-foreground"
            >
              LOG OUT
            </Button>
          </Show>
          <Show when="signed-out">
            <div className="flex items-center gap-2">
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-4">
                Pricing
              </Link>
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Button asChild size="sm" className="font-display tracking-wider">
                <Link href="/sign-up">INITIATE</Link>
              </Button>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
}
