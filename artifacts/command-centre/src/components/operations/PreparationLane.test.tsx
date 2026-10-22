// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ArtifactPreparationWorkspace } from "@workspace/api-client-react";
import { InternalReport, PreparationLane } from "./PreparationLane";

const state = vi.hoisted(() => ({ mutateAsync: vi.fn(), pending: false }));
vi.mock("@workspace/api-client-react", async (original) => ({
  ...await original<typeof import("@workspace/api-client-react")>(),
  useCreateArtifactPreparation: () => ({ mutateAsync: state.mutateAsync, isPending: state.pending }),
}));

const workspace = {
  sources: [{ id: "source-1", kind: "F4_MICRO_PDD", title: "Example source" }],
  items: [],
  pagination: { total: 0, limit: 50, offset: 0 },
  authorName: "Example author",
} as unknown as ArtifactPreparationWorkspace;

function mount(kind: "imprima" | "short-sprints" = "short-sprints", internal = false) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PreparationLane internal={internal} kind={kind} ws={workspace} params={undefined} offset={0} setOffset={vi.fn()} fetching={false}
        initial={{ sourceId: "source-1", sourceKind: "F4_MICRO_PDD", sessionId: "" }} />
    </QueryClientProvider>,
  );
}

afterEach(() => { cleanup(); state.pending = false; state.mutateAsync.mockReset(); });

describe("preparation form accessibility", () => {
  it("labels the manifest and associates announced JSON errors with it", () => {
    mount();
    const manifest = screen.getByLabelText(/Agent manifest JSON/);
    expect(screen.getByRole("form", { name: "Prepare sprint package" })).toBeTruthy();
    fireEvent.change(manifest, { target: { value: "{" } });
    expect(manifest.getAttribute("aria-invalid")).toBe("true");
    const error = document.getElementById(manifest.getAttribute("aria-describedby")!);
    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.textContent).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save sprint preparation" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    expect(manifest.hasAttribute("aria-invalid")).toBe(false);
  });

  it("exposes saving state on the named IMPRIMA form", () => {
    state.pending = true;
    mount("imprima");
    expect(screen.getByRole("form", { name: "Prepare private draft" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByLabelText("Audience").parentElement?.parentElement?.className).toContain("grid-cols-1 sm:grid-cols-2");
  });

  it("announces a failed save without granting release permission", async () => {
    state.mutateAsync.mockRejectedValue(new Error("Save unavailable"));
    mount();
    fireEvent.change(screen.getByLabelText("Host target (required)"), { target: { value: "example-target" } });
    fireEvent.submit(screen.getByRole("form", { name: "Prepare sprint package" }));
    await waitFor(() => expect(screen.getByTestId("text-prep-error").getAttribute("role")).toBe("alert"));
    expect(screen.getByText(/Non-releasable proposal package/)).toBeTruthy();
  });

  it("sends evaluationMode only for the internal lane", async () => {
    const prep = { id: "prep-12345678", state: "DRAFT", files: [] };
    state.mutateAsync.mockResolvedValue(prep);
    mount("short-sprints", true);
    expect(screen.getByTestId("text-internal-explainer").textContent).toMatch(/not external verification/);
    fireEvent.change(screen.getByLabelText("Host target (required)"), { target: { value: "example-target" } });
    fireEvent.submit(screen.getByRole("form", { name: "SHORT SPRINT Internal assessment" }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalled());
    expect(state.mutateAsync.mock.calls[0][0].data.evaluationMode).toBe("INTERNAL");
    expect(state.mutateAsync.mock.calls[0][0].data.options.evaluationMode).toBeUndefined();
    cleanup(); state.mutateAsync.mockClear();
    mount("short-sprints");
    fireEvent.change(screen.getByLabelText("Host target (required)"), { target: { value: "example-target" } });
    fireEvent.submit(screen.getByRole("form", { name: "Prepare sprint package" }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalled());
    expect("evaluationMode" in state.mutateAsync.mock.calls[0][0].data).toBe(false);
  });

  it("renders internal report caveat, checks and provenance", () => {
    render(<InternalReport id="r1" value={{ schemaVersion: "1", state: "INCONCLUSIVE", sourceHash: "abc", assessedAt: "2025-01-02T00:00:00Z", caveat: "Internal only, not certification.", checks: [{ id: "jcse", label: "JCSE", state: "NOT_RUN", detail: "no record" }], inheritedEvidence: {}, releaseAllowed: false, externalVerification: "NOT_RUN" }} />);
    expect(screen.getByTestId("status-internal-r1").textContent).toBe("INCONCLUSIVE");
    expect(screen.getByTestId("text-internal-caveat-r1").textContent).toMatch(/not certification/);
    expect(screen.getByTestId("text-internal-provenance-r1").textContent).toMatch(/sourceHash abc/);
    expect(screen.getByTestId("row-internal-check-jcse").textContent).toMatch(/NOT RUN/);
  });
});
