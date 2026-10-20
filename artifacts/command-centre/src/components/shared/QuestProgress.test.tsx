// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const hook = vi.hoisted(() => vi.fn());
vi.mock("@workspace/api-client-react", () => ({
  useListMyBadges: hook,
  getListMyBadgesQueryKey: () => ["/api/badges/me"],
}));
vi.mock("wouter", () => ({ Link: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

import { QuestProgress } from "./QuestProgress";
import { Button } from "@/components/ui/button";

const base = { refetch: vi.fn(), isFetching: false, isLoading: false, isError: false };
const badge = (o: any) => ({ eligible: false, progress: {}, requirements: {}, status: "LOCKED", ...o });

afterEach(() => { cleanup(); hook.mockReset(); });

describe("QuestProgress", () => {
  it("uses fresh, non-retrying query options", () => {
    hook.mockReturnValue({ ...base, data: [] });
    render(<QuestProgress />);
    expect(hook.mock.calls[0][0].query).toMatchObject({ refetchOnMount: "always", staleTime: 0, refetchInterval: 60000, refetchOnWindowFocus: true, retry: false });
  });
  it("shows skeleton while loading", () => {
    hook.mockReturnValue({ ...base, isLoading: true });
    render(<QuestProgress />);
    expect(screen.getByTestId("quest-progress-loading")).toBeTruthy();
  });
  it("shows error with retry", () => {
    const refetch = vi.fn();
    hook.mockReturnValue({ ...base, isError: true, refetch });
    render(<QuestProgress />);
    fireEvent.click(screen.getByTestId("button-retry-quest-progress"));
    expect(refetch).toHaveBeenCalled();
  });
  it("distinguishes revoked, claim pending, earned and unknown", () => {
    hook.mockReturnValue({ ...base, data: [
      badge({ badgeId: "ASPE", status: "UNLOCKED", requirements: { spcs: 3 }, progress: { spcs: 3 } }),
      badge({ badgeId: "AISE", eligible: true, requirements: { urls: 1 }, progress: { urls: 1 } }),
      badge({ badgeId: "AISE_BUILD", status: "REVOKED" }),
      badge({ badgeId: "AISA", requirements: { pdds: 2 }, progress: { pdds: 1 } }),
    ] });
    render(<QuestProgress />);
    expect(screen.getByTestId("status-quest-ASPE").textContent).toBe("EARNED");
    expect(screen.getByTestId("status-quest-AISE").textContent).toBe("CLAIM PENDING");
    expect(screen.getByTestId("status-quest-AISE_BUILD").textContent).toBe("REVOKED");
    expect(screen.getByTestId("unknown-quest-AISE_BUILD")).toBeTruthy();
    expect(screen.getByTestId("status-quest-AISA_PWDD").textContent).toBe("NOT REPORTED");
    const bar = screen.getByRole("progressbar", { name: "AISA pdds" });
    expect(bar.getAttribute("aria-valuetext")).toBe("1 of 2");
  });
});

describe("Button progression", () => {
  it("adds glow without forwarding the prop", () => {
    render(<Button progression>Next</Button>);
    const b = screen.getByRole("button");
    expect(b.className).toContain("progression-glow");
    expect(b.hasAttribute("progression")).toBe(false);
  });
  it("never glows when disabled", () => {
    render(<Button progression disabled>Next</Button>);
    expect(screen.getByRole("button").className).not.toContain("progression-glow");
  });
  it("never glows while busy or aria-disabled", () => {
    const { rerender } = render(<Button progression aria-busy="true">Next</Button>);
    expect(screen.getByRole("button").className).not.toContain("progression-glow");
    rerender(<Button progression aria-disabled="true">Next</Button>);
    expect(screen.getByRole("button").className).not.toContain("progression-glow");
  });
  it("does not animate ordinary or destructive controls without opt-in", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).not.toContain("progression-glow");
  });
});
