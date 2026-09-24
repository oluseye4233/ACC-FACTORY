/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Atlas360ViewPanel } from "./Atlas360ViewPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HarnessSessionOrigin } from "@workspace/api-client-react";
import { buildArtifactFilename } from "@workspace/artifact-naming";

const { downloadZip } = vi.hoisted(() => ({
  downloadZip: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/zipExport", () => ({ downloadZip }));

// Mock the API hooks
vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useHarnessPddView: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    getListSessionArtifactsQueryKey: vi.fn().mockReturnValue(["mock-key"]),
  };
});

describe("Atlas360ViewPanel", () => {
  const qc = new QueryClient();

  afterEach(() => {
    cleanup();
    downloadZip.mockClear();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 18, 39, 7));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it("renders with correct defaults for manual session (PLAN)", () => {
    renderWithProviders(
      <Atlas360ViewPanel
        sessionId="test-session"
        sourceArtifactId="art-1"
        sessionOrigin={HarnessSessionOrigin.manual}
        artifacts={[]}
      />
    );

    expect(screen.getAllByText(/ATLAS 360 VIEW/i)[0]).not.toBeNull();
    expect(screen.getByText(/12-part build\/planning view/i)).not.toBeNull();
    
    // Check if the combobox text implies PLAN
    expect(screen.getByTestId("pdd-view-format").textContent).toMatch(/PLAN/i);
    expect(screen.getByTestId("pdd-view-generate").textContent).toMatch(/GENERATE PLAN/i);
  });

  it("renders with correct defaults for ingested session (SCAN)", () => {
    renderWithProviders(
      <Atlas360ViewPanel
        sessionId="test-session"
        sourceArtifactId="art-1"
        sessionOrigin={HarnessSessionOrigin.ingested}
        artifacts={[]}
      />
    );

    expect(screen.getAllByText(/ATLAS 360 VIEW/i)[0]).not.toBeNull();
    expect(screen.getByText(/8-stage assurance view/i)).not.toBeNull();
    
    // Check if the combobox text implies SCAN
    expect(screen.getByTestId("pdd-view-format").textContent).toMatch(/SCAN/i);
    expect(screen.getByTestId("pdd-view-generate").textContent).toMatch(/GENERATE SCAN/i);
  });

  it("matches an existing artifact and renders its content", () => {
    const mockArtifact = {
      id: "art-view-1",
      sessionId: "test-session",
      featureId: 1,
      artifactType: "ATLAS_360_PLAN_VIEW" as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      artifactContent: {
        artifactId: "art-view-1",
        sourceArtifactId: "art-1",
        sourceArtifactType: "ATLAS_PDD",
        view: "PLAN",
        title: "My Mock Plan",
        schemaVersion: "atlas-360-plan-v1",
        parts: [
          { part: 1, title: "Overview", content: "Mock overview content" }
        ],
        disclosure: "CONFIDENTIAL PLAN",
      }
    };

    renderWithProviders(
      <Atlas360ViewPanel
        sessionId="test-session"
        sourceArtifactId="art-1"
        sessionOrigin={HarnessSessionOrigin.manual}
        artifacts={[mockArtifact]}
      />
    );

    // The mock title should be visible
    expect(screen.getByText("My Mock Plan")).not.toBeNull();
    expect(screen.getByText("CONFIDENTIAL PLAN")).not.toBeNull();
    expect(screen.getByText("Overview")).not.toBeNull();
    expect(screen.getByText("Mock overview content")).not.toBeNull();
  });

  it("uses the view artifact title and stable ID in the export filename", async () => {
    const mockArtifact = {
      id: "art-view-1",
      sessionId: "test-session",
      featureId: 1,
      artifactType: "ATLAS_360_PLAN_VIEW" as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      artifactContent: {
        artifactId: "art-view-1",
        sourceArtifactId: "art-1",
        sourceArtifactType: "ATLAS_PDD",
        view: "PLAN",
        title: "My Mock Plan",
        schemaVersion: "atlas-360-plan-v1",
        parts: [{ part: 1, title: "Overview", content: "Mock overview content" }],
      },
    };

    renderWithProviders(
      <Atlas360ViewPanel
        sessionId="test-session"
        sourceArtifactId="art-1"
        sessionOrigin={HarnessSessionOrigin.manual}
        artifacts={[mockArtifact]}
      />,
    );

    await screen.getByTestId("pdd-view-export").click();

    expect(downloadZip).toHaveBeenCalledWith(
      buildArtifactFilename({
        type: "ATLAS_360",
        title: "My Mock Plan",
        id: "art-view-1",
        extension: "zip",
      }),
      expect.any(Object),
    );
  });
});
