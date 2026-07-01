// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// ---------- mocks ----------
// This suite exercises the REAL SessionDetail page together with the REAL
// F0AdvisoryPrompt and FeatureNavItem so the "which engine stage shows the
// advisory nudge" wiring is what's under test. Everything the page pulls in
// purely to render a stage (data hooks, workspaces, side panels) is stubbed so
// the assertions are about placement, not those dependencies.

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}));

// wouter — fixed session id + a passthrough Link so the F0 CTA anchor is real.
vi.mock("wouter", () => ({
  useParams: () => ({ id: "session-1" }),
  Link: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={href as string} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
}));

// Data hooks — mutable holders so individual tests can vary the feature states.
let featureStates: Array<{ featureId: number; status: string }> = [];
const useGetSessionMock = vi.fn();
const useListFeatureStateMock = vi.fn();
const useListSessionArtifactsMock = vi.fn();
const useGetSessionIngestionMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  FeatureStatus: {
    LOCKED: "LOCKED",
    AVAILABLE: "AVAILABLE",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETE: "COMPLETE",
  },
  useGetSession: () => useGetSessionMock(),
  useListFeatureState: () => useListFeatureStateMock(),
  useListSessionArtifacts: () => useListSessionArtifactsMock(),
  useGetSessionIngestion: () => useGetSessionIngestionMock(),
}));

// Chrome / side panels — not relevant to the F0 placement logic.
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => <div /> }));
vi.mock("@/components/shared/IngestionBanner", () => ({
  IngestionBanner: () => <div data-testid="ingestion-banner" />,
}));
vi.mock("@/components/shared/ArtifactTray", () => ({
  ArtifactTray: () => <div />,
}));
vi.mock("@/components/shared/EscalationModal", () => ({
  EscalationModal: () => <div />,
}));
vi.mock("@/components/shared/GRODot", () => ({ GRODot: () => <div /> }));
vi.mock("@/components/shared/ProviderSelector", () => ({
  ProviderSelector: () => <div />,
}));
vi.mock("@/components/shared/SessionOrgVisibility", () => ({
  SessionOrgVisibility: () => <div />,
}));

// Engine workspaces — stubbed to a marker div so we can confirm which stage is
// active without pulling in the heavy real workspaces.
vi.mock("@/components/workspaces/F1TestPrompt", () => ({
  F1TestPrompt: () => <div data-testid="workspace-F1TestPrompt" />,
}));
vi.mock("@/components/workspaces/F2BuildAtomic", () => ({
  F2BuildAtomic: () => <div data-testid="workspace-F2BuildAtomic" />,
}));
vi.mock("@/components/workspaces/F3BuildMa", () => ({
  F3BuildMa: () => <div data-testid="workspace-F3BuildMa" />,
}));
vi.mock("@/components/workspaces/F4MicroPdd", () => ({
  F4MicroPdd: () => <div data-testid="workspace-F4MicroPdd" />,
}));
vi.mock("@/components/workspaces/F5BuildSpc", () => ({
  F5BuildSpc: () => <div data-testid="workspace-F5BuildSpc" />,
}));
vi.mock("@/components/workspaces/F6DraftPdd", () => ({
  F6DraftPdd: () => <div data-testid="workspace-F6DraftPdd" />,
}));
vi.mock("@/components/workspaces/F7ConvertMvp", () => ({
  F7ConvertMvp: () => <div data-testid="workspace-F7ConvertMvp" />,
}));
vi.mock("@/components/workspaces/F6VdjBuild", () => ({
  F6VdjBuild: () => <div data-testid="workspace-F6VdjBuild" />,
}));
vi.mock("@/components/workspaces/F8CodeDj", () => ({
  F8CodeDj: () => <div data-testid="workspace-F8CodeDj" />,
}));
vi.mock("@/components/workspaces/MathmonLayer", () => ({
  MathmonLayer: () => <div data-testid="workspace-MathmonLayer" />,
}));

import SessionDetail from "./session-detail";

const PROMPT = "f0-advisory-prompt";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  apiGet.mockResolvedValue({ id: "user-1" });

  // Every linear stage available (and therefore navigable via the sequence nav).
  featureStates = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
    featureId: id,
    status: "AVAILABLE",
  }));

  useGetSessionMock.mockReturnValue({
    data: {
      session: {
        id: "session-1-abcdef",
        sessionName: "Test Session",
        status: "ACTIVE",
        origin: "manual",
        preferredModelProvider: "anthropic",
        userId: "user-1",
        orgId: null,
        orgVisible: false,
      },
    },
    isLoading: false,
    isError: false,
  });
  useListFeatureStateMock.mockReturnValue({
    data: featureStates,
    isLoading: false,
  });
  useListSessionArtifactsMock.mockReturnValue({ data: [], isLoading: false });
  useGetSessionIngestionMock.mockReturnValue({ data: undefined });
});

afterEach(() => {
  cleanup();
});

/** Click a stage in the harness sequence nav (names lowercased, e.g. "f7"). */
const gotoStage = (navName: string) =>
  fireEvent.click(screen.getByTestId(`feature-nav-${navName}`));

describe("SessionDetail — F0 advisory placement", () => {
  it("shows the advisory nudge before F1 by default", () => {
    render(<SessionDetail />);
    expect(screen.getByTestId(PROMPT)).toBeTruthy();
    expect(screen.getByTestId("workspace-F1TestPrompt")).toBeTruthy();
  });

  it("shows the advisory nudge after F7 (certified)", () => {
    render(<SessionDetail />);
    gotoStage("f7");
    expect(screen.getByTestId(PROMPT)).toBeTruthy();
    expect(screen.getByTestId("workspace-F7ConvertMvp")).toBeTruthy();
  });

  it("shows the advisory nudge after F8 / CODE ORACLE (engine 9)", () => {
    render(<SessionDetail />);
    gotoStage("f8");
    expect(screen.getByTestId(PROMPT)).toBeTruthy();
    expect(screen.getByTestId("workspace-F8CodeDj")).toBeTruthy();
  });

  it.each([
    ["f2", "F2BuildAtomic"],
    ["f3", "F3BuildMa"],
    ["f4", "F4MicroPdd"],
    ["f5", "F5BuildSpc"],
    ["f6", "F6DraftPdd"],
    ["f6-vdj", "F6VdjBuild"],
    ["mm", "MathmonLayer"],
  ])(
    "does NOT show the advisory nudge at the %s stage",
    (navName, workspace) => {
      render(<SessionDetail />);
      gotoStage(navName);
      expect(screen.getByTestId(`workspace-${workspace}`)).toBeTruthy();
      expect(screen.queryByTestId(PROMPT)).toBeNull();
    },
  );

  it("uses distinct dismiss keys for the pre-F1 and post-F7 placements", () => {
    render(<SessionDetail />);

    // Dismiss the pre-F1 nudge.
    expect(screen.getByTestId(PROMPT)).toBeTruthy();
    fireEvent.click(screen.getByTestId("f0-advisory-dismiss"));
    expect(screen.queryByTestId(PROMPT)).toBeNull();
    expect(
      localStorage.getItem("f0-advisory-dismissed:session-1:pre-f1"),
    ).toBe("1");

    // The post-F7 placement is keyed separately, so it still appears.
    gotoStage("f7");
    expect(screen.getByTestId(PROMPT)).toBeTruthy();
    expect(
      localStorage.getItem("f0-advisory-dismissed:session-1:post-f7"),
    ).toBeNull();
  });

  it("stays dismissed after dismissal within the same placement", () => {
    render(<SessionDetail />);
    fireEvent.click(screen.getByTestId("f0-advisory-dismiss"));
    expect(screen.queryByTestId(PROMPT)).toBeNull();

    // Navigate away and back to the same (pre-F1) stage — still dismissed.
    gotoStage("f3");
    expect(screen.queryByTestId(PROMPT)).toBeNull();
    gotoStage("f1");
    expect(screen.queryByTestId(PROMPT)).toBeNull();
  });

  it("exposes the F0 advisory CTA linking to /f0", () => {
    render(<SessionDetail />);
    const link = screen.getByTestId("f0-advisory-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/f0");
  });

  it("does not render the nudge before F1 once its dismissal is persisted", () => {
    localStorage.setItem("f0-advisory-dismissed:session-1:pre-f1", "1");
    render(<SessionDetail />);
    expect(screen.queryByTestId(PROMPT)).toBeNull();
    expect(screen.getByTestId("workspace-F1TestPrompt")).toBeTruthy();
  });
});
