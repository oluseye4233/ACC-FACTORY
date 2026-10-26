// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HarnessArtifact } from "@workspace/api-client-react";
import { ReturnedUpgrade, returnedUpgradeHref } from "./ReturnedUpgrade";
import { resolveSpcPlayerSource } from "@workspace/artifact-naming";

afterEach(cleanup);
const artifact = {
  id: "upgrade-1", sessionId: "session", featureId: 5, artifactType: "SPC_PLAYER_SUPPORT",
  name: "Evidence mapper · Upgraded 1", parentArtifactId: "original", createdAt: "2026-10-25T10:00:00Z",
  artifactContent: { advisoryOnly: true, planOnly: true, boomerangUpgrade: {
    number: 1, label: "Upgraded 1", rootArtifactId: "original", parentArtifactId: "original",
  } },
} as unknown as HarnessArtifact;
describe("returned upgrade identity", () => {
  it("shows the version and links to the exact returned artifact and next rework", () => {
    render(<ReturnedUpgrade artifact={artifact} featureId={5} />);
    expect(screen.getByRole("heading").textContent).toBe("Upgraded 1 · F5");
    expect(screen.getByRole("link", { name: "Link to this returned artifact" }).getAttribute("href"))
      .toBe(returnedUpgradeHref("session", 5, "upgrade-1"));
    expect(screen.getByRole("link", { name: "Rework this version again" }).getAttribute("href"))
      .toContain("sourceArtifactId=upgrade-1");
    expect(screen.getByText(/A revised candidate, not a gate pass/)).toBeTruthy();
  });
  it("allows only explicit same-stage returned candidates, never implicit or cross-project substitution", () => {
    expect(resolveSpcPlayerSource([artifact], { sessionId: "session", featureId: 5 })).toBeUndefined();
    expect(resolveSpcPlayerSource([artifact], { sessionId: "session", featureId: 5, sourceArtifactId: artifact.id })).toBe(artifact);
    expect(resolveSpcPlayerSource([artifact], { sessionId: "foreign", featureId: 5, sourceArtifactId: artifact.id })).toBeUndefined();
    expect(resolveSpcPlayerSource([artifact], { sessionId: "session", featureId: 7, sourceArtifactId: artifact.id })).toBeUndefined();
  });
});
