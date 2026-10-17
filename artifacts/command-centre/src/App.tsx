import * as Sentry from "@sentry/react";
import { useEffect } from "react";
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
import SessionVerification from "@/pages/session-verification";
import Exemplars from "@/pages/exemplars";
import Sphinx from "@/pages/sphinx";
import Prompts from "@/pages/prompts";
import Quests from "@/pages/quests";
import Account from "@/pages/account";
import Ingest from "@/pages/ingest";
import Cartridge from "@/pages/cartridge";
import F0Dashboard from "@/pages/f0";
import AdminBadges from "@/pages/admin-badges";
import AdminOps from "@/pages/admin-ops";
import AdminProviderBilling from "@/pages/admin-provider-billing";
import Ascension from "@/pages/ascension";
import F10Console from "@/pages/f10";
import Operations from "@/pages/operations";
import Activity from "@/pages/activity";
import MeCosts from "@/pages/me-costs";
import TestYourAgent from "@/pages/test-your-agent";
import Guide from "@/pages/guide";
import BoomerangPage from "@/pages/boomerang";
import LearningPage, { LearningCohortPage } from "@/pages/learning";
import { StudentIdentityProvider, StudentLogin, StudentSignOut, useStudentIdentity } from "@/components/learning-auth";
import Status from "@/pages/status";
import CalculateYourSavings from "@/pages/calculate-your-savings";
import { AccessGate } from "@/components/AccessGate";
import {
  StaffSessionProvider,
  useStaffSessionQuery,
} from "@/lib/staff-session";
import { Redirect } from "wouter";
import { ThemeProvider } from "next-themes";
import SpcPlayerDashboard from "@/pages/spc-player/dashboard";
import SpcPlayerNew from "@/pages/spc-player/new";
import SpcPlayerDetail from "@/pages/spc-player/detail";

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
      <Route path="/sphinx" component={Sphinx} />
      <Route path="/status" component={Status} />
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
      <Route path="/sphinx" component={Sphinx} />
      <Route path="/status" component={Status} />
      <Route path="/command" component={Command} />
      <Route path="/guide" component={Guide} />
      <Route path="/boomerang" component={BoomerangPage} />
      <Route path="/learn" component={LearningPage} />
      <Route path="/teach/cohorts/:id" component={LearningCohortPage} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/session/new" component={SessionNew} />
      <Route path="/ingest" component={Ingest} />
      <Route path="/cartridge" component={Cartridge} />
      <Route path="/f0" component={F0Dashboard} />
      <Route path="/session/:sessionId/verification" component={SessionVerification} />
      <Route path="/session/:id" component={SessionDetail} />
      <Route path="/prompts" component={Prompts} />
      <Route path="/quests" component={Quests} />
      <Route path="/ascension" component={Ascension} />
      <Route path="/account" component={Account} />
      <Route path="/admin/badges" component={AdminBadges} />
      <Route path="/admin/ops" component={AdminOps} />
      <Route path="/admin/provider-billing" component={AdminProviderBilling} />
      <Route path="/me/activity" component={Activity} />
      <Route path="/me/costs" component={MeCosts} />
      <Route path="/exemplars" component={Exemplars} />
      <Route path="/exemplars/:id" component={Exemplars} />
      <Route path="/spc-player" component={SpcPlayerDashboard} />
      <Route path="/spc-player/new" component={SpcPlayerNew} />
      <Route path="/spc-player/:id" component={SpcPlayerDetail} />
      <Route path="/operations" component={Operations} />
      <Route path="/f10" component={() => <F10Console />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Gate() {
  const { data, isLoading, isError, refetch } = useStaffSessionQuery();
  const identity = useStudentIdentity();
  // The SDK may finish sign-in just before its session cookie reaches the API.
  // Retry the cookie-backed bridge briefly, never transport tokens explicitly.
  useEffect(() => {
    if (!identity.isLoaded || !identity.isSignedIn || data?.authenticated) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      void refetch();
      if (++attempts >= 10) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [identity.isLoaded, identity.isSignedIn, data?.authenticated, refetch]);

  // Recovery/status must not wait on a session lookup backed by a failing DB.
  const requestedPath = window.location.pathname.replace(basePath, "");
  if (requestedPath === "/status" || requestedPath === "/status/") return <PublicRoutes />;

  if (isLoading) return <LoadingScreen />;

  // If the session lookup fails hard, still let public routes resolve.
  const session = data ?? { authenticated: false };
  const studentLoginPath = requestedPath.startsWith("/learn-login") || requestedPath.startsWith("/learn-register");
  const studentPath = requestedPath.startsWith("/learn") || requestedPath.startsWith("/teach/");
  if (!session.authenticated && studentPath && !identity.isLoaded) return <LoadingScreen />;
  if (!session.authenticated && studentPath && identity.isSignedIn) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-3xl">Connecting your secure training session</h1>
      <p className="max-w-md text-sm text-muted-foreground">We are checking your verified individual account. If this message remains, verify your primary email and retry, or sign out and sign in again.</p>
      <button className="underline" onClick={() => void refetch()}>Retry session check</button>
      <StudentSignOut />
    </main>
  );
  if (studentLoginPath && !session.authenticated) return <Switch>
    <Route path="/learn-login/*?" component={StudentLogin} />
    <Route path="/learn-register/*?" component={StudentLogin} />
  </Switch>;

  if (!session.authenticated) {
    if (requestedPath.startsWith("/learn") || requestedPath.startsWith("/teach/")) {
      const invite = new URLSearchParams(window.location.search).get("invite");
      return <Redirect to={invite ? `/learn-login?invite=${encodeURIComponent(invite)}` : "/learn-login"} />;
    }
    // Verification pages and the anonymous acquisition-magnet tools are public
    // even when signed out.
    const publicPath = window.location.pathname.replace(basePath, "");
    if (
      publicPath.startsWith("/verify") ||
      publicPath.startsWith("/test-your-agent") ||
      publicPath.startsWith("/calculate-your-savings") ||
      publicPath === "/sphinx" ||
      publicPath === "/sphinx/" ||
      publicPath === "/status" ||
      publicPath === "/status/"
    ) {
      return <PublicRoutes />;
    }
    // A failed lookup is treated the same as signed-out: show the front door.
    void isError;
    return <AccessGate />;
  }

  if (session.student) {
    if (studentLoginPath || requestedPath === "/command" || requestedPath === "/") return <Redirect to="/learn" />;
    return <StaffSessionProvider session={session}>
      <AuthenticatedRoutes />
    </StaffSessionProvider>;
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="atanda-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={basePath}>
            <StudentIdentityProvider><Gate /></StudentIdentityProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
