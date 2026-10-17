// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const visibilityMutate = vi.fn();
const sphinxCatalog = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@workspace/api-client-react", () => ({
  getListExemplarsQueryKey: () => ["/api/exemplars"],
  getGetExemplarQueryKey: (id: string) => [`/api/exemplars/${id}`],
  getGetSphinxCatalogQueryKey: () => ["/api/sphinx/catalog"],
  getGetSphinxMarketplaceStatusQueryKey: () => ["/api/sphinx/status"],
  useUpdateExemplarVisibility: () => ({ mutateAsync: visibilityMutate, isPending: false }),
  useGetSphinxCatalog: () => sphinxCatalog(),
}));

import { applyCatalogFilters, DEFAULT_FILTERS, discoveryStatus, toInt, SEMVER_RE, type CatalogItem } from "@/lib/catalog";
import { ArtifactModeSwitch } from "@/components/exemplars/ArtifactModeSwitch";
import { validateReview } from "@/components/exemplars/QualificationReviewForm";
import Sphinx from "@/pages/sphinx";

const base = (o: Partial<CatalogItem>): CatalogItem =>
  ({
    id: "x",
    title: "Item",
    tagline: "tag",
    jcse: 40,
    certClass: null,
    sku: "SKU-1",
    source: "hand_authored",
    kind: "SPC",
    marketplace: "open",
    disc: null,
    spcPlayer: null,
    active: true,
    artifactMode: "LIBRARY_ARTIFACT",
    isOwner: true,
    eligibility: { eligible: true, reasons: [] },
    ...o,
  }) as CatalogItem;

const wrap = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  visibilityMutate.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("catalog filters", () => {
  const items = [
    base({ id: "a", title: "Alpha", kind: "SPC", jcse: 30 }),
    base({ id: "b", title: "Beta", kind: "MA", jcse: 48, artifactMode: "SPHINX_ARTIFACT", isOwner: false }),
    base({ id: "c", title: "Gamma", kind: "F0_REPORT", eligibility: { eligible: false, reasons: ["F0"] } }),
    base({ id: "d", title: "Delta", active: false }),
  ];
  it("filters kind, mode, ownership, eligibility and hides archived", () => {
    expect(applyCatalogFilters(items, DEFAULT_FILTERS).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, kinds: ["MA"] }).map((i) => i.id)).toEqual(["b"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, mode: "sphinx" }).map((i) => i.id)).toEqual(["b"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, mineOnly: true }).map((i) => i.id)).toEqual(["a", "c"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, eligibility: "not_eligible" }).map((i) => i.id)).toEqual(["c"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, includeArchived: true }).length).toBe(4);
  });
  it("searches and sorts by JCSE", () => {
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, q: "gam" }).map((i) => i.id)).toEqual(["c"]);
    expect(applyCatalogFilters(items, { ...DEFAULT_FILTERS, sort: "jcse_desc" })[0].id).toBe("b");
  });
  it("labels Sphinx selection as queued when closed, never for sale", () => {
    const s = base({ artifactMode: "SPHINX_ARTIFACT" });
    expect(discoveryStatus(s, false).label).toMatch(/queued - not public/i);
    expect(discoveryStatus(s, true).label).toMatch(/publicly discoverable/i);
  });
});

describe("ArtifactModeSwitch", () => {
  it("is disabled when not eligible and not Sphinx", () => {
    wrap(<ArtifactModeSwitch item={base({ id: "n", eligibility: { eligible: false, reasons: ["JCSE below 35"] } })} publicOpen={false} />);
    expect((screen.getByTestId("switch-sphinx-n") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/JCSE below 35/)).toBeTruthy();
  });
  it("requires consent before opting in and sends commercialConsent", async () => {
    wrap(<ArtifactModeSwitch item={base({ id: "e" })} publicOpen={false} />);
    fireEvent.click(screen.getByTestId("switch-sphinx-e"));
    expect(visibilityMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/future launch/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-confirm-accept"));
    await waitFor(() =>
      expect(visibilityMutate).toHaveBeenCalledWith({ id: "e", data: { artifactMode: "SPHINX_ARTIFACT", commercialConsent: true } }),
    );
  });
  it("always allows turning Sphinx off even when no longer eligible", async () => {
    wrap(
      <ArtifactModeSwitch
        item={base({ id: "s", artifactMode: "SPHINX_ARTIFACT", eligibility: { eligible: false, reasons: ["revoked"] } })}
        publicOpen
      />,
    );
    const sw = screen.getByTestId("switch-sphinx-s");
    expect((sw as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sw);
    await waitFor(() => expect(visibilityMutate).toHaveBeenCalledWith({ id: "s", data: { artifactMode: "LIBRARY_ARTIFACT" } }));
  });
  it("shows status only for non-owners", () => {
    wrap(<ArtifactModeSwitch item={base({ id: "o", isOwner: false })} publicOpen />);
    expect(screen.queryByTestId("switch-sphinx-o")).toBeNull();
    expect(screen.getByTestId("status-mode-o")).toBeTruthy();
  });
});

describe("review validation", () => {
  it("does not silently truncate fractional review scores and accepts version build metadata", () => {
    expect(Number.isNaN(toInt("35.5"))).toBe(true);
    expect(Number.isNaN(toInt("35junk"))).toBe(true);
    expect(toInt("35")).toBe(35);
    expect(SEMVER_RE.test("1.0.0+build.1")).toBe(true);
    expect(SEMVER_RE.test("01.0.0")).toBe(false);
  });
  it("enforces approval baseline", () => {
    const e = validateReview({
      decision: "APPROVED",
      notes: "short",
      jcse: "20",
      tokenCount: "abc",
      version: "1.0",
      documentation: "doc",
      tests: "ok",
      rightsCleared: false,
      safetyReviewed: false,
    });
    expect(Object.keys(e).sort()).toEqual(
      ["documentation", "jcse", "notes", "rightsCleared", "safetyReviewed", "tests", "tokenCount", "version"].sort(),
    );
  });
});

describe("public Sphinx page", () => {
  it("shows closed state", () => {
    sphinxCatalog.mockReturnValue({ data: { publicOpen: false, items: [] }, isLoading: false, isError: false });
    wrap(<Sphinx />);
    expect(screen.getByTestId("sphinx-closed")).toBeTruthy();
    expect(screen.getByTestId("text-commerce-notice").textContent).toMatch(/not activated/i);
  });
  it("shows open catalog without internal links", () => {
    sphinxCatalog.mockReturnValue({
      data: { publicOpen: true, items: [base({ id: "p", title: "Public One", artifactMode: "SPHINX_ARTIFACT" })] },
      isLoading: false,
      isError: false,
    });
    const { container } = wrap(<Sphinx />);
    expect(screen.getByText("Public One")).toBeTruthy();
    expect(container.querySelector('a[href*="/exemplars"]')).toBeNull();
  });
  it("shows error with retry", () => {
    const refetch = vi.fn();
    sphinxCatalog.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("boom"), refetch });
    wrap(<Sphinx />);
    fireEvent.click(screen.getByTestId("button-retry-catalog"));
    expect(refetch).toHaveBeenCalled();
  });
});
