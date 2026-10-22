// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state: { query: any; mutate: ReturnType<typeof vi.fn>; pending: boolean; onSuccess?: (s: any) => void } = {
  query: {}, mutate: vi.fn(), pending: false,
};
vi.mock("@workspace/api-client-react", () => ({
  useGetArtifactGovernance: () => state.query,
  useInstallArtifactGovernance: (opts: any) => { state.onSuccess = opts?.mutation?.onSuccess; return { mutate: state.mutate, isPending: state.pending, isError: false }; },
  getGetArtifactGovernanceQueryKey: (id: string) => ["gov", id],
  getListArtifactsQueryKey: () => ["artifacts"],
  getListF10SourcesQueryKey: () => ["sources"],
  getListSessionArtifactsQueryKey: (id: string) => ["session", id],
}));

import { GovernancePanel } from "./GovernancePanel";
import { governanceForExport, validateGovernanceSelection } from "./governance-selection";

const base = { artifactId: "a1", installed: true, status: "CRITERIA_INSTALLED", assessment: "NOT_EVALUATED", modules: ["GRO", "ZPOS", "HONESTY_GATE"], sourceContentHash: "abc", caveat: "PREPARATION ONLY." };
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
afterEach(() => { cleanup(); state.mutate.mockReset(); state.pending = false; });

describe("GovernancePanel", () => {
  it("shows installed status with caveat and no revision action", () => {
    state.query = { data: base, isLoading: false, isError: false };
    wrap(<GovernancePanel artifactId="a1" />);
    expect(screen.getByTestId("status-governance").textContent).toMatch(/Criteria installed/);
    expect(screen.getByTestId("text-governance-caveat").textContent).toMatch(/PREPARATION ONLY/);
    expect(screen.queryByTestId("button-governance-create-revision")).toBeNull();
  });

  it("legacy artifact offers explicit new revision and reports new id", () => {
    state.query = { data: { ...base, installed: false, status: "LEGACY_UNVERIFIED" }, isLoading: false, isError: false };
    const onRev = vi.fn();
    wrap(<GovernancePanel artifactId="a1" onRevisionCreated={onRev} />);
    fireEvent.click(screen.getByTestId("button-governance-create-revision"));
    expect(state.mutate).toHaveBeenCalledWith({ artifactId: "a1", data: { confirmCreateRevision: true } });
    state.onSuccess?.({ ...base, artifactId: "a2" });
    expect(onRev).toHaveBeenCalledWith(expect.objectContaining({ artifactId: "a2" }));
  });

  it("disables revision button while pending", () => {
    state.query = { data: { ...base, installed: false, status: "LEGACY_UNVERIFIED" }, isLoading: false, isError: false };
    state.pending = true;
    wrap(<GovernancePanel artifactId="a1" />);
    expect((screen.getByTestId("button-governance-create-revision") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows retry on error", () => {
    const refetch = vi.fn();
    state.query = { data: undefined, isLoading: false, isError: true, error: new Error("x"), refetch };
    wrap(<GovernancePanel artifactId="a1" />);
    fireEvent.click(screen.getByTestId("button-governance-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("fragmented selection shows partial caveat; empty selection is invalid", () => {
    state.query = { data: base, isLoading: false, isError: false };
    const onChange = vi.fn();
    wrap(<GovernancePanel artifactId="a1" selection={{ mode: "FRAGMENTED", modules: ["GRO"] }} onSelectionChange={onChange} />);
    expect(screen.getByTestId("text-governance-partial").textContent).toMatch(/ZPOS, Honesty Gate/);
    fireEvent.click(screen.getByTestId("checkbox-governance-GRO"));
    expect(onChange).toHaveBeenCalledWith({ mode: "FRAGMENTED", modules: [] });
  });
});

describe("governance selection", () => {
  it("validates FULL/FRAGMENTED rules", () => {
    expect(validateGovernanceSelection({ mode: "FULL", modules: ["GRO", "ZPOS", "HONESTY_GATE"] })).toBeNull();
    expect(validateGovernanceSelection({ mode: "FULL", modules: ["GRO"] })).not.toBeNull();
    expect(validateGovernanceSelection({ mode: "FRAGMENTED", modules: [] })).not.toBeNull();
    expect(validateGovernanceSelection({ mode: "FRAGMENTED", modules: ["GRO", "ZPOS", "HONESTY_GATE"] })).not.toBeNull();
    expect(validateGovernanceSelection({ mode: "FRAGMENTED", modules: ["GRO", "GRO"] })).not.toBeNull();
  });
  it("excludes governance for non MA/SPC", () => {
    expect(governanceForExport("PDD", { mode: "FULL", modules: ["GRO", "ZPOS", "HONESTY_GATE"] })).toEqual({});
    expect(governanceForExport("MA", { mode: "FRAGMENTED", modules: ["ZPOS"] })).toEqual({ governance: { mode: "FRAGMENTED", modules: ["ZPOS"] } });
  });
});
