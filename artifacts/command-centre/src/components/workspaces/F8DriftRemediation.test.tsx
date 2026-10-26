// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ stream: vi.fn(), recovery: null as unknown, refetch: vi.fn() }));
vi.mock("@workspace/api-client-react", async original => ({
  ...await original<typeof import("@workspace/api-client-react")>(),
  useGetF8RemediationProgress: () => ({ data: mock.recovery, refetch: mock.refetch, isError: false }),
}));
vi.mock("@/lib/sse", async original => ({
  ...await original<typeof import("@/lib/sse")>(), streamSse: mock.stream,
}));
import { F8DriftRemediation } from "./F8DriftRemediation";
afterEach(cleanup);
beforeEach(() => { mock.stream.mockReset(); mock.recovery = null; mock.refetch.mockClear(); });
function setup(reportArtifactId: string | undefined = "report") {
  const onResult = vi.fn(), onBusyChange = vi.fn();
  const view = render(<F8DriftRemediation sessionId="session" reportArtifactId={reportArtifactId} provider="claude"
    disabled={false} onResult={onResult} onBusyChange={onBusyChange} />);
  return { ...view, onResult, onBusyChange };
}
describe("F8 automatic remediation control", () => {
  it("sends the exact report once and exposes the fresh recheck and Boomerang review", async () => {
    mock.stream.mockImplementation(async (_url, _body, emit) => {
      emit({ event: "progress", data: { message: "Running a fresh PFP re-drift check…" } });
      emit({ event: "complete", data: { state: "RECHECKED", summary: "Corrected",
        remediationArtifactId: "record", boomerangCaseId: "case", bundle: { artifactId: "new-bundle" },
        report: { artifactId: "fresh-report", verdict: "fail" } } });
    });
    const { onResult, onBusyChange } = setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ state: "RECHECKED",
      report: { artifactId: "fresh-report", verdict: "fail" } })));
    expect(mock.stream).toHaveBeenCalledWith(expect.stringContaining("/harness/f8-remediate"),
      { sessionId: "session", reportArtifactId: "report", provider: "claude" }, expect.any(Function), expect.any(AbortSignal));
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole("link", { name: /Review returned/ }).getAttribute("href")).toContain("stage=F8");
  });
  it("makes an interrupted stream explicit instead of reporting success", async () => {
    mock.stream.mockResolvedValue(undefined);
    const { onResult } = setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Reload artifacts before retrying"));
    expect(onResult).not.toHaveBeenCalled();
  });
  it("shows requirements review without claiming a completed repair", async () => {
    mock.stream.mockImplementation(async (_url, _body, emit) => emit({ event: "complete", data: {
      state: "REVIEW_REQUIRED", summary: "Approved requirements are contradictory.", remediationArtifactId: "record" } }));
    const { onResult } = setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("REVIEW REQUIRED"));
    expect(onResult.mock.calls[0][0].bundle).toBeUndefined();
  });
  it("disables dispatch without an exact actionable report", () => {
    render(<F8DriftRemediation sessionId="session" disabled={false} onResult={vi.fn()} onBusyChange={vi.fn()} />);
    expect((screen.getByTestId("f8-remediate") as HTMLButtonElement).disabled).toBe(true);
  });
  it("does not offer endless automatic retries after a failed recheck", async () => {
    mock.stream.mockImplementation(async (_url, _body, emit) => emit({ event: "complete", data: {
      state: "RECHECK_FAILED", summary: "Corrected bundle retained. Use RE-DRIFT CHECK.", remediationArtifactId: "record",
      bundle: { artifactId: "new-bundle" } } }));
    const { onResult } = setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(mock.stream).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("RECHECK FAILED");
  });
  it("retains a failed verdict and explicitly starts the next repair against the fresh report", async () => {
    mock.stream.mockImplementation(async (_url, _body, emit) => emit({ event: "complete", data: {
      state: "RECHECKED", summary: "Some drift remains", remediationArtifactId: "record",
      bundle: { artifactId: "upgraded-one" }, report: { artifactId: "fresh-failed-report", verdict: "fail" },
    } }));
    setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(screen.getByTestId("f8-upgrade-still-failed")).toBeTruthy());
    expect(mock.stream).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Open corrected artifact at F8" }).getAttribute("href"))
      .toContain("artifactId=upgraded-one#artifact-upgraded-one");
    fireEvent.click(screen.getByRole("button", { name: "REMEDIATE AGAIN + RE-DRIFT CHECK" }));
    await waitFor(() => expect(mock.stream).toHaveBeenCalledTimes(2));
    expect(mock.stream.mock.calls[1][1].reportArtifactId).toBe("fresh-failed-report");
    expect(screen.getByTestId("f8-upgrade-still-failed").textContent).toContain("not a pass");
  });
  it("labels a passing fresh drift check without calling it release approval", async () => {
    mock.stream.mockImplementation(async (_url, _body, emit) => emit({ event: "complete", data: {
      state: "RECHECKED", summary: "Drift resolved", remediationArtifactId: "record",
      bundle: { artifactId: "upgraded" }, report: { artifactId: "fresh-pass", verdict: "pass" },
    } }));
    setup();
    fireEvent.click(screen.getByTestId("f8-remediate"));
    await waitFor(() => expect(screen.getByText(/Fresh drift result: PASS/)).toBeTruthy());
    expect(screen.queryByTestId("f8-upgrade-still-failed")).toBeNull();
  });
  it("restores completed work without calling the paid endpoint", () => {
    const result = { state: "RECHECKED", summary: "Saved correction", remediationArtifactId: "record", bundle: { artifactId: "saved" } };
    mock.recovery = { attempt: { phase: "COMPLETE", reportArtifactId: "report", result } };
    const { onResult } = setup();
    fireEvent.click(screen.getByRole("button", { name: "RESTORE SAVED REPAIR RESULT" }));
    expect(onResult).toHaveBeenCalledWith(result);
    expect(mock.stream).not.toHaveBeenCalled();
  });
  it("recovers the original report for an interrupted attempt after reload", async () => {
    mock.recovery = { attempt: { phase: "REPAIRED", reportArtifactId: "original-report" } };
    mock.stream.mockImplementation(async (_url, _body, emit) => emit({ event: "complete", data: {
      state: "RECHECKED", summary: "Resumed", remediationArtifactId: "record" } }));
    render(<F8DriftRemediation sessionId="session" disabled={false} onResult={vi.fn()} onBusyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "RESUME REPAIR + RE-DRIFT CHECK" }));
    await waitFor(() => expect(mock.stream).toHaveBeenCalledWith(expect.any(String),
      { sessionId: "session", reportArtifactId: "original-report" }, expect.any(Function), expect.any(AbortSignal)));
  });
});
