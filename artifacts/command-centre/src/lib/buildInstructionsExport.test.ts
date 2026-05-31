import { describe, it, expect } from "vitest";
import type {
  VdjRecommendation,
  HostingPlan,
} from "@workspace/api-client-react";
import { buildInstructionsMd } from "./buildInstructionsExport";

function makeVdj(overrides: Partial<VdjRecommendation> = {}): VdjRecommendation {
  return {
    recommendedIde: "Cursor",
    recommendedVibe: "Pair-programmer / TDD",
    rationale: "The ATLAS PDD favours rapid iteration on a typed stack.",
    alternatives: [
      { name: "Replit Agent", fit: 0.82 },
      { name: "Claude Code", fit: 0.71 },
    ],
    ...overrides,
  };
}

function makeHostPlan(overrides: Partial<HostingPlan> = {}): HostingPlan {
  return {
    artifactId: "11111111-2222-3333-4444-555555555555",
    hrp: { summary: "Stateless web app with a Postgres dependency." } as HostingPlan["hrp"],
    weights: {} as HostingPlan["weights"],
    hse: [
      { platform: "replit-deployments", weightedTotal: 92.4 } as HostingPlan["hse"][number],
      { platform: "vercel", weightedTotal: 88.1 } as HostingPlan["hse"][number],
    ],
    primary: { platform: "replit-deployments", score: 92.4 } as HostingPlan["primary"],
    fallback: { platform: "vercel" } as HostingPlan["fallback"],
    journey: {
      tier: "managed",
      phases: [{ name: "Provision", detail: "Create the deployment." }],
    } as HostingPlan["journey"],
    sdf: {
      envTemplate: [
        { key: "DATABASE_URL", description: "Postgres connection", required: true },
      ],
    } as HostingPlan["sdf"],
    jcse: 88,
    ...overrides,
  };
}

describe("buildInstructionsMd", () => {
  it("renders both VIBE DJ and HOST DJ sections when both are present", () => {
    const md = buildInstructionsMd(makeVdj(), makeHostPlan());
    expect(md).toContain("# BUILD INSTRUCTIONS");
    expect(md).toContain("## VIBE DJ — build environment (F6-VDJ)");
    expect(md).toContain("Cursor");
    expect(md).toContain("Replit Agent");
    expect(md).toContain("## HOST DJ — hosting plan (F8-HDJ)");
    expect(md).toContain("Replit Deployments");
    expect(md).toContain("DATABASE_URL");
    expect(md).toContain("JCSE");
  });

  it("uses explicit placeholders when a recommendation is missing", () => {
    const onlyVdj = buildInstructionsMd(makeVdj(), undefined);
    expect(onlyVdj).toContain("No HOST DJ hosting plan has been generated");
    expect(onlyVdj).toContain("Cursor");

    const onlyHost = buildInstructionsMd(undefined, makeHostPlan());
    expect(onlyHost).toContain("No VIBE DJ recommendation has been generated");
    expect(onlyHost).toContain("Replit Deployments");

    const neither = buildInstructionsMd(undefined, undefined);
    expect(neither).toContain("No VIBE DJ recommendation has been generated");
    expect(neither).toContain("No HOST DJ hosting plan has been generated");
  });
});
