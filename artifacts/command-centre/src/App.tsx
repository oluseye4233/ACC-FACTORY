import * as Sentry from "@sentry/react";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
import { Switch, Route, Router as WouterRouter, useLocation, useSearch } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { StudentIdentityProvider, StudentLogin, StudentSignOut, useStudentIdentity } from "@/components/learning-auth";
import { authenticatedLearningEntry } from "@/lib/learning-entry";
import { AccessGate } from "@/components/AccessGate";
import {
  StaffSessionProvider,
  useStaffSessionQuery,
} from "@/lib/staff-session";
import { Redirect } from "wouter";
import { ThemeProvider } from "next-themes";

// Keep authentication/providers eager and persistent. Tool code loads only when
// the existing route gate selects that tool; this does not grant access to it.
const Verify = lazy(() => import("@/pages/verify"));
const Command = lazy(() => import("@/pages/command"));
const Sessions = lazy(() => import("@/pages/sessions"));
const SessionNew = lazy(() => import("@/pages/session-new"));
const SessionDetail = lazy(() => import("@/pages/session-detail"));
const SessionVerification = lazy(() => import("@/pages/session-verification"));
const Exemplars = lazy(() => import("@/pages/exemplars"));
const Sphinx = lazy(() => import("@/pages/sphinx"));
const Prompts = lazy(() => import("@/pages/prompts"));
const Quests = lazy(() => import("@/pages/quests"));
const Account = lazy(() => import("@/pages/account"));
const Ingest = lazy(() => import("@/pages/ingest"));
const Cartridge = lazy(() => import("@/pages/cartridge"));
const F0Dashboard = lazy(() => import("@/pages/f0"));
const AdminBadges = lazy(() => import("@/pages/admin-badges"));
const AdminOps = lazy(() => import("@/pages/admin-ops"));
const AdminProviderBilling = lazy(() => import("@/pages/admin-provider-billing"));
const Ascension = lazy(() => import("@/pages/ascension"));
const F10Console = lazy(() => import("@/pages/f10"));
const Operations = lazy(() => import("@/pages/operations"));
const Activity = lazy(() => import("@/pages/activity"));
const MeCosts = lazy(() => import("@/pages/me-costs"));
const TestYourAgent = lazy(() => import("@/pages/test-your-agent"));
const Guide = lazy(() => import("@/pages/guide"));
const BoomerangPage = lazy(() => import("@/pages/boomerang"));
const LearningPage = lazy(() => import("@/pages/learning"));
const LearningCohortPage = lazy(() => import("@/pages/learning").then(module => ({ default: module.LearningCohortPage })));
const Status = lazy(() => import("@/pages/status"));
const CalculateYourSavings = lazy(() => import("@/pages/calculate-your-savings"));
const SpcPlayerDashboard = lazy(() => import("@/pages/spc-player/dashboard"));
const SpcPlayerNew = lazy(() => import("@/pages/spc-player/new"));
const SpcPlayerDetail = lazy(() => import("@/pages/spc-player/detail"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[100dvh] items-center justify-center bg-background">
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
  const [requestedPath] = useLocation();
  const search = useSearch();
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
  if (requestedPath === "/status" || requestedPath === "/status/") return <PublicRoutes />;

  if (isLoading) return <LoadingScreen />;

  // If the session lookup fails hard, still let public routes resolve.
  const session = data ?? { authenticated: false };
  const learningEntry = authenticatedLearningEntry(requestedPath, search, session.authenticated);
  if (learningEntry) return <Redirect to={learningEntry} />;
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
      const invite = new URLSearchParams(search).get("invite");
      return <Redirect to={invite ? `/learn-login?invite=${encodeURIComponent(invite)}` : "/learn-login"} />;
    }
    // Verification pages and the anonymous acquisition-magnet tools are public
    // even when signed out.
    const publicPath = requestedPath;
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
    if (requestedPath === "/command" || requestedPath === "/") return <Redirect to="/learn" />;
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
            <StudentIdentityProvider>
              <Suspense fallback={<LoadingScreen />}><Gate /></Suspense>
            </StudentIdentityProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
