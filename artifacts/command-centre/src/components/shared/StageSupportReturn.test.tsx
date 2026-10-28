// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageSupportReturnAction } from "./StageSupportReturn";
import { RETURN_WITH_ARTIFACT_LABEL } from "@/components/boomerang/ReturnedUpgrade";
import type { Departure } from "@/lib/stage-support";

const ret = vi.fn();
vi.mock("@workspace/api-client-react", async (orig) => ({ ...(await orig<object>()), returnStageSupportArtifact: (...a: unknown[]) => ret(...a) }));

afterEach(() => { cleanup(); ret.mockReset(); });
const dep: Departure = {
  caseId: "11111111-1111-4111-8111-111111111111", tool: "ingestion", sessionId: "sess", featureId: 4,
  stageLabel: "F4", sourceId: "src", sourceKind: null, sourceTitle: "T", sourceText: "x",
  launchHref: "/ingest", returnedArtifactHref: null,
};
const RID = "22222222-2222-4222-8222-222222222222";
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("StageSupportReturnAction", () => {
  it("keeps hook order when saved output arrives after the initial empty render", () => {
    const client = new QueryClient();
    const mounted = render(<QueryClientProvider client={client}><StageSupportReturnAction departure={null} resultId={null} /></QueryClientProvider>);
    expect(screen.queryByTestId("button-stage-return")).toBeNull();
    mounted.rerender(<QueryClientProvider client={client}><StageSupportReturnAction departure={dep} resultId={RID} /></QueryClientProvider>);
    expect(screen.getByTestId("button-stage-return").textContent).toContain(RETURN_WITH_ARTIFACT_LABEL);
  });
  it("blocks return when a reason is given", () => {
    wrap(<StageSupportReturnAction departure={dep} resultId={RID} blockedReason="save first" />);
    expect((screen.getByTestId("button-stage-return") as HTMLButtonElement).disabled).toBe(true);
  });
  it("hides without a saved UUID result", () => {
    wrap(<StageSupportReturnAction departure={dep} resultId="" />);
    expect(screen.queryByText(RETURN_WITH_ARTIFACT_LABEL)).toBeNull();
  });
  it("confirms, then calls the return API once", async () => {
    const f = ret.mockResolvedValue({ returnedArtifactId: "a", returnedArtifactHref: "/session/sess?featureId=4", upgradeLabel: "Upgraded 1" });
    wrap(<StageSupportReturnAction departure={dep} resultId={RID} />);
    fireEvent.click(screen.getByText(RETURN_WITH_ARTIFACT_LABEL));
    expect(f).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-confirm-stage-return"));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f.mock.calls[0].slice(0, 2)).toEqual([dep.caseId, { resultId: RID }]);
  });
  it("shows an error and does not navigate on failure", async () => {
    ret.mockRejectedValue(Object.assign(new Error("409"), { data: { error: "stale" } }));
    wrap(<StageSupportReturnAction departure={dep} resultId={RID} />);
    fireEvent.click(screen.getByText(RETURN_WITH_ARTIFACT_LABEL));
    fireEvent.click(screen.getByTestId("button-confirm-stage-return"));
    expect((await screen.findByTestId("text-stage-return-error")).textContent).toContain("stale");
  });
});
