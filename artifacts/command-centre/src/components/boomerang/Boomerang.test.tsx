// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BoomerangCase } from "@workspace/api-client-react";

const mutate = vi.fn();
const createMutate = vi.fn();
let listData: BoomerangCase[] = [];
vi.mock("@workspace/api-client-react", () => ({
  useListBoomerangCases: () => ({ data: listData, isLoading: false, isError: false, refetch: vi.fn() }),
  getListBoomerangCasesQueryKey: (p?: unknown) => ["/api/boomerang/cases", ...(p ? [p] : [])],
  useTransitionBoomerangCase: () => ({ mutate, isPending: false }),
  useCreateBoomerangCase: () => ({ mutate: createMutate, isPending: false }),
  useGetBoomerangRemediation: () => ({ data: undefined, isLoading: false, isError: false }),
}));

import { BoomerangPanel } from "./BoomerangPanel";
import { BoomerangCaseCard } from "./BoomerangCaseCard";
import { returnError, stagesFor, STAGE_ENGINE_ID } from "./boomerang-model";

const RUN = "123e4567-e89b-12d3-a456-426614174000";
const mk = (o: Partial<BoomerangCase> = {}): BoomerangCase => ({
  id: "c1", originKind: "SESSION", originId: "aaaaaaaa-0000-0000-0000-000000000000", stage: "F5", title: "Market scan", brief: "Find competitor pricing data",
  sourceHash: "abcdef0123456789abcdef", state: "REQUESTED", version: 3, resultText: null, resultHash: null, spcPlayerRunId: null,
  history: [{ action: "CREATE", at: "2025-01-01T00:00:00Z", note: "", resultHash: null, resultText: null, spcPlayerRunId: null }],
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", sourceChanged: false, originAvailable: true, originHref: "/session/x",
  advisoryOnly: true, releaseAllowed: false, ...o,
});
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => { vi.clearAllMocks(); listData = []; });
afterEach(cleanup);

describe("boomerang model", () => {
  it("requires exactly one return source", () => {
    expect(returnError("", "")).toMatch(/Paste/);
    expect(returnError("long enough text", RUN)).toMatch(/not both/);
    expect(returnError("short", "")).toMatch(/10/);
    expect(returnError("", "nope")).toMatch(/UUID/);
    expect(returnError("", RUN)).toBeNull();
  });
  it("limits F0 to F0 and maps canonical engine ids", () => {
    expect(stagesFor("F0")).toEqual(["F0"]);
    expect(stagesFor("SESSION")).toContain("F9.5");
    expect(stagesFor("SESSION")).not.toContain("F0");
    expect(STAGE_ENGINE_ID["F8"]).toBe(9);
    expect(STAGE_ENGINE_ID["F6-VDJ"]).toBe(8);
    expect(STAGE_ENGINE_ID["F12"]).toBeNull();
  });
});

describe("BoomerangCaseCard", () => {
  it("exposes expansion state and names its return/review controls", () => {
    const view = wrap(<BoomerangCaseCard c={mk()} defaultOpen />);
    expect(screen.getByTestId("button-toggle-case-c1").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Completed SPC Player run UUID" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Returned supporting work" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-toggle-case-c1"));
    expect(screen.getByTestId("button-toggle-case-c1").getAttribute("aria-expanded")).toBe("false");
    view.unmount();
    wrap(<BoomerangCaseCard c={mk({ state: "RETURNED", resultText: "Supporting findings" })} defaultOpen />);
    expect(screen.getByRole("textbox", { name: "Review note (required for revision or reject)" })).toBeTruthy();
  });
  it("returns with run id and expectedVersion", () => {
    wrap(<BoomerangCaseCard c={mk()} defaultOpen />);
    fireEvent.change(screen.getByTestId("input-run-id-c1"), { target: { value: RUN } });
    fireEvent.click(screen.getByTestId("button-return-c1"));
    expect(mutate.mock.calls[0][0]).toEqual({ id: "c1", data: { action: "RETURN", spcPlayerRunId: RUN, expectedVersion: 3 } });
    expect(screen.getByTestId("link-spc-player-c1").getAttribute("href")).toBe(`/spc-player/new?sourceSessionId=${mk().originId}&originFeatureId=5`);
  });
  it("source drift disables return and accept", () => {
    wrap(<BoomerangCaseCard c={mk({ sourceChanged: true, state: "RETURNED", resultText: "returned work here" })} defaultOpen />);
    expect(screen.getByTestId("text-drift-c1").textContent).toMatch(/fresh request/);
    expect(screen.queryByTestId("panel-return-c1")).toBeNull();
    expect((screen.getByTestId("button-accept-c1") as HTMLButtonElement).disabled).toBe(true);
  });
  it("reject requires a note", () => {
    wrap(<BoomerangCaseCard c={mk({ state: "RETURNED", resultText: "returned work here" })} defaultOpen />);
    const rej = screen.getByTestId("button-reject-c1") as HTMLButtonElement;
    expect(rej.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-note-c1"), { target: { value: "wrong scope" } });
    fireEvent.click(rej);
    expect(mutate.mock.calls[0][0].data).toEqual({ action: "REJECT", note: "wrong scope", expectedVersion: 3 });
  });
  it("surfaces 409 conflicts", () => {
    mutate.mockImplementation((_v, o) => o.onError({ status: 409, data: { error: "Version conflict" } }));
    wrap(<BoomerangCaseCard c={mk()} defaultOpen />);
    fireEvent.click(screen.getByTestId("button-cancel-c1"));
    expect(screen.getByTestId("text-action-error-c1").textContent).toMatch(/Version conflict \(409\).*reloaded/);
  });
});

describe("BoomerangPanel", () => {
  it("provides persistent field labels with distinct IDs for multiple stage panels", () => {
    wrap(<><BoomerangPanel originKind="SESSION" originId="s1" stage="F5" /><BoomerangPanel originKind="SESSION" originId="s1" stage="F6" /></>);
    const titles = screen.getAllByLabelText("Request title (3–200 characters)") as HTMLInputElement[];
    const briefs = screen.getAllByLabelText("Supporting-work brief (10–8,000 characters)") as HTMLTextAreaElement[];
    expect(titles).toHaveLength(2);
    expect(titles[0].id).not.toBe(titles[1].id);
    expect(titles.every((field) => field.required && field.minLength === 3)).toBe(true);
    expect(briefs.every((field) => field.required && field.minLength === 10)).toBe(true);
    expect(screen.getByRole("form", { name: "Request F5 supporting work" }).getAttribute("aria-busy")).toBe("false");
  });
  it("read-only shows no owner data or controls", () => {
    listData = [mk()];
    wrap(<BoomerangPanel originKind="SESSION" originId="s1" stage="F5" readOnly />);
    expect(screen.getByTestId("text-boomerang-readonly")).toBeTruthy();
    expect(screen.queryByTestId("form-boomerang-create")).toBeNull();
    expect(screen.queryByTestId("card-boomerang-c1")).toBeNull();
  });
  it("creates for its origin and stage, F0 forced to F0", () => {
    wrap(<BoomerangPanel originKind="F0" originId="f0-1" stage="F3" />);
    fireEvent.change(screen.getByTestId("input-boomerang-title"), { target: { value: "Pricing" } });
    fireEvent.change(screen.getByTestId("input-boomerang-brief"), { target: { value: "Benchmark three vendors" } });
    fireEvent.click(screen.getByTestId("button-boomerang-create"));
    expect(createMutate.mock.calls[0][0]).toEqual({ data: { originKind: "F0", originId: "f0-1", stage: "F0", title: "Pricing", brief: "Benchmark three vendors" } });
    expect(screen.getByTestId("link-boomerang-workspace").getAttribute("href")).toContain("originKind=F0");
  });
});
