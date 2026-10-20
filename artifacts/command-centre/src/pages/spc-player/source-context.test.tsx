// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpcPlayerNew from "./new";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), artifacts: [] as Record<string, unknown>[] }));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: unknown }) => children }));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  useListArtifacts: () => ({ data: mocks.artifacts, isLoading: false, isError: false }),
  useGetSpcDevKit: () => ({ data: undefined }),
  useGetSpcPlayerCatalog: () => ({ data: [{
    id: "card-a", name: "Planner", slug: "planner",
    provenance: { source: "exemplar-library" },
  }], isLoading: false }),
  useCreateSpcPlayerRun: () => ({ mutate: mocks.mutate, isPending: false }),
}));

beforeEach(() => {
  mocks.mutate.mockClear();
  mocks.artifacts = [{
    id: "departure", sessionId: "project-a", featureId: 5, artifactType: "SPC",
    name: "CODE TWO", artifactContent: {}, createdAt: "2026-10-18T01:00:00Z",
  }];
});
afterEach(cleanup);

function completeBrief() {
  fireEvent.change(screen.getByTestId("input-title"), { target: { value: "Coding system" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Capability Brief/i }), { target: { value: "Review the saved coding architecture." } });
  fireEvent.click(screen.getByTestId("card-select-card-a"));
}

describe("SPC Player source activation and retention", () => {
  it("supports keyboard deck selection and exposes named deck controls", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/spc-player/new");
    render(<SpcPlayerNew />);
    const card = screen.getByRole("button", { name: "Select Planner" });
    expect(card.getAttribute("aria-pressed")).toBe("false");
    card.focus();
    await user.keyboard(" ");
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Move Planner earlier" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Planner later" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("textbox", { name: "Search SPC catalog" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Add an SPC to the deck" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove Planner from deck" }));
    expect(card.getAttribute("aria-pressed")).toBe("false");
    card.focus();
    await user.keyboard("{Enter}");
    expect(card.getAttribute("aria-pressed")).toBe("true");
  });
  it("automatically binds the F-process source, pins it across reload, and submits that ID", async () => {
    window.history.replaceState(null, "", "/spc-player/new?sourceSessionId=project-a&originFeatureId=5");
    render(<SpcPlayerNew />);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("sourceArtifactId")).toBe("departure"));
    expect(screen.getByTestId("select-source-artifact-locked").textContent).toContain("CODE TWO");
    expect(screen.queryByTestId("select-source-artifact")).toBeNull();
    cleanup();
    mocks.artifacts.push({ ...mocks.artifacts[0], id: "newer", name: "Different version", createdAt: "2026-10-19T01:00:00Z" });
    render(<SpcPlayerNew />);
    completeBrief();
    fireEvent.submit(screen.getByTestId("form-create-run"));
    expect(mocks.mutate.mock.calls[0][0].data).toMatchObject({
      sourceArtifactId: "departure", originSessionId: "project-a", originFeatureId: 5,
    });
  });
  it("keeps the selector for standalone launches", () => {
    window.history.replaceState(null, "", "/spc-player/new");
    render(<SpcPlayerNew />);
    expect(screen.getByTestId("select-source-artifact")).toBeTruthy();
    expect(screen.queryByTestId("select-source-artifact-locked")).toBeNull();
  });
  it("blocks a missing pinned source instead of replacing it with another project file", () => {
    window.history.replaceState(null, "", "/spc-player/new?sourceSessionId=project-a&originFeatureId=5&sourceArtifactId=missing");
    render(<SpcPlayerNew />);
    completeBrief();
    expect((screen.getByTestId("button-submit-run") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByTestId("form-create-run"));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
