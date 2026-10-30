// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), invalidate: vi.fn(), refetch: vi.fn(),
  tier: "PRACTITIONER", report: undefined as unknown, error: false }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@workspace/api-client-react", () => ({
  useGetMe: () => ({ data: { subscriber: { tier: mocks.tier } } }),
  useGetJevShadowReports: () => ({ data: mocks.report ? [mocks.report] : [], isError: mocks.error, refetch: mocks.refetch }),
  getGetJevShadowReportsQueryKey: (p: unknown) => ["shadow", p],
  useRunJevShadow: () => ({ mutateAsync: mocks.mutate, isPending: false }),
}));
import { JevShadowAdvice } from "./JevShadowAdvice";
const props = { sessionId: "session", featureId: 8, kind: "MODEL_ROUTING" as const };
beforeEach(() => {
  mocks.mutate.mockReset().mockResolvedValue({});
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  mocks.refetch.mockReset();
  mocks.tier = "PRACTITIONER"; mocks.report = undefined; mocks.error = false;
});
afterEach(cleanup);
describe("JEV optional shadow adviser", () => {
  it("does not run a paid check on mount and requires the explicit credits-labelled action", async () => {
    render(<JevShadowAdvice {...props} />);
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Run JEV shadow check (uses credits)"));
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    expect(mocks.mutate).toHaveBeenCalledWith({ data: { ...props, requestKey: expect.any(String) } });
  });
  it("shows saved typed recommendations but offers no apply or advance action", () => {
    mocks.report = { id: "saved", status: "COMPLETED", createdAt: "2026-10-29T12:00:00Z", modelId: "jev-1.14.0", snapshotHash: "hash",
      result: { choice: "mistral", confidence: 0.8, needsReviewProbability: 0.3 } };
    render(<JevShadowAdvice {...props} />);
    expect(screen.getByText("mistral")).toBeTruthy();
    expect(screen.getByText(/Not calibrated against ACC/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /apply|advance/i })).toBeNull();
    fireEvent.click(screen.getByText(/Refresh saved advice/));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("blocks Explorer paid checks", () => {
    mocks.tier = "EXPLORER";
    render(<JevShadowAdvice {...props} />);
    expect((screen.getByText("Run JEV shadow check (uses credits)") as HTMLButtonElement).disabled).toBe(true);
  });
  it("retains the idempotency key after an ambiguous error", async () => {
    mocks.mutate.mockRejectedValue(new Error("network"));
    render(<JevShadowAdvice {...props} />);
    fireEvent.click(screen.getByText("Run JEV shadow check (uses credits)"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByText("Run JEV shadow check (uses credits)"));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    expect(mocks.mutate.mock.calls[0]![0].data.requestKey).toBe(mocks.mutate.mock.calls[1]![0].data.requestKey);
  });
});
