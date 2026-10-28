// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("@/components/boomerang", () => ({
  BoomerangPanel: ({ stage }: { stage: string }) => <div data-testid="mock-boomerang-panel" data-stage={stage} />,
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: Record<string, unknown>) => <a href={href as string} {...rest}>{children as React.ReactNode}</a>,
}));
import { StageOptionalTools, ReturnToStageBanner } from "./StageOptionalTools";

afterEach(cleanup);

describe("StageOptionalTools", () => {
  it("explains each tool with a return-to-stage section", () => {
    render(<StageOptionalTools sessionId="s1" featureId={4} stageLabel="F4" isSessionOwner />);
    for (const id of ["boomerang", "spc-player", "f0"]) {
      const box = screen.getByTestId(`tool-${id}`);
      for (const term of ["What it does", "Outcome", "How to use", "Return to this stage"]) {
        expect(box.textContent).toContain(term);
      }
    }
    expect(screen.getByTestId("tool-spc-player").textContent).toContain("RETURN TO THE STAGE YOU LEFT WITH NEW ARTIFACT AND CONTINUE PRODUCTION");
    expect(screen.getByTestId("tool-f0").textContent).toContain("not automatically adopted");
    expect(screen.getByTestId("tool-f0").textContent).toContain("Return to F4");
  });
});

describe("ReturnToStageBanner", () => {
  it("links to the exact origin stage", () => {
    render(<ReturnToStageBanner sessionId="s1" featureId={9} stageLabel="F8" note="n" />);
    const link = screen.getByTestId("link-return-to-stage");
    expect(link.getAttribute("href")).toBe("/session/s1?featureId=9#stage-optional-tools");
    expect(link.textContent).toContain("Return to F8");
  });
});
