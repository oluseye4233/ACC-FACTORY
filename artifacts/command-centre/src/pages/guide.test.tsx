// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Guide from "./guide";

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
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
    expect(screen.getByText("VIBE ORACLE")).toBeTruthy();
    expect(screen.getByText("PLAN / SCAN")).toBeTruthy();
    expect(screen.getByText("HOST ORACLE")).toBeTruthy();
    expect(screen.getByText("ASSURANCE OVERLAYS")).toBeTruthy();
    expect(screen.getAllByText("SPC PLAYER")[0]).toBeTruthy();
  });
});
