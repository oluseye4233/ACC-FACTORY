// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LaunchReadiness } from "@workspace/api-client-react";

const query = vi.hoisted(() => vi.fn());
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  useGetLaunchReadiness: query,
}));

import { LaunchReadinessPanel } from "./LaunchReadinessPanel";

const ready: LaunchReadiness = {
  buildReady: true, database: "available", ai: "configured",
  deferred: [], checkedAt: "2026-10-20T16:00:00.000Z",
};
const result = (data: LaunchReadiness | undefined = ready) => ({
  data, isError: false, isLoading: false, isFetching: false, refetch: vi.fn(),
});
afterEach(() => { cleanup(); query.mockReset(); });

describe("dependency status accessibility and recovery", () => {
  it("provides named busy state and semantic dependency terms without claiming full readiness", () => {
    query.mockReturnValue(result());
    render(<LaunchReadinessPanel />);
    expect(screen.getByRole("region", { name: "Database and AI dependency status" }).getAttribute("aria-busy")).toBe("false");
    expect(screen.getAllByRole("term").map(n => n.textContent)).toEqual(["Database", "AI provider key"]);
    expect(screen.getAllByRole("definition").map(n => n.textContent)).toEqual(["AVAILABLE", "CONFIGURED"]);
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
    expect(screen.getByText(/not full feature or certification readiness/)).toBeTruthy();
  });

  it("announces unknown status on failed refresh, not a false outage or cached green result", () => {
    query.mockReturnValue({ ...result(), isError: true });
    render(<LaunchReadinessPanel />);
    expect(screen.getByRole("status").textContent).toBe("STATUS UNKNOWN");
    expect(screen.getByRole("alert").textContent).toContain("unknown, not confirmed down");
    expect(screen.queryByTestId("launch-readiness-db-down")).toBeNull();
  });

  it("announces a confirmed unavailable database without requesting credentials", () => {
    query.mockReturnValue(result({ ...ready, buildReady: false, database: "unavailable" }));
    render(<LaunchReadinessPanel />);
    expect(screen.getByRole("alert").textContent).toContain("Never share credentials");
    expect(screen.getByRole("status").textContent).toBe("DEPENDENCIES NOT READY");
  });

  it("retries and exposes pending state without allowing duplicate clicks", () => {
    const q = result();
    query.mockReturnValue(q);
    const { rerender } = render(<LaunchReadinessPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(q.refetch).toHaveBeenCalledOnce();
    query.mockReturnValue({ ...q, isFetching: true });
    rerender(<LaunchReadinessPanel />);
    expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Checking…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("removes announced errors after successful recovery", () => {
    query.mockReturnValue({ ...result(), isError: true });
    const { rerender } = render(<LaunchReadinessPanel />);
    query.mockReturnValue(result());
    rerender(<LaunchReadinessPanel />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("DEPENDENCIES READY");
  });

  it("allows narrow layouts to wrap status controls and long deferred requirements", () => {
    query.mockReturnValue(result({ ...ready, deferred: ["A".repeat(300)] }));
    render(<LaunchReadinessPanel />);
    expect(screen.getByRole("status").parentElement?.className).toContain("flex-wrap");
    expect(screen.getByText("A".repeat(300)).className).toContain("break-words");
  });
});
