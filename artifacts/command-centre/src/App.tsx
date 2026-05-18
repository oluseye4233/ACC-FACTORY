import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import Verify from "@/pages/verify";
import Command from "@/pages/command";
import Sessions from "@/pages/sessions";
import SessionNew from "@/pages/session-new";
import SessionDetail from "@/pages/session-detail";
import Billing from "@/pages/billing";
import Exemplars from "@/pages/exemplars";
import Prompts from "@/pages/prompts";
import Quests from "@/pages/quests";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(144 61% 26%)", // primary
    colorForeground: "hsl(0 0% 95%)", // foreground
    colorMutedForeground: "hsl(0 0% 60%)", // muted-foreground
    colorDanger: "hsl(3 79% 50%)", // destructive
    colorBackground: "hsl(0 0% 7%)", // card
    colorInput: "hsl(0 0% 15%)", // input
    colorInputForeground: "hsl(0 0% 95%)", // foreground
    colorNeutral: "hsl(0 0% 15%)", // border
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#121212] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#262626]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-display tracking-wider text-[#f2f2f2]",
    headerSubtitle: "text-sm font-mono text-[#999999]",
    socialButtonsBlockButtonText: "text-sm font-medium text-[#f2f2f2]",
    formFieldLabel: "text-xs font-mono font-bold uppercase text-[#f2f2f2]",
    footerActionLink: "text-sm text-[#1A6B3A] hover:text-[#1A6B3A]/80 font-mono",
    footerActionText: "text-sm text-[#999999] font-mono",
    dividerText: "text-xs font-mono text-[#999999]",
    identityPreviewEditButton: "text-sm text-[#1A6B3A]",
    formFieldSuccessText: "text-xs text-[#1A6B3A]",
    alertText: "text-sm text-[#DF1A12]",
    logoBox: "flex justify-center mb-6",
    logoImage: "h-8",
    socialButtonsBlockButton: "border-[#262626] bg-[#0D0D0D] hover:bg-[#262626] transition-colors",
    formButtonPrimary: "bg-[#1A6B3A] hover:bg-[#1A6B3A]/90 text-white font-display tracking-wider text-lg h-12",
    formFieldInput: "bg-[#0D0D0D] border-[#262626] text-[#f2f2f2] font-mono",
    footerAction: "bg-[#0D0D0D] border-t border-[#262626] pt-4 mt-4",
    dividerLine: "bg-[#262626]",
    alert: "bg-[#DF1A12]/10 border border-[#DF1A12]/20",
    otpCodeFieldInput: "bg-[#0D0D0D] border-[#262626] text-[#f2f2f2]",
    formFieldRow: "space-y-4",
    main: "p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/command" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "OPERATOR ACCESS",
            subtitle: "Authenticate to access FORGE.BONSAI HARNESS",
          },
        },
        signUp: {
          start: {
            title: "INITIALIZE PROTOCOL",
            subtitle: "Register operational credentials",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/verify" component={Verify} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            {/* Protected Routes */}
            <Route path="/command" component={() => <ProtectedRoute component={Command} />} />
            <Route path="/sessions" component={() => <ProtectedRoute component={Sessions} />} />
            <Route path="/session/new" component={() => <ProtectedRoute component={SessionNew} />} />
            <Route path="/session/:id" component={() => <ProtectedRoute component={SessionDetail} />} />
            <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />
            <Route path="/prompts" component={() => <ProtectedRoute component={Prompts} />} />
            <Route path="/quests" component={() => <ProtectedRoute component={Quests} />} />
            <Route path="/exemplars" component={Exemplars} />
            <Route path="/exemplars/:id" component={Exemplars} />

            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
