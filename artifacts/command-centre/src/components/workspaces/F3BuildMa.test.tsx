// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { HarnessArtifact } from "@workspace/api-client-react";

const f4 = vi.fn();
const stream = vi.fn();
vi.mock("@workspace/api-client-react", async (original) => ({
  ...await original<typeof import("@workspace/api-client-react")>(),
  useHarnessF4: () => ({ mutateAsync: f4 }),
}));
vi.mock("@/lib/sse", () => ({
  streamSse: (...args: unknown[]) => stream(...args),
  extractApiError: (e: unknown) => ({ message: e instanceof Error ? e.message : "Unknown error" }),
}));
import { F3BuildMa } from "./F3BuildMa";

const artifacts = [{
  artifactType: "ATOMIC_PROMPT", createdAt: "2026-10-28T10:00:00Z",
  artifactContent: { tuple: { role: "A governed test agent" } },
}] as HarnessArtifact[];
const renderWorkspace = () => render(<QueryClientProvider client={new QueryClient()}>
  <F3BuildMa sessionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" artifacts={artifacts} />
</QueryClientProvider>);

describe("F3 MA / Micro PDD paired conversion", () => {
  beforeEach(() => {
    f4.mockReset().mockResolvedValue({ artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    stream.mockReset().mockImplementation(async (_url: string, _data: unknown, onEvent: (e: unknown) => void) => {
      onEvent({ event: "complete", data: {
        artifactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        birthPackage: { overview: "QA", capability: "QA", knowledge: "QA", behaviour: "QA", lifecycle: "QA" },
      } });
    });
  });
  afterEach(cleanup);

  it("never incurs a second F4 call without explicit selection", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("f3-activate"));
    await waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(f4).not.toHaveBeenCalled();
  });
  it("uses the actual saved F3 ID for the existing governed F4 conversion", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("checkbox", { name: "Build Micro PDD with the MA" }));
    fireEvent.click(screen.getByTestId("f3-activate"));
    await waitFor(() => expect(f4).toHaveBeenCalledWith({ data: {
      sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sourceArtifactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      colonizationTarget: "UNDECIDED",
    } }));
    expect((await screen.findByRole("status")).textContent).toContain("Paired Micro PDD saved");
  });
  it("does not launch F4 on a failed F3 stream", async () => {
    stream.mockImplementationOnce(async (_url: string, _data: unknown, onEvent: (e: unknown) => void) => {
      onEvent({ event: "error", data: { error: "Source held for governance review" } });
    });
    renderWorkspace();
    fireEvent.click(screen.getByRole("checkbox", { name: "Build Micro PDD with the MA" }));
    fireEvent.click(screen.getByTestId("f3-activate"));
    expect(await screen.findByText("Source held for governance review")).toBeTruthy();
    expect(f4).not.toHaveBeenCalled();
  });
  it("keeps the saved MA identity visible if the paid F4 step fails", async () => {
    f4.mockRejectedValueOnce(new Error("F4 model unavailable"));
    renderWorkspace();
    fireEvent.click(screen.getByRole("checkbox", { name: "Build Micro PDD with the MA" }));
    fireEvent.click(screen.getByTestId("f3-activate"));
    expect(await screen.findByText(/MA saved as bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb, but F4 did not confirm/)).toBeTruthy();
    expect(screen.getByText(/Check saved F4 artifacts before retrying F4/)).toBeTruthy();
    expect(stream).toHaveBeenCalledOnce();
  });
});
