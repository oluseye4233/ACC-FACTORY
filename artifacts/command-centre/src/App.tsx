import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Verify from "@/pages/verify";
import Command from "@/pages/command";
import Sessions from "@/pages/sessions";
import SessionNew from "@/pages/session-new";
import SessionDetail from "@/pages/session-detail";
import Exemplars from "@/pages/exemplars";
import Prompts from "@/pages/prompts";
import Quests from "@/pages/quests";
import Account from "@/pages/account";
import Ingest from "@/pages/ingest";
import Cartridge from "@/pages/cartridge";
import F0Dashboard from "@/pages/f0";
import AdminBadges from "@/pages/admin-badges";
import Ascension from "@/pages/ascension";
import Activity from "@/pages/activity";
import MeCosts from "@/pages/me-costs";
import TestYourAgent from "@/pages/test-your-agent";
import Guide from "@/pages/guide";
import CalculateYourSavings from "@/pages/calculate-your-savings";
import { AccessGate } from "@/components/AccessGate";
import {
  StaffSessionProvider,
  useStaffSessionQuery,
} from "@/lib/staff-session";
import { Redirect } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Loading…
      </p>
    </div>
  );
}

/**
 * Public verification pages stay reachable without the access code so a
 * certified MVP-PDD's public URL keeps resolving. Everything else sits behind
 * the staff front door.
 */
function PublicRoutes() {
  return (
    <Switch>
      <Route path="/verify" component={Verify} />
      <Route path="/test-your-agent" component={TestYourAgent} />
      <Route path="/calculate-your-savings" component={CalculateYourSavings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/command" />} />
      <Route path="/verify" component={Verify} />
      <Route path="/test-your-agent" component={TestYourAgent} />
      <Route path="/calculate-your-savings" component={CalculateYourSavings} />
      <Route path="/command" component={Command} />
      <Route path="/guide" component={Guide} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/session/new" component={SessionNew} />
      <Route path="/ingest" component={Ingest} />
      <Route path="/cartridge" component={Cartridge} />
      <Route path="/f0" component={F0Dashboard} />
      <Route path="/session/:id" component={SessionDetail} />
      <Route path="/prompts" component={Prompts} />
      <Route path="/quests" component={Quests} />
      <Route path="/ascension" component={Ascension} />
      <Route path="/account" component={Account} />
      <Route path="/admin/badges" component={AdminBadges} />
      <Route path="/me/activity" component={Activity} />
      <Route path="/me/costs" component={MeCosts} />
      <Route path="/exemplars" component={Exemplars} />
      <Route path="/exemplars/:id" component={Exemplars} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Gate() {
  const { data, isLoading, isError } = useStaffSessionQuery();

  if (isLoading) return <LoadingScreen />;

  // If the session lookup fails hard, still let public routes resolve.
  const session = data ?? { authenticated: false };

  if (!session.authenticated) {
    // Verification pages and the anonymous acquisition-magnet tools are public
    // even when signed out.
    const publicPath = window.location.pathname.replace(basePath, "");
    if (
      publicPath.startsWith("/verify") ||
      publicPath.startsWith("/test-your-agent") ||
      publicPath.startsWith("/calculate-your-savings")
    ) {
      return <PublicRoutes />;
    }
    // A failed lookup is treated the same as signed-out: show the front door.
    void isError;
    return <AccessGate />;
  }

  return (
    <StaffSessionProvider session={session}>
      <AuthenticatedRoutes />
    </StaffSessionProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Gate />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
