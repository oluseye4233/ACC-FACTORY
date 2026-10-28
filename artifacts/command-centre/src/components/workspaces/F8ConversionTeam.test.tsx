// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { F8ConversionTeam } from "./F8ConversionTeam";

afterEach(cleanup);
describe("F8 collaboration display", () => {
  it("explains the combined conversion without adding a workflow stage", () => {
    render(<F8ConversionTeam hasBundle={false} />);
    expect(screen.getByText("How they work together")).toBeTruthy();
    expect(screen.getByText(/not independent agent/)).toBeTruthy();
    expect(screen.queryByText(/No CODE ORACLE \/ CODE DJ review was recorded/)).toBeNull();
  });
  it("does not credit legacy bundles with a review that did not happen", () => {
    render(<F8ConversionTeam hasBundle />);
    expect(screen.getByText(/No CODE ORACLE \/ CODE DJ review was recorded/)).toBeTruthy();
  });
  it("shows the recorded gap, code change and actual file paths after reload", () => {
    render(<F8ConversionTeam hasBundle review={{
      reviewStatus: "MODEL_REVIEW_NOT_INDEPENDENT",
      oracle: [{ requirement: "Owner boundary", gap: "Route lacked an owner filter", resolution: "CODE_CHANGE" }],
      dj: [{ requirement: "Owner boundary", change: "Added an owner predicate", files: ["src/routes.ts"] }],
    }} />);
    expect(screen.getByText("CODE ORACLE: Route lacked an owner filter")).toBeTruthy();
    expect(screen.getByText("CODE DJ: Added an owner predicate")).toBeTruthy();
    expect(screen.getByText("src/routes.ts")).toBeTruthy();
    expect(screen.queryByText(/No CODE ORACLE \/ CODE DJ review was recorded/)).toBeNull();
  });
});
