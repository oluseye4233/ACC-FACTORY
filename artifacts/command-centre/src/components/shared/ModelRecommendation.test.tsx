// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  useGetLlmRecommendation: mocks.query,
  useGetMe: () => ({ data: { subscriber: { tier: "PRACTITIONER" } } }),
  useUpdateSession: () => ({ mutate: mocks.mutate, isPending: false }),
  getGetSessionQueryKey: (id: string) => ["session", id],
}));
import { ModelRecommendation } from "./ModelRecommendation";
import { ProviderSelector } from "./ProviderSelector";
import { ProviderOverride } from "./ProviderOverride";

const data = {
  recommended: { provider: "qwen", modelId: "qwen/qwen3.7-plus", estimatedCostUsd: 0.00704 },
  complexity: "standard", reason: "Lowest estimated per-call cost in the balanced profile.",
  estimatedInputTokens: 6000, estimatedOutputTokens: 4000,
  candidates: [{ provider: "qwen", modelId: "qwen/qwen3.7-plus", estimatedCostUsd: 0.00704 }],
  disclaimer: "Optional suggestion. No quality guarantee. Starting an engine is separate.",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ data, isFetching: false, isError: false });
});
afterEach(cleanup);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Auto model suggestion" }));

describe("advisory-only model selector", () => {
  it("does not fetch, select or run anything until the user opens and applies a suggestion", () => {
    const apply = vi.fn();
    render(<ModelRecommendation featureId={5} onApply={apply} />);
    expect(mocks.query).not.toHaveBeenCalled();
    open();
    expect(screen.getByText("Qwen suggested")).toBeTruthy();
    expect(screen.getByText(/0.00704 USD per call/)).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested model" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith("qwen");
  });
  it("lets users adjust task complexity without changing the chosen provider", () => {
    const apply = vi.fn();
    render(<ModelRecommendation featureId={8} onApply={apply} />);
    open();
    fireEvent.change(screen.getByLabelText("Task complexity"), { target: { value: "complex" } });
    expect(mocks.query).toHaveBeenLastCalledWith(
      { featureId: 8, complexity: "complex" }, expect.any(Object),
    );
    expect(apply).not.toHaveBeenCalled();
  });
  it("keeps the choice unchanged when dismissed", () => {
    const apply = vi.fn();
    render(<ModelRecommendation onApply={apply} />);
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(apply).not.toHaveBeenCalled();
  });
  it("shows request failures without picking a fallback model", () => {
    mocks.query.mockReturnValue({ data: undefined, isFetching: false, isError: true });
    const apply = vi.fn();
    render(<ModelRecommendation onApply={apply} />);
    open();
    expect(screen.getByRole("alert").textContent).toContain("has not changed");
    expect(screen.queryByRole("button", { name: "Use suggested model" })).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
  it("does not offer apply when no provider qualifies", () => {
    mocks.query.mockReturnValue({ data: { ...data, recommended: null, candidates: [],
      reason: "No configured provider fits this profile." }, isFetching: false, isError: false });
    render(<ModelRecommendation onApply={vi.fn()} />);
    open();
    expect(screen.getByText("No configured provider fits this profile.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Use suggested model" })).toBeNull();
  });
  it("does not overwrite a selection with itself or allow changes while disabled", () => {
    const { unmount } = render(<ModelRecommendation onApply={vi.fn()} currentProvider="qwen" />);
    open();
    expect((screen.getByRole("button", { name: "Suggested model already selected" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<ModelRecommendation onApply={vi.fn()} disabled />);
    expect((screen.getByRole("button", { name: "Auto model suggestion" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("only updates the session preference after explicit apply", () => {
    render(<QueryClientProvider client={new QueryClient()}>
      <ProviderSelector sessionId="test-session" value="claude" featureId={5} />
    </QueryClientProvider>);
    open();
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested model" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      id: "test-session", data: { preferredModelProvider: "qwen" },
    }, expect.any(Object));
  });
  it("only sets the per-run override, not the session, in an engine workspace", () => {
    const onChange = vi.fn();
    render(<ProviderOverride value="session" featureId={5} onChange={onChange} />);
    open();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested model" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("qwen");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
