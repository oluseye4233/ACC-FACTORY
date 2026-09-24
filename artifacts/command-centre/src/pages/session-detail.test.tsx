// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

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
  IngestionBanner: ({ isF7 }: { isF7: boolean }) => (
    <div data-testid="ingestion-banner" data-is-f7={isF7 ? "true" : "false"} />
  ),
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
vi.mock("@/components/workspaces/F9MachineFloor", () => ({
  F9MachineFloor: () => <div data-testid="workspace-F9MachineFloor" />,
}));
vi.mock("@/pages/f10", () => ({
  default: () => <div data-testid="workspace-F10Console" />,
}));
vi.mock("@/components/workspaces/F11HostConnector", () => ({
  F11HostConnector: () => <div data-testid="workspace-F11HostConnector" />,
}));

import SessionDetail from "./session-detail";

const PROMPT = "f0-advisory-prompt";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  apiGet.mockImplementation((path: string) =>
    path.includes("/api/harness/f9/runs")
      ? Promise.resolve([])
      : Promise.resolve({ id: "user-1" }),
  );

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
        preferredModelProvider: "claude",
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
    useListSessionArtifactsMock.mockReturnValue({
      data: [{ artifactType: "MVP_PDD", spartanCert: { certId: "cert-1" } }],
      isLoading: false,
    });
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

/** Overwrite the feature-state hook for the F1→F7 linear stages. */
const setFeatureStates = (states: Array<{ featureId: number; status: string }>) => {
  featureStates = states;
  useListFeatureStateMock.mockReturnValue({ data: states, isLoading: false });
};

describe("SessionDetail — locked-stage navigation gate", () => {
  it("keeps a LOCKED stage inert when its nav item is clicked", () => {
    // F1 available (active by default); F5 locked, everything else available.
    setFeatureStates(
      [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        featureId: id,
        status: id === 5 ? "LOCKED" : "AVAILABLE",
      })),
    );
    render(<SessionDetail />);

    // Sanity: we start on F1.
    expect(screen.getByTestId("workspace-F1TestPrompt")).toBeTruthy();

    // The locked stage's nav button is disabled...
    const lockedNav = screen.getByTestId("feature-nav-f5") as HTMLButtonElement;
    expect(lockedNav.disabled).toBe(true);

    // ...and clicking it does not switch the workspace to F5.
    gotoStage("f5");
    expect(screen.queryByTestId("workspace-F5BuildSpc")).toBeNull();
    expect(screen.getByTestId("workspace-F1TestPrompt")).toBeTruthy();
  });

  it("does not switch away from the active stage when a locked stage is clicked", () => {
    // F1 & F2 complete, F3 active target, F4+ locked.
    setFeatureStates([
      { featureId: 1, status: "COMPLETE" },
      { featureId: 2, status: "COMPLETE" },
      { featureId: 3, status: "AVAILABLE" },
      { featureId: 4, status: "LOCKED" },
      { featureId: 5, status: "LOCKED" },
      { featureId: 6, status: "LOCKED" },
      { featureId: 7, status: "LOCKED" },
    ]);
    render(<SessionDetail />);

    // Move to the available F3 stage.
    gotoStage("f3");
    expect(screen.getByTestId("workspace-F3BuildMa")).toBeTruthy();

    // Clicking the locked F4 leaves us on F3.
    gotoStage("f4");
    expect(screen.queryByTestId("workspace-F4MicroPdd")).toBeNull();
    expect(screen.getByTestId("workspace-F3BuildMa")).toBeTruthy();
  });
});

describe("SessionDetail — NEXT attention marker", () => {
  it("marks the lowest-id AVAILABLE stage in the F1→F7 pipeline as NEXT", () => {
    // F1 & F2 complete → F3 is the lowest AVAILABLE stage.
    setFeatureStates([
      { featureId: 1, status: "COMPLETE" },
      { featureId: 2, status: "COMPLETE" },
      { featureId: 3, status: "AVAILABLE" },
      { featureId: 4, status: "AVAILABLE" },
      { featureId: 5, status: "LOCKED" },
      { featureId: 6, status: "LOCKED" },
      { featureId: 7, status: "LOCKED" },
    ]);
    render(<SessionDetail />);

    expect(
      screen.getByTestId("feature-nav-f3").getAttribute("data-next"),
    ).toBe("true");
    // No other stage carries the marker, including the later AVAILABLE F4.
    for (const name of ["f1", "f2", "f4", "f5", "f6", "f7", "f6-vdj", "f8", "mm"]) {
      expect(
        screen.getByTestId(`feature-nav-${name}`).getAttribute("data-next"),
      ).toBeNull();
    }
  });

  it("does not mark any stage NEXT when the active stage is the NEXT one", () => {
    // F1 is the lowest AVAILABLE stage and is also active by default, so the
    // attention marker is suppressed (showAttention requires !isActive).
    setFeatureStates(
      [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        featureId: id,
        status: id === 1 ? "AVAILABLE" : "LOCKED",
      })),
    );
    render(<SessionDetail />);

    expect(
      screen.getByTestId("feature-nav-f1").getAttribute("data-next"),
    ).toBeNull();
  });

  it("never marks a side-step engine (F6-VDJ, F8, MM) as NEXT", () => {
    // Lock the whole linear pipeline so no F1→F7 stage qualifies as NEXT.
    setFeatureStates(
      [1, 2, 3, 4, 5, 6, 7].map((id) => ({ featureId: id, status: "LOCKED" })),
    );
    render(<SessionDetail />);

    for (const name of ["f6-vdj", "f8", "mm"]) {
      expect(
        screen.getByTestId(`feature-nav-${name}`).getAttribute("data-next"),
      ).toBeNull();
    }
  });
});

describe("SessionDetail — side-step engines stay navigable", () => {
  it.each([
    ["f6-vdj", "F6VdjBuild"],
    ["mm", "MathmonLayer"],
  ])(
    "navigates to %s regardless of feature_states",
    (navName, workspace) => {
      // Every linear stage locked — the side-steps must still be reachable.
      setFeatureStates(
        [1, 2, 3, 4, 5, 6, 7].map((id) => ({ featureId: id, status: "LOCKED" })),
      );
      render(<SessionDetail />);

      const nav = screen.getByTestId(`feature-nav-${navName}`) as HTMLButtonElement;
      expect(nav.disabled).toBe(false);

      gotoStage(navName);
      expect(screen.getByTestId(`workspace-${workspace}`)).toBeTruthy();
    },
  );

  it("keeps F6-VDJ and Mathmon navigable even with no feature_states at all", () => {
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    gotoStage("f6-vdj");
    expect(screen.getByTestId("workspace-F6VdjBuild")).toBeTruthy();
    gotoStage("mm");
    expect(screen.getByTestId("workspace-MathmonLayer")).toBeTruthy();
  });

  it("locks F8 until a SPARTAN-certified MVP PDD exists", () => {
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    const nav = screen.getByTestId("feature-nav-f8") as HTMLButtonElement;
    expect(nav.disabled).toBe(true);
    expect(screen.queryByTestId("workspace-F8CodeDj")).toBeNull();
  });

  it("keeps F10 off the line until this session emits an F9 artifact", () => {
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    const nav = screen.getByTestId("feature-nav-f10") as HTMLButtonElement;
    expect(nav.disabled).toBe(true);
  });

  it("places F10 immediately after F9 when this session has an emitted machine artifact", async () => {
    apiGet.mockImplementation((path: string) =>
      path.includes("/api/harness/f9/runs")
        ? Promise.resolve([{ status: "EMITTED" }])
        : Promise.resolve({ id: "user-1" }),
    );
    useListSessionArtifactsMock.mockReturnValue({
      data: [
        { artifactType: "MVP_PDD", spartanCert: { certId: "cert-1" } },
        { artifactType: "CODEBASE_BUNDLE" },
      ],
      isLoading: false,
    });
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    await waitFor(() => {
      expect((screen.getByTestId("feature-nav-f10") as HTMLButtonElement).disabled).toBe(false);
    });
    expect((screen.getByTestId("feature-nav-f11") as HTMLButtonElement).disabled).toBe(false);
    gotoStage("f9");
    expect(screen.getByTestId("workspace-F9MachineFloor")).toBeTruthy();
    gotoStage("f10");
    expect(screen.getByTestId("workspace-F10Console")).toBeTruthy();
    gotoStage("f11");
    expect(screen.getByTestId("workspace-F11HostConnector")).toBeTruthy();
  });

  it("routes a Software bundle directly to F10 and F11 while skipping F9", async () => {
    useListSessionArtifactsMock.mockReturnValue({
      data: [
        { artifactType: "MVP_PDD", spartanCert: { certId: "cert-1" } },
        { artifactType: "CODEBASE_BUNDLE", createdAt: "2026-09-23T12:00:00.000Z", artifactContent: { artifactClass: "SOFTWARE" } },
      ],
      isLoading: false,
    });
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    await waitFor(() => {
      expect((screen.getByTestId("feature-nav-f10") as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByTestId("feature-nav-f11") as HTMLButtonElement).disabled).toBe(false);
    });
    expect((screen.getByTestId("feature-nav-f9") as HTMLButtonElement).disabled).toBe(true);
  });
});

const BANNER = "ingestion-banner";

/** Point useGetSession at an ingested (vs manual) session. */
const setSessionOrigin = (origin: "manual" | "ingested") => {
  useGetSessionMock.mockReturnValue({
    data: {
      session: {
        id: "session-1-abcdef",
        sessionName: "Test Session",
        status: "ACTIVE",
        origin,
        preferredModelProvider: "claude",
        userId: "user-1",
        orgId: null,
        orgVisible: false,
      },
    },
    isLoading: false,
    isError: false,
  });
};

/** Point useGetSessionIngestion at present (vs absent) ingestion data. */
const setIngestion = (present: boolean) => {
  useGetSessionIngestionMock.mockReturnValue({
    data: present
      ? {
          id: "ing-1",
          sessionId: "session-1",
          sourceDocKind: "product_design_document",
          originalFilename: "brief.pdf",
          detectedTitle: "Brief",
          summary: "A summary.",
          seedPrompt: "Seed prompt text.",
        }
      : undefined,
  });
};

describe("SessionDetail — IngestionBanner wiring", () => {
  it("does not render for a manual session", () => {
    setSessionOrigin("manual");
    setIngestion(true);
    render(<SessionDetail />);
    expect(screen.queryByTestId(BANNER)).toBeNull();
  });

  it("does not render for an ingested session with no ingestion data yet", () => {
    setSessionOrigin("ingested");
    setIngestion(false);
    render(<SessionDetail />);
    expect(screen.queryByTestId(BANNER)).toBeNull();
  });

  it("renders when the session origin is 'ingested' and ingestion data is present", () => {
    setSessionOrigin("ingested");
    setIngestion(true);
    render(<SessionDetail />);
    expect(screen.getByTestId(BANNER)).toBeTruthy();
  });

  it("passes isF7=false at the F1 stage", () => {
    setSessionOrigin("ingested");
    setIngestion(true);
    render(<SessionDetail />);
    expect(screen.getByTestId(BANNER).getAttribute("data-is-f7")).toBe("false");
  });

  it("flips isF7 true only at the F7 stage", () => {
    setSessionOrigin("ingested");
    setIngestion(true);
    render(<SessionDetail />);

    // Non-F7 stages keep isF7 false (linear + side-step stages).
    for (const nav of ["f2", "f5", "f6", "f6-vdj", "f8", "mm"]) {
      gotoStage(nav);
      expect(screen.getByTestId(BANNER).getAttribute("data-is-f7")).toBe(
        "false",
      );
    }

    // Only F7 flips it true.
    gotoStage("f7");
    expect(screen.getByTestId(BANNER).getAttribute("data-is-f7")).toBe("true");
  });
});
