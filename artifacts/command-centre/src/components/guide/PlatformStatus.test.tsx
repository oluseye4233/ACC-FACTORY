// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

const refetch = vi.fn();
let state: Record<string, unknown> = {};
const hook = vi.fn(() => state);

vi.mock("@workspace/api-client-react", () => ({
  useGetPlatformServices: (opts: unknown) => hook(opts),
  getGetPlatformServicesQueryKey: () => ["/api/platform-services"],
}));

import { PlatformStatus } from "./PlatformStatus";

function svc(i: number, over: Record<string, unknown> = {}) {
  return {
    id: `S${i}`, title: `Service ${i}`, scope: i < 14 ? "STAGE" : "FUNCTION", stage: i < 14 ? `F${i}` : null,
    implementation: "EXISTING", serviceMode: "PRIVATE", serviceReadiness: "EXISTING_UNVERIFIED",
    subscriberOutcome: `Outcome ${i}`, limitations: `Limit ${i}`, blockedReason: null, href: "/command",
    sourceEligibility: "NOT_EVALUATED", entitlement: "NOT_EVALUATED", assessmentStatus: "NOT_EVALUATED",
    deliveryStatus: "NOT_EVALUATED", operationStatus: "NOT_EVALUATED", localAcceptance: "NOT_VERIFIED",
    productionAcceptance: "NOT_VERIFIED", evidenceCheckedAt: null, requiredEvidence: [`Evidence ${i}`], ...over,
  };
}
const services = Array.from({ length: 35 }, (_, i) =>
  i === 12
    ? svc(12, { id: "F12", stage: "F12", title: "Full F12 operation", implementation: "PLANNED", serviceReadiness: "PLANNED",
        subscriberOutcome: "Independent verification later", limitations: "Not launched", blockedReason: "Independent verifier absent", href: null })
    : svc(i));
const inventory = {
  schemaVersion: "1", inventoryUpdatedAt: "2026-10-20T00:00:00Z", generatedAt: "2026-10-21T00:00:00Z",
  evidencePolicy: "Source review is not runtime acceptance.", totalServices: 35, stageServices: 14, supportingServices: 21,
  localAccepted: 0, productionAccepted: 0, services,
  upgradeClasses: [
    { category: "B", description: "Deferred hardening", activationTrigger: "Enterprise customer" },
    { category: "C", description: "Optional extension", activationTrigger: "Demand signal" },
  ],
};

beforeEach(() => { refetch.mockReset(); hook.mockClear(); });
afterEach(cleanup);

describe("PlatformStatus", () => {
  it("preserves a date-only inventory revision without a timezone shift or invented check time", () => {
    state = { data: { ...inventory, inventoryUpdatedAt: "2026-10-28" }, refetch };
    render(<PlatformStatus />);
    expect(screen.getByTestId("text-inventory-updated").textContent).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date("2026-10-28")),
    );
  });
  it("passes required query defaults", () => {
    state = { isLoading: true };
    render(<PlatformStatus />);
    expect(hook).toHaveBeenCalledWith({ query: expect.objectContaining({ staleTime: 60000, refetchOnWindowFocus: true, retry: false }) });
    expect(screen.getByTestId("platform-status-loading")).toBeTruthy();
    expect(screen.queryByText(/17 October/)).toBeNull();
    expect(screen.getByRole("link", { name: "Check current readiness" }).getAttribute("href")).toBe("/status");
  });

  it("shows error with retry and no static fallback", () => {
    state = { isError: true, refetch, isFetching: false };
    render(<PlatformStatus />);
    expect(screen.getByTestId("platform-status-error")).toBeTruthy();
    expect(screen.queryAllByTestId(/guide-platform-service-/)).toHaveLength(0);
    fireEvent.click(screen.getByTestId("button-retry-platform-status"));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders all records, honest counts, F12 planned without launch link, and no active claims", () => {
    state = { data: inventory };
    const { container } = render(<PlatformStatus />);
    expect(screen.getAllByTestId(/^guide-platform-service-/)).toHaveLength(35);
    expect(screen.getByTestId("text-accepted-explainer").textContent).toContain("does not mean zero working features");
    expect(screen.getByText(/Generation time is not a verification time/)).toBeTruthy();
    const f12 = screen.getByTestId("guide-platform-service-F12");
    expect(within(f12).getByText("Full F12 operation")).toBeTruthy();
    expect(within(f12).getByText("PLANNED · NOT LAUNCHED")).toBeTruthy();
    expect(f12.textContent).toContain("Independent verification later");
    expect(f12.textContent).toContain("Not launched");
    expect(f12.textContent).toContain("Independent verifier absent");
    expect(within(f12).queryByRole("link")).toBeNull();
    expect(container.querySelector('a[href="/f12"]')).toBeNull();
    expect(within(f12).getAllByText("NOT_VERIFIED")).toHaveLength(2);
    expect(container.textContent).not.toMatch(/\bACTIVE\b|\bLIVE\b|COMPLETE/);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(screen.getByTestId("upgrade-class-B").textContent).toContain("Enterprise customer");
    expect(screen.getByTestId("upgrade-class-C").textContent).toContain("Demand signal");
    fireEvent.click(screen.getByTestId("button-filter-function"));
    expect(screen.getAllByTestId(/^guide-platform-service-/)).toHaveLength(21);
    fireEvent.click(screen.getByTestId("button-evidence-S20"));
    expect(screen.getByText("Evidence 20")).toBeTruthy();
  });
});
