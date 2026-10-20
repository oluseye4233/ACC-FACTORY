// @vitest-environment jsdom
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link } from "wouter";

const auth = vi.hoisted(() => ({
  session: { authenticated: false, student: false },
  failed: false,
  identityMount: vi.fn(),
}));
vi.mock("@sentry/react", () => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/staff-session", () => ({
  useStaffSessionQuery: () => ({ data: auth.failed ? undefined : auth.session, isLoading: false, isError: auth.failed, refetch: vi.fn() }),
  StaffSessionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/learning-auth", () => ({
  StudentIdentityProvider: ({ children }: { children: ReactNode }) => {
    useEffect(() => { auth.identityMount(); }, []);
    return children;
  },
  useStudentIdentity: () => ({ isLoaded: true, isSignedIn: false }),
  StudentLogin: () => <h1>Student login</h1>,
  StudentSignOut: () => null,
}));
vi.mock("@/components/AccessGate", () => ({ AccessGate: () => <h1>Staff access</h1> }));
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/pages/command", () => ({
  default: () => <><h1>Command</h1><Link href="/guide">Open guide</Link></>,
}));
vi.mock("@/pages/guide", () => ({ default: () => <h1>Platform guide</h1> }));
vi.mock("@/pages/status", () => ({ default: () => <h1>Platform status</h1> }));
vi.mock("@/pages/verify", () => ({ default: () => <h1>Verify credential</h1> }));
vi.mock("@/pages/sphinx", () => ({ default: () => <h1>Sphinx marketplace</h1> }));
vi.mock("@/pages/test-your-agent", () => ({ default: () => <h1>Test your agent</h1> }));
vi.mock("@/pages/calculate-your-savings", () => ({ default: () => <h1>Savings calculator</h1> }));
vi.mock("@/pages/learning", () => ({
  default: () => <h1>Training</h1>,
  LearningCohortPage: () => <h1>Cohort administration</h1>,
}));
vi.mock("@/pages/spc-player/new", () => ({ default: () => <h1>New SPC Player run</h1> }));

import App from "./App";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (media: string) => ({
    media, matches: false, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
  }),
});

afterEach(() => {
  cleanup();
  auth.session = { authenticated: false, student: false };
  auth.failed = false;
  auth.identityMount.mockClear();
  window.history.replaceState({}, "", "/");
});

function open(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}

describe("on-demand routes retain existing access and identity boundaries", () => {
  it("keeps a protected deep link behind staff access", async () => {
    open("/spc-player/new?sourceId=123");
    expect(await screen.findByRole("heading", { name: "Staff access" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New SPC Player run" })).toBeNull();
    expect(window.location.search).toBe("?sourceId=123");
  });

  it("loads an authenticated tool deep link", async () => {
    auth.session = { authenticated: true, student: false };
    open("/spc-player/new?sourceId=123");
    expect(await screen.findByRole("heading", { name: "New SPC Player run" })).toBeTruthy();
  });

  it("keeps the identity provider mounted while navigating between lazy pages", async () => {
    auth.session = { authenticated: true, student: false };
    open("/command");
    fireEvent.click(await screen.findByRole("link", { name: "Open guide" }));
    expect(await screen.findByRole("heading", { name: "Platform guide" })).toBeTruthy();
    expect(auth.identityMount).toHaveBeenCalledTimes(1);
  });

  it("loads the named cohort export", async () => {
    auth.session = { authenticated: true, student: false };
    open("/teach/cohorts/example");
    expect(await screen.findByRole("heading", { name: "Cohort administration" })).toBeTruthy();
  });

  it("retains the student dashboard redirect", async () => {
    auth.session = { authenticated: true, student: true };
    open("/command");
    expect(await screen.findByRole("heading", { name: "Training" })).toBeTruthy();
  });

  it("retains invitations when authenticated enrollment redirects to training", async () => {
    auth.session = { authenticated: true, student: false };
    open("/learn-register?invite=keep-this-invitation");
    expect(await screen.findByRole("heading", { name: "Training" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("invite")).toBe("keep-this-invitation");
  });

  it.each([
    ["/status", "Platform status"],
    ["/verify?id=example", "Verify credential"],
    ["/sphinx", "Sphinx marketplace"],
    ["/test-your-agent", "Test your agent"],
    ["/calculate-your-savings", "Savings calculator"],
  ])("keeps public route %s reachable when session lookup fails", async (path, heading) => {
    auth.failed = true;
    open(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
  });
});
