// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/components/boomerang", () => ({
  BoomerangPanel: ({ stage, readOnly }: { stage: string; readOnly?: boolean }) =>
    <div data-testid="mock-boomerang-panel" data-stage={stage} data-readonly={String(Boolean(readOnly))} />,
}));
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
  useSearch: () => window.location.search.slice(1),
  useLocation: () => [window.location.pathname, vi.fn()],
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
  useGetSessionCartridge: () => ({ data: undefined, isLoading: false, isError: false }),
  getGetSessionCartridgeQueryKey: (sessionId: string) => ["/sessions", sessionId, "cartridge"],
}));

// Stage-support availability is covered in StageOptionalTools.test; keep it inert here.
vi.mock("@/lib/stage-support", () => ({
  useStageSupportOptions: () => ({ data: { tools: [], sourceId: null }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useLaunchDeparture: () => ({ mutate: vi.fn(), isPending: false }),
  supportErrMessage: (e: unknown) => String(e),
}));

// Chrome / side panels — not relevant to the F0 placement logic.
vi.mock("@/components/shared/QuestProgress", () => ({ QuestProgress: () => null }));
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

describe("SessionDetail — optional tools footer", () => {
  const footer = () => document.getElementById("stage-optional-tools");

  it("never renders the old top F0 nudge at any stage", async () => {
    useListSessionArtifactsMock.mockReturnValue({
      data: [{ artifactType: "MVP_PDD", spartanCert: { certId: "cert-1" } }],
      isLoading: false,
    });
    render(<SessionDetail />);
    expect(await screen.findByTestId("workspace-F1TestPrompt")).toBeTruthy();
    expect(screen.queryByTestId(PROMPT)).toBeNull();
    for (const nav of ["f7", "f8"]) {
      gotoStage(nav);
      expect(screen.queryByTestId(PROMPT)).toBeNull();
    }
  });

  it.each([
    ["f1", "F1TestPrompt", 1, "F1"],
    ["f2", "F2BuildAtomic", 2, "F2"],
    ["f4", "F4MicroPdd", 4, "F4"],
    ["f7", "F7ConvertMvp", 7, "F7"],
    ["mm", "MathmonLayer", 10, "MM"],
  ])("places one set of tools below the %s workspace", async (nav, workspace, engineId, label) => {
    render(<SessionDetail />);
    if (nav !== "f1") gotoStage(nav);
    const ws = await screen.findByTestId(`workspace-${workspace}`);
    await waitFor(() => expect(screen.getByTestId("mock-boomerang-panel")).toBeTruthy());
    const tools = footer()!;
    expect(tools).toBeTruthy();
    expect(ws.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId("tool-boomerang")).toHaveLength(1);
    expect(screen.getAllByTestId("tool-spc-player")).toHaveLength(1);
    expect(screen.getAllByTestId("tool-f0")).toHaveLength(1);
    expect(screen.getAllByTestId("mock-boomerang-panel")).toHaveLength(1);
    expect(screen.getByTestId("mock-boomerang-panel").getAttribute("data-stage")).toBe(label);
    expect(screen.getByTestId("link-open-spc-player").getAttribute("href"))
      .toBe(`/spc-player/new?sourceSessionId=session-1&originFeatureId=${engineId}`);
    // F0 and Agent Creator launch through recorded stage-support departures, not plain links.
    expect(screen.getAllByTestId("button-launch-f0")).toHaveLength(1);
    expect(screen.getAllByTestId("tool-agent-creator")).toHaveLength(1);
    expect(screen.getAllByTestId("button-launch-agent-creator")).toHaveLength(1);
    expect(screen.queryByTestId("tool-short-sprints")).toBeNull();
    void engineId;
  });

  it("uses engine 9 (labelled F8) for the F8 stage URLs", async () => {
    useListSessionArtifactsMock.mockReturnValue({
      data: [{ artifactType: "MVP_PDD", spartanCert: { certId: "cert-1" } }],
      isLoading: false,
    });
    render(<SessionDetail />);
    gotoStage("f8");
    expect(await screen.findByTestId("workspace-F8CodeDj")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("mock-boomerang-panel").getAttribute("data-stage")).toBe("F8"));
    expect(screen.getByTestId("link-open-spc-player").getAttribute("href"))
      .toBe("/spc-player/new?sourceSessionId=session-1&originFeatureId=9");
    expect(screen.getByTestId("button-launch-agent-creator").textContent).toContain("F8");
  });

  it("hides owner-only Boomerang and SPC Player controls from non-owners", async () => {
    apiGet.mockImplementation((path: string) =>
      path.includes("/api/harness/f9/runs") ? Promise.resolve([]) : Promise.resolve({ id: "someone-else" }),
    );
    render(<SessionDetail />);
    expect(await screen.findByTestId("workspace-F1TestPrompt")).toBeTruthy();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/me"));
    expect(screen.queryByTestId("mock-boomerang-panel")).toBeNull();
    expect(screen.getByTestId("text-boomerang-readonly")).toBeTruthy();
    expect(screen.queryByTestId("link-open-spc-player")).toBeNull();
    expect((screen.getByTestId("button-launch-f0") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-launch-agent-creator") as HTMLButtonElement).disabled).toBe(true);
  });
});

/** Overwrite the feature-state hook for the F1→F7 linear stages. */
const setFeatureStates = (states: Array<{ featureId: number; status: string }>) => {
  featureStates = states;
  useListFeatureStateMock.mockReturnValue({ data: states, isLoading: false });
};

describe("SessionDetail — locked-stage navigation gate", () => {
  it("keeps a LOCKED stage inert when its nav item is clicked", async () => {
    // F1 available (active by default); F5 locked, everything else available.
    setFeatureStates(
      [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        featureId: id,
        status: id === 5 ? "LOCKED" : "AVAILABLE",
      })),
    );
    render(<SessionDetail />);

    // Sanity: we start on F1.
    expect(await screen.findByTestId("workspace-F1TestPrompt")).toBeTruthy();

    // The locked stage's nav button is disabled...
    const lockedNav = screen.getByTestId("feature-nav-f5") as HTMLButtonElement;
    expect(lockedNav.disabled).toBe(true);

    // ...and clicking it does not switch the workspace to F5.
    gotoStage("f5");
    expect(screen.queryByTestId("workspace-F5BuildSpc")).toBeNull();
    expect(await screen.findByTestId("workspace-F1TestPrompt")).toBeTruthy();
  });

  it("does not switch away from the active stage when a locked stage is clicked", async () => {
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
    expect(await screen.findByTestId("workspace-F3BuildMa")).toBeTruthy();

    // Clicking the locked F4 leaves us on F3.
    gotoStage("f4");
    expect(screen.queryByTestId("workspace-F4MicroPdd")).toBeNull();
    expect(await screen.findByTestId("workspace-F3BuildMa")).toBeTruthy();
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
    expect(screen.queryByTestId("feature-nav-f6-vdj")).toBeNull();
    for (const name of ["f1", "f2", "f4", "f5", "f6", "f7", "f8", "mm"]) {
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

  it("never marks advisory MM or the gated F8 branch as NEXT", () => {
    // Lock the whole linear pipeline so no F1→F7 stage qualifies as NEXT.
    setFeatureStates(
      [1, 2, 3, 4, 5, 6, 7].map((id) => ({ featureId: id, status: "LOCKED" })),
    );
    render(<SessionDetail />);

    for (const name of ["f8", "mm"]) {
      expect(
        screen.getByTestId(`feature-nav-${name}`).getAttribute("data-next"),
      ).toBeNull();
    }
  });
});

describe("SessionDetail — side-step engines stay navigable", () => {
  it.each([
    ["mm", "MathmonLayer"],
  ])(
    "navigates to %s regardless of feature_states",
    async (navName, workspace) => {
      // Every linear stage locked — the side-steps must still be reachable.
      setFeatureStates(
        [1, 2, 3, 4, 5, 6, 7].map((id) => ({ featureId: id, status: "LOCKED" })),
      );
      render(<SessionDetail />);

      const nav = screen.getByTestId(`feature-nav-${navName}`) as HTMLButtonElement;
      expect(nav.disabled).toBe(false);

      gotoStage(navName);
      expect(await screen.findByTestId(`workspace-${workspace}`)).toBeTruthy();
    },
  );

  it("keeps Mathmon navigable even with no feature_states at all", async () => {
    useListFeatureStateMock.mockReturnValue({ data: [], isLoading: false });
    render(<SessionDetail />);

    gotoStage("mm");
    expect(await screen.findByTestId("workspace-MathmonLayer")).toBeTruthy();
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
    expect(await screen.findByTestId("workspace-F9MachineFloor")).toBeTruthy();
    gotoStage("f10");
    expect(await screen.findByTestId("workspace-F10Console")).toBeTruthy();
    gotoStage("f11");
    expect(await screen.findByTestId("workspace-F11HostConnector")).toBeTruthy();
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
    for (const nav of ["f2", "f5", "f6", "f8", "mm"]) {
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
