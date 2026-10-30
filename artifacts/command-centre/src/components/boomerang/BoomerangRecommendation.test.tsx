// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BoomerangRecommendation } from "./BoomerangRecommendation";
vi.mock("@/components/shared/JevShadowAdvice", () => ({ JevShadowAdvice: () => <div>JEV shadow adviser</div> }));
const fixture = vi.hoisted(() => ({ value: {
  status: "REWORK_RECOMMENDED", sourceArtifactId: "exact-artifact", sourceName: "Example artifact", jcseScore: 44,
  mathmonScore: null, findings: ["Clarify input contracts"], reingestionRequired: true,
}, isError: false }));
vi.mock("@workspace/api-client-react", () => ({ useGetBoomerangRemediation: () => ({
  data: fixture.value, isError: fixture.isError, isLoading: false,
}) }));
afterEach(() => { cleanup(); fixture.isError = false; });
describe("Boomerang remediation recommendation", () => {
  it("pins the exact artifact and canonical engine ID, displays shortcomings, and requests remediation", () => {
    render(<BoomerangRecommendation originId="session" stage="F8" />);
    const link = screen.getByTestId("button-score-rework");
    const query = new URL(link.getAttribute("href")!, "http://localhost").searchParams;
    expect(query.get("sourceArtifactId")).toBe("exact-artifact");
    expect(query.get("originFeatureId")).toBe("9");
    expect(query.get("scoreRemediation")).toBe("1");
    expect(screen.getByText("Clarify input contracts")).toBeTruthy();
    expect(screen.getByText(/MATHMON: NOT RUN/)).toBeTruthy();
  });
  it("offers no rework shortcut when evaluation evidence cannot be loaded", () => {
    fixture.isError = true;
    render(<BoomerangRecommendation originId="session" stage="F5" />);
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
    expect(screen.queryByTestId("button-score-rework")).toBeNull();
  });
});
