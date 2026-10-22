// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Ingest from "./ingest";

const fixture = vi.hoisted(() => ({
  query: "spcPlayerRunId=run-one",
  source: { data: { id: "run-one", title: "Synthesized example", status: "COMPLETED", outputPackage: { packageVersion: "example", content: ["Synthesized content"] } } as unknown, isLoading: false, isError: false },
  mutate: vi.fn(),
}));
vi.mock("wouter", async original => ({ ...await original<typeof import("wouter")>(),
  useSearch: () => fixture.query, useLocation: () => ["/ingest", vi.fn()],
}));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@workspace/api-client-react", async original => ({ ...await original<typeof import("@workspace/api-client-react")>(),
  useGetSpcPlayerRun: () => fixture.source,
  useStartSessionFromIngestion: () => ({ mutate: fixture.mutate }),
  useGetIngestionCredits: () => ({ data: { available: 5 } }),
  useBillingIngestionCheckout: () => ({ mutate: fixture.mutate }),
}));
const mount = () => render(<QueryClientProvider client={new QueryClient()}><Ingest /></QueryClientProvider>);
afterEach(() => { cleanup(); vi.restoreAllMocks(); fixture.mutate.mockClear(); });
describe("SPC Player to F1 handoff", () => {
  it("automatically prepares remediation output with its shortcomings, but does not execute a paid ingestion", () => {
    const remediation = { reingestionRequired: true, stage: "F5", sourceName: "Original", jcseScore: 44, mathmonScore: 69,
      findings: ["Clarify input contracts"] };
    fixture.source.data = { id: "run-one", title: "Rework", status: "COMPLETED", governance: { remediation },
      outputPackage: { remediation, content: ["Reworked artifact"] } };
    mount();
    expect(screen.getByTestId("reingestion-remediation").textContent).toContain("Clarify input contracts");
    const input = screen.getByPlaceholderText(/Paste the body/) as HTMLTextAreaElement;
    expect(JSON.parse(input.value)).toMatchObject({ remediation, content: ["Reworked artifact"] });
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("retains the named saved package, loading it only after explicit review without running ingestion", () => {
    fixture.source.data = { id: "run-one", title: "Synthesized example", status: "COMPLETED", outputPackage: { content: ["Synthesized content"] } };
    mount();
    const input = screen.getByPlaceholderText(/Paste the body/) as HTMLTextAreaElement;
    expect(input.value).toBe("");
    expect(screen.getByText(/Synthesized example/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-load-player-artifact"));
    expect(JSON.parse(input.value)).toEqual({ content: ["Synthesized content"] });
    expect(fixture.mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Package loaded below/)).toBeTruthy();
  });
  it("does not load an incomplete or missing synthesis", () => {
    fixture.source.data = { id: "run-one", status: "RUNNING", outputPackage: null };
    mount();
    expect(screen.queryByTestId("button-load-player-artifact")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("unavailable or not complete");
  });
  it("requires confirmation before replacing text already entered in F1", () => {
    fixture.source.data = { id: "run-one", title: "Example", status: "COMPLETED", outputPackage: { content: ["New synthesis"] } };
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mount();
    const input = screen.getByPlaceholderText(/Paste the body/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Keep my existing input" } });
    fireEvent.click(screen.getByTestId("button-load-player-artifact"));
    expect(window.confirm).toHaveBeenCalled();
    expect(input.value).toBe("Keep my existing input");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
});
