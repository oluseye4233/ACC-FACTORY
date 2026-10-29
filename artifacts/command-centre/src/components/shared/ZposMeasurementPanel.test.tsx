// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HarnessArtifact, MvpPdd } from "@workspace/api-client-react";
import { ZposMeasurementPanel, summarizeZpos } from "./ZposMeasurementPanel";

afterEach(cleanup);
const cert = (source: number, result: number) => ({
  zposMeasurement: {
    version: "zpos-document-v1", tokenizer: "cl100k_base", scope: "document-content-json",
    sourceTokens: source, resultTokens: result, tokensReduced: source - result,
    reductionPct: (source - result) / source * 100,
    measuredAt: "2026-10-29T00:00:00Z", sourceArtifactId: "s", sourceHash: "a", resultHash: "b",
  },
});
const artifact = (id: string, certificate: unknown) => ({
  id, artifactType: "MVP_PDD", spartanCert: certificate,
}) as HarnessArtifact;

describe("ZPOS measured report", () => {
  it("weights totals by source tokens instead of averaging percentages", () => {
    const summary = summarizeZpos([artifact("a", cert(100, 50)), artifact("b", cert(900, 810))]);
    expect(summary).toMatchObject({ source: 1000, result: 860, reduced: 140, count: 2 });
    expect(summary.percentage).toBeCloseTo(14);
  });
  it("does not double count a streamed artifact once the list refreshes", () => {
    const current = { artifactId: "a", cert: cert(100, 50) } as MvpPdd;
    expect(summarizeZpos([artifact("a", cert(100, 50))], current).count).toBe(1);
  });
  it("does not count old model ratios as measured savings", () => {
    render(<ZposMeasurementPanel artifacts={[artifact("legacy", { crP: 0.8 })]} />);
    expect(screen.getByText(/No measured conversions yet/)).toBeTruthy();
    expect(screen.getByText(/1 saved conversions not measured/)).toBeTruthy();
  });
  it("shows persisted measurements after reload and keeps attribution caveats", () => {
    render(<ZposMeasurementPanel artifacts={[artifact("a", cert(100, 120))]} />);
    expect(screen.getByTestId("zpos-session-total").textContent).toContain("-20.00%");
    expect(screen.getByText(/not ZPOS-only attribution/)).toBeTruthy();
    expect(screen.getByText(/inference savings remain unmeasured/)).toBeTruthy();
  });
});
