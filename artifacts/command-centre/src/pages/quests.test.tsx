// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BadgeProgress, ContextCraftBadge } from "@workspace/api-client-react";

const hooks = vi.hoisted(() => ({
  badges: vi.fn(), context: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  useListMyBadges: hooks.badges,
  useListMyContextCraftBadges: hooks.context,
  useGetMe: () => ({ data: { displayName: "Test Operator" } }),
  useListSessions: () => ({ data: [] }),
  useClaimAiseBadge: () => ({ mutateAsync: hooks.claim, isPending: false }),
  useClaimEngineerBadge: () => ({ mutateAsync: hooks.claim, isPending: false }),
}));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
// Shared progress has its own error-state tests; exercise the page sections here.
vi.mock("@/components/shared/QuestProgress", () => ({ QuestProgress: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import Quests from "./quests";

const query = <T,>(data: T) => ({
  data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
});
const pillar: ContextCraftBadge = {
  pillar: "SYSTEM", letter: "S", earned: true, bestScore: 7, maxScore: 10,
  threshold: 6, firstEarnedAt: null, evidenceArtifactId: null,
};
const revoked: BadgeProgress = {
  badgeId: "AISE", status: "REVOKED", eligible: false, progress: {},
  requirements: {}, evidence: {}, unlockedAt: null, claimedAt: null,
  revokedAt: null, revokedReason: "Evidence needs review", revocationCount: 1,
  restoredAt: null, restoredNote: null,
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Quest section recovery", () => {
  it("withholds all status-dependent claim areas on badge failure while preserving Context Craft", () => {
    const badges = { ...query(undefined), isError: true };
    hooks.badges.mockReturnValue(badges);
    hooks.context.mockReturnValue(query([pillar]));
    render(<Quests />);
    const alert = screen.getByRole("alert", { name: "Quest badges unavailable" });
    expect(alert.textContent).toContain("unavailable, not zero");
    expect(screen.getByTestId("pillar-system")).toBeTruthy();
    expect(screen.queryByText("SENIOR OPERATOR BADGES")).toBeNull();
    expect(screen.queryByText("CLAIM AISE")).toBeNull();
    expect(hooks.claim).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry Quest badges" }));
    expect(badges.refetch).toHaveBeenCalledOnce();
  });

  it("does not show zero earned when Context Craft fails, while retaining badge controls", () => {
    hooks.badges.mockReturnValue(query([revoked]));
    const context = { ...query(undefined), isError: true };
    hooks.context.mockReturnValue(context);
    render(<Quests />);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.queryByText("/ 7")).toBeNull();
    expect(screen.getByText("APPEAL AISE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry Context Craft" }));
    expect(context.refetch).toHaveBeenCalledOnce();
  });

  it("treats a failed background refresh as unavailable even with cached data", () => {
    hooks.badges.mockReturnValue({ ...query([revoked]), isError: true });
    hooks.context.mockReturnValue({ ...query([pillar]), isError: true });
    render(<Quests />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByTestId("pillar-system")).toBeNull();
    expect(screen.queryByText("APPEAL AISE")).toBeNull();
  });

  it("disables both retry controls while their requests run", () => {
    hooks.badges.mockReturnValue({ ...query(undefined), isError: true, isFetching: true });
    hooks.context.mockReturnValue({ ...query(undefined), isError: true, isFetching: true });
    render(<Quests />);
    for (const alert of screen.getAllByRole("alert")) {
      expect(alert.getAttribute("aria-busy")).toBe("true");
      expect((within(alert).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("restores earned pillars and revocation guidance when both requests recover", () => {
    hooks.badges.mockReturnValue({ ...query(undefined), isError: true });
    hooks.context.mockReturnValue({ ...query(undefined), isError: true });
    const { rerender } = render(<Quests />);
    hooks.badges.mockReturnValue(query([revoked]));
    hooks.context.mockReturnValue(query([pillar]));
    rerender(<Quests />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("pillar-system")).toBeTruthy();
    expect(screen.getByText("/ 7").parentElement?.textContent).toBe("1 / 7");
    expect(screen.getByText("APPEAL AISE")).toBeTruthy();
    expect(screen.getByTestId("text-aise-revoke-reason").textContent).toContain("Evidence needs review");
    expect(hooks.claim).not.toHaveBeenCalled();
  });

  it("keeps loading distinct from errors and does not offer claims before status arrives", () => {
    hooks.badges.mockReturnValue({ ...query(undefined), isLoading: true, isFetching: true });
    hooks.context.mockReturnValue({ ...query(undefined), isLoading: true, isFetching: true });
    render(<Quests />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("/ 7")).toBeNull();
    expect(screen.queryByText("CLAIM AISE")).toBeNull();
  });

  it("handles absent response data without pretending that status loaded", () => {
    hooks.badges.mockReturnValue(query(undefined));
    hooks.context.mockReturnValue(query(undefined));
    render(<Quests />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText("CLAIM AISE")).toBeNull();
  });

  it("preserves a successful empty response as zero earned, not a request failure", () => {
    hooks.badges.mockReturnValue(query([]));
    hooks.context.mockReturnValue(query([]));
    render(<Quests />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("/ 7").parentElement?.textContent).toBe("0 / 7");
  });
});
