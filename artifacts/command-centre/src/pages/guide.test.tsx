// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Guide from "./guide";

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
const svc = (id: string, over: Record<string, unknown> = {}) => ({
  id, title: `Service ${id}`, scope: "STAGE", stage: id, implementation: "EXISTING", serviceMode: "PRIVATE",
  serviceReadiness: "EXISTING_UNVERIFIED", subscriberOutcome: `Outcome ${id}`, limitations: `Limit ${id}`,
  blockedReason: null, href: "/command", sourceEligibility: "NOT_EVALUATED", entitlement: "NOT_EVALUATED",
  assessmentStatus: "NOT_EVALUATED", deliveryStatus: "NOT_EVALUATED", operationStatus: "NOT_EVALUATED",
  localAcceptance: "NOT_VERIFIED", productionAcceptance: "NOT_VERIFIED", evidenceCheckedAt: null,
  requiredEvidence: ["Runtime acceptance record"], ...over,
});
vi.mock("@workspace/api-client-react", () => ({
  getGetPlatformServicesQueryKey: () => ["/api/platform-services"],
  useGetPlatformServices: () => ({
    data: {
      schemaVersion: "1", inventoryUpdatedAt: "2026-10-20T00:00:00Z", generatedAt: "2026-10-21T00:00:00Z",
      evidencePolicy: "Source review is not runtime acceptance.", totalServices: 3, stageServices: 2,
      supportingServices: 1, localAccepted: 0, productionAccepted: 0,
      services: [
        svc("F0"),
        svc("F12", { title: "Full F12 operation", implementation: "PLANNED", serviceReadiness: "PLANNED", href: null, limitations: "Not launched" }),
        svc("COSTS", { scope: "FUNCTION", stage: null, title: "Cost views", href: "/me/costs" }),
      ],
      upgradeClasses: [{ category: "B", description: "Deferred hardening", activationTrigger: "Enterprise demand" }],
    },
  }),
}));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

// Mock asset imports
vi.mock("@assets/The_48-Hour_Divergence_1779502673339.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/FORGE_Factory_Floor_1779502866103.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/The_Intelligence_Asset__Beyond_the_Code_Barrier_1779539479111.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/ATANDA__Risk_to_Rigor_1779543682393.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/Harness_Engineering_1779544662971.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/Engineering_Clinical_Intuition_1780237497894.mp4", () => ({ default: "video.mp4" }));
vi.mock("@assets/Solving_The_Code_Gap_1780266687323.mp4", () => ({ default: "video.mp4" }));

vi.mock("@assets/Instrumenting_Cognition_1779502799785.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/ATANDA_Command_Centre_1779502924595.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/The_Cognitive_Mint_1779539510121.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/The_Deterministic_Vault_1779543698477.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/Harness_Engineering_Blueprint_1779544662970.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/Engineering_Clinical_Intuition_1780237497892.pdf", () => ({ default: "paper.pdf" }));
vi.mock("@assets/The_Rise_of_Cognitive_Engineering_1780266687323.pdf", () => ({ default: "paper.pdf" }));

vi.mock("@assets/guide/command.png", () => ({ default: "command.png" }));
vi.mock("@assets/guide/command.gif", () => ({ default: "command.gif" }));
vi.mock("@assets/guide/sessions.png", () => ({ default: "sessions.png" }));
vi.mock("@assets/guide/sessions.gif", () => ({ default: "sessions.gif" }));
vi.mock("@assets/guide/f0.png", () => ({ default: "f0.png" }));
vi.mock("@assets/guide/f0.gif", () => ({ default: "f0.gif" }));
vi.mock("@assets/guide/ingest.png", () => ({ default: "ingest.png" }));
vi.mock("@assets/guide/cartridge.png", () => ({ default: "cartridge.png" }));
vi.mock("@assets/guide/exemplars.png", () => ({ default: "exemplars.png" }));
vi.mock("@assets/guide/prompts.png", () => ({ default: "prompts.png" }));
vi.mock("@assets/guide/quests.png", () => ({ default: "quests.png" }));
vi.mock("@assets/guide/ascension.png", () => ({ default: "ascension.png" }));
vi.mock("@assets/guide/ascension.gif", () => ({ default: "ascension.gif" }));
vi.mock("@assets/guide/activity.png", () => ({ default: "activity.png" }));
vi.mock("@assets/guide/costs.png", () => ({ default: "costs.png" }));
vi.mock("@assets/guide/account.png", () => ({ default: "account.png" }));
vi.mock("@assets/guide/verify.png", () => ({ default: "verify.png" }));

afterEach(cleanup);

describe("Guide Page - ATANDA Site Map", () => {
  it("renders the ATANDA site map section with correct data-testids", () => {
    render(<Guide />);

    expect(screen.getAllByText("ATANDA SITE MAP")[0]).toBeTruthy();

    const expectedIds = ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f9-5", "f10"];
    
    expectedIds.forEach(id => {
      expect(screen.getByTestId(`guide-role-${id}`)).toBeTruthy();
    });

    // Check F10 lanes
    expect(screen.getByText("1. Signed F9 Release")).toBeTruthy();
    expect(screen.getByText("2. Multi-Artifact Export")).toBeTruthy();
    expect(screen.getByText("3. Native Provider Deployment")).toBeTruthy();

    // Check side-steps
    expect(screen.getByText("CODE ONE +")).toBeTruthy();
    expect(screen.getByText("PLAN / SCAN")).toBeTruthy();
    expect(screen.getByText("HOST ORACLE")).toBeTruthy();
    expect(screen.getByText("ASSURANCE OVERLAYS")).toBeTruthy();
    expect(screen.getAllByText("SPC PLAYER")[0]).toBeTruthy();
  });

  it("renders API inventory honestly without static dated claims", () => {
    const { container } = render(<Guide />);
    expect(screen.getByRole("heading", { name: "CURRENT PLATFORM STATUS" })).toBeTruthy();
    expect(screen.getAllByTestId(/^guide-platform-service-/)).toHaveLength(3);
    expect(screen.queryByText(/17 October/)).toBeNull();
    expect(screen.getByText(/Available does not mean unrestricted/)).toBeTruthy();
    const f12 = screen.getByTestId("guide-platform-service-F12");
    expect(within(f12).getByText("PLANNED · NOT LAUNCHED")).toBeTruthy();
    expect(within(f12).queryByRole("link")).toBeNull();
    expect(container.querySelector('a[href="/f12"]')).toBeNull();
    expect(screen.getByTestId("link-service-COSTS").getAttribute("href")).toBe("/me/costs");
    expect(screen.getByTestId("text-accepted-explainer").textContent).toContain("does not mean zero working features");
    expect(screen.getByTestId("upgrade-class-B").textContent).toContain("Enterprise demand");
    expect(screen.getByRole("link", { name: "Check current readiness" }).getAttribute("href")).toBe("/status");
  });

  it("documents PDF limits, preparation navigation and historical illustrations without false screenshots", () => {
    render(<Guide />);
    const ingestion = screen.getByTestId("guide-walkthrough-ingest");
    expect(ingestion.textContent).toContain("maximum 1 MB");
    expect(ingestion.textContent).toContain("scanned PDFs need OCR");
    const operations = screen.getByTestId("guide-walkthrough-operations");
    expect(within(operations).getByRole("link", { name: /OPEN ARTIFACT OPERATIONS/ }).getAttribute("href")).toBe("/operations");
    expect(operations.textContent).toContain("Private preparation");
    expect(screen.queryByTestId("guide-shot-spc-player")).toBeNull();
    expect(screen.queryByTestId("guide-shot-atlas360")).toBeNull();
    expect(screen.queryByText("Live screenshot")).toBeNull();
    expect(screen.getAllByText("Reference screenshot").length).toBeGreaterThan(0);
  });
});
