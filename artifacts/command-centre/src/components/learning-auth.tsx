import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = typeof window === "undefined" ? undefined : publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const StudentIdentityContext = createContext({ isLoaded: true, isSignedIn: false });
export const useStudentIdentity = () => useContext(StudentIdentityContext);
function IdentitySync({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const previous = useRef<string | null | undefined>(undefined);
  const qc = useQueryClient();
  useEffect(() => {
    if (!isLoaded || previous.current === userId) return;
    if (previous.current !== undefined) sessionStorage.removeItem("ffe-membership");
    previous.current = userId;
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "staff-session" });
    void qc.invalidateQueries({ queryKey: ["staff-session"] });
  }, [isLoaded, userId, qc]);
  return <StudentIdentityContext.Provider value={{ isLoaded, isSignedIn: Boolean(isSignedIn) }}>{children}</StudentIdentityContext.Provider>;
}
export function StudentIdentityProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [, setLocation] = useLocation();
  // Missing student configuration must not disable the existing staff entrance.
  if (!clerkPubKey) return <>{children}</>;
  const local = (to: string) => to.startsWith(basePath) && basePath ? to.slice(basePath.length) || "/" : to;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    signInUrl={`${basePath}/learn-login`} signUpUrl={`${basePath}/learn-register`}
    signInFallbackRedirectUrl={`${basePath}/learn`} signUpFallbackRedirectUrl={`${basePath}/learn`}
    routerPush={(to) => setLocation(local(to))} routerReplace={(to) => setLocation(local(to), { replace: true })}
    appearance={{
      options: { logoImageUrl: `${window.location.origin}${basePath}/learning-logo.svg` },
      variables: {
        colorPrimary: resolvedTheme === "dark" ? "#8dcbaa" : "#17653b",
        colorPrimaryForeground: resolvedTheme === "dark" ? "#0b1d3a" : "#ffffff",
        colorBackground: resolvedTheme === "dark" ? "#101b29" : "#ffffff",
        colorForeground: resolvedTheme === "dark" ? "#edf3f8" : "#152338",
        colorMutedForeground: resolvedTheme === "dark" ? "#b2c2d0" : "#546375",
        colorInput: resolvedTheme === "dark" ? "#1b2a3c" : "#ffffff",
        colorInputForeground: resolvedTheme === "dark" ? "#edf3f8" : "#152338",
        fontFamily: "Arial, sans-serif",
      },
      elements: { card: "bg-card text-card-foreground", rootBox: "max-w-full" },
    }}
    localization={{ signIn: { start: { title: "FORGE FIELD ENGINEER", subtitle: "Sign in to your invite-only training account" } },
      signUp: { start: { title: "Your individual training identity", subtitle: "An invitation is still required for cohort access" } } }}>
    <IdentitySync>{children}</IdentitySync>
  </ClerkProvider>;
}
export function StudentSignOut() {
  const { signOut } = useClerk();
  return <Button variant="ghost" size="sm" onClick={() => {
    sessionStorage.removeItem("ffe-membership");
    void signOut({ redirectUrl: `${basePath}/learn-login` });
  }}>LOG OUT</Button>;
}
export function StudentLogin() {
  const register = window.location.pathname.includes("/learn-register");
  const token = new URLSearchParams(window.location.search).get("invite");
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("ffe-invite", token);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [token]);
  if (!clerkPubKey) return <div className="p-8">Student sign-in is not configured. <Link href="/">Staff entrance</Link></div>;
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-5">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <header className="max-w-md text-center">
        <h1 className="font-display text-3xl">FORGE FIELD ENGINEER</h1>
        <p className="mt-2 text-sm text-muted-foreground">Free, invite-only Architect and Engineer training. Use your own verified identity, never the shared staff code. Signing up does not grant cohort admission or a badge.</p>
      </header>
      {register
        ? <SignUp routing="path" path={`${basePath}/learn-register`} signInUrl={`${basePath}/learn-login`} />
        : <SignIn routing="path" path={`${basePath}/learn-login`} signUpUrl={`${basePath}/learn-register`} />}
      <Link href="/" className="text-sm underline">Staff entrance</Link>
    </main>
  );
}
