// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
vi.mock("@/components/boomerang", () => ({
  BoomerangPanel: ({ stage }: { stage: string }) => <div data-testid="mock-boomerang-panel" data-stage={stage} />,
}));
const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/session/s1", navigate],
  Link: ({ href, children, ...rest }: Record<string, unknown>) => <a href={href as string} {...rest}>{children as React.ReactNode}</a>,
}));
const options = vi.fn();
const launchMutate = vi.fn();
vi.mock("@/lib/stage-support", () => ({
  useStageSupportOptions: (...a: unknown[]) => options(...a),
  useLaunchDeparture: () => ({ mutate: launchMutate, isPending: false }),
  supportErrMessage: (e: unknown) => (e as { data?: { error?: string } })?.data?.error ?? String(e),
}));
const ready = (tools: { tool: string; active: boolean; reason: string }[]) =>
  options.mockReturnValue({ data: { tools, sourceId: "src-1" }, isLoading: false, isError: false, error: null, refetch: vi.fn() });
import { StageOptionalTools, ReturnToStageBanner } from "./StageOptionalTools";

afterEach(() => { cleanup(); navigate.mockReset(); launchMutate.mockReset(); options.mockReset(); });

describe("StageOptionalTools", () => {
  it("explains each tool with a return-to-stage section", () => {
    ready([]);
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    for (const id of ["boomerang", "spc-player", "agent-creator", "f0", "imprima", "ingestion", "cartridge"]) {
      const box = screen.getByTestId(`tool-${id}`);
      for (const term of ["What it does", "Outcome", "How to use", "Return to this stage"]) {
        expect(box.textContent).toContain(term);
      }
    }
    expect(screen.getByTestId("tool-spc-player").textContent).toContain("RETURN TO THE STAGE YOU LEFT WITH NEW ARTIFACT AND CONTINUE PRODUCTION");
    expect(screen.getByTestId("tool-f0").textContent).toContain("Not automatically adopted");
    expect(screen.queryByTestId("link-open-f0-advisory")).toBeNull();
    for (const id of ["f0", "imprima", "ingestion", "cartridge"]) {
      expect(screen.getByTestId(`tool-${id}`).textContent).toContain("RETURN TO THE STAGE YOU LEFT WITH NEW ARTIFACT AND CONTINUE PRODUCTION");
    }
  });

  it("shows active and inactive support tools with server reasons; inactive launch is disabled", () => {
    ready([
      { tool: "imprima", active: true, reason: "Saved F4 Micro-PDD found." },
      { tool: "short-sprints", active: false, reason: "No saved F4/F5 source." },
      { tool: "ingestion", active: true, reason: "Saved artifact found." },
      { tool: "cartridge", active: false, reason: "No saved artifact at this stage." },
    ]);
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    expect(screen.getByTestId("status-tool-imprima").textContent).toBe("active");
    expect(screen.queryByTestId("status-tool-short-sprints")).toBeNull();
    expect(screen.getByTestId("tool-agent-creator")).toBeTruthy();
    expect(screen.queryByTestId("link-open-agent-creator")).toBeNull();
    expect((screen.getByTestId("button-launch-agent-creator") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-launch-imprima") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("button-launch-cartridge") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables every support launch for non-owners", () => {
    ready([{ tool: "imprima", active: true, reason: "ok" }]);
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner={false} />);
    for (const t of ["imprima", "ingestion", "cartridge"]) {
      expect((screen.getByTestId(`button-launch-${t}`) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("creates the departure first, then navigates to its launchHref", () => {
    ready([{ tool: "ingestion", active: true, reason: "ok" }]);
    launchMutate.mockImplementation((_b, o: { onSuccess: (d: unknown) => void }) => o.onSuccess({ launchHref: "/ingest?supportCaseId=c1" }));
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    fireEvent.click(screen.getByTestId("button-launch-ingestion"));
    expect(launchMutate.mock.calls[0][0]).toEqual({ sessionId: "s1", featureId: 4, tool: "ingestion" });
    expect(navigate).toHaveBeenCalledWith("/ingest?supportCaseId=c1");
  });

  it("shows a rejected launch and does not navigate", async () => {
    ready([{ tool: "imprima", active: true, reason: "ok" }]);
    launchMutate.mockImplementation((_b, o: { onError: (e: unknown) => void }) => o.onError({ data: { error: "Source changed" } }));
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    fireEvent.click(screen.getByTestId("button-launch-imprima"));
    await waitFor(() => expect(screen.getByTestId("text-launch-error-imprima").textContent).toContain("Source changed"));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("F0 source-bound launch", () => {
  it("records the departure before navigating to the linked engagement", () => {
    ready([{ tool: "f0", active: true, reason: "Saved F4 source." }]);
    launchMutate.mockImplementation((_b, o: { onSuccess: (d: unknown) => void }) => {
      expect(navigate).not.toHaveBeenCalled();
      o.onSuccess({ launchHref: "/f0?supportCaseId=c1&engagementId=e1", f0EngagementId: "e1" });
    });
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    fireEvent.click(screen.getByTestId("button-launch-f0"));
    expect(launchMutate.mock.calls[0][0]).toEqual({ sessionId: "s1", featureId: 4, tool: "f0" });
    expect(navigate).toHaveBeenCalledWith("/f0?supportCaseId=c1&engagementId=e1");
  });
  it("is inactive without a saved source and for non-owners", () => {
    ready([{ tool: "f0", active: false, reason: "No saved source at this stage." }]);
    const { unmount } = render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    expect((screen.getByTestId("button-launch-f0") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("text-tool-reason-f0").textContent).toBe("No saved source at this stage.");
    unmount();
    ready([{ tool: "f0", active: true, reason: "ok" }]);
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner={false} />);
    expect((screen.getByTestId("button-launch-f0") as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows launch failure without navigating", async () => {
    ready([{ tool: "f0", active: true, reason: "ok" }]);
    launchMutate.mockImplementation((_b, o: { onError: (e: unknown) => void }) => o.onError({ data: { error: "Source changed" } }));
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    fireEvent.click(screen.getByTestId("button-launch-f0"));
    await waitFor(() => expect(screen.getByTestId("text-launch-error-f0").textContent).toContain("Source changed"));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("ReturnToStageBanner", () => {
  it("links to the exact origin stage", () => {
    render(<ReturnToStageBanner sessionId="s1" featureId={9} stageLabel="F8" note="n" />);
    const link = screen.getByTestId("link-return-to-stage");
    expect(link.getAttribute("href")).toBe("/session/s1?featureId=9#stage-optional-tools");
    expect(link.textContent).toContain("Return to F8");
  });
});
