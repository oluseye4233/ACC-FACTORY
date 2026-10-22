import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { CostBudgetExceededError } from "../src/lib/cost-budget";

const mocks = vi.hoisted(() => ({
  artifacts: new Map<string, Record<string, unknown>>(), calls: vi.fn(),
  persist: vi.fn(), review: vi.fn(), owner: "owner", failRecheck: false, reviewRequired: false,
  attempt: null as null | { phase: string; data: Record<string, unknown>; sourceHash: string },
  locked: false,
  unknownRecheck: false,
}));
vi.mock("../src/lib/f8-remediation-attempts", () => ({
  repairAttemptId: () => "attempt-id",
  lockRepairAttempt: async () => {
    if (mocks.locked) return null;
    mocks.locked = true; return async () => { mocks.locked = false; };
  },
  openRepairAttempt: async (_id: string, _owner: string, _session: string, hash: string) => {
    if (!mocks.attempt) mocks.attempt = { phase: "READY", data: {}, sourceHash: hash };
    if (mocks.attempt.sourceHash !== hash) throw new Error("Source evidence changed since this repair began");
    return structuredClone(mocks.attempt);
  },
  saveRepairAttempt: async (_id: string, _owner: string, phase: string, data: Record<string, unknown>) => {
    mocks.attempt = { ...mocks.attempt!, phase, data: structuredClone(data) };
  },
  findRepairEvidence: async () => {
    const artifacts = [...mocks.artifacts.values()];
    const linked = artifacts.filter(a => (a.artifactContent as Record<string, unknown>).repairAttemptId === "attempt-id");
    const bundle = linked.find(a => a.artifactType === "CODEBASE_BUNDLE");
    return {
      journal: linked.find(a => a.artifactType === "F8_DRIFT_REMEDIATION"), bundle,
      report: bundle && artifacts.find(a => a.artifactType === "PFP_REPORT" &&
        (a.artifactContent as Record<string, unknown>).sourceCodebaseBundleArtifactId === bundle.id),
      review: undefined,
    };
  },
}));
vi.mock("@workspace/db", async original => {
  const actual = await original<typeof import("@workspace/db")>();
  return { ...actual, db: { insert: () => ({ values: (input: unknown) => {
    mocks.review(input);
    return { returning: async () => [{ id: "case-id" }] };
  } }) } };
});
vi.mock("../src/lib/boomerang", async original => ({
  ...await original<typeof import("../src/lib/boomerang")>(),
  boomerangOrigin: async () => ({ hash: "post-remediation-baseline", refs: [] }),
}));
vi.mock("../src/engines/shared", async original => {
  const actual = await original<typeof import("../src/engines/shared")>();
  return { ...actual,
    ownedSessionOr404: async () => ({ ok: true, userId: mocks.owner, preferredModelProvider: "claude" }),
    resolveProvider: () => "claude",
    loadArtifact: async (id: string, owner: string) => {
      const a = mocks.artifacts.get(id); return a?.userId === owner ? structuredClone(a) : null;
    },
    persistArtifact: async (input: Record<string, unknown>) => {
      mocks.persist(input);
      const artifact = { id: `saved-${mocks.persist.mock.calls.length}`, ...input };
      mocks.artifacts.set(artifact.id, artifact); return artifact;
    },
    callLlmJson: async (_provider: unknown, _system: string, prompt: string, schema: { parse: (v: unknown) => unknown }, context: unknown) => {
      mocks.calls(prompt, context);
      if ((context as { engineId: number }).engineId === 9) return schema.parse({
        decision: mocks.reviewRequired ? "REVIEW_REQUIRED" : "REPAIR",
        summary: "Corrected the contract mismatch; generated code has not been executed.",
        corrections: [{ findingIndex: 0, action: "Align return value with approved requirement." }],
        bundle: mocks.reviewRequired ? null : codeBundle(),
      });
      if (mocks.failRecheck) throw new CostBudgetExceededError({ status: 402, body: { error: "Monthly LLM cost cap reached" } } as never);
      if (mocks.unknownRecheck) throw new Error("Provider returned but saving the verdict failed");
      // A contradictory model PASS must not clear the actual critical finding.
      return schema.parse(driftReport());
    },
  };
});
const { handleF8Remediation, validateRepair, RepairSchema } = await import("../src/engines/f8-remediation");
const sessionId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const mvpId = "33333333-3333-4333-8333-333333333333";
const bundleId = "44444444-4444-4444-8444-444444444444";
function codeBundle() {
  return { platform: "express-replit", framework: "express", language: "typescript",
    files: [{ path: "index.ts", language: "typescript", content: "export const answer = 42;" }],
    manifest: { framework: "express", language: "typescript", entrypoint: "index.ts",
      installCommand: "pnpm install", runCommand: "pnpm start", buildCommand: null, deployTarget: "replit" }, notes: "Not executed." };
}
function driftReport() {
  return { verdict: "pass", fci: 100, summary: "Finding remains.",
    findings: [{ code: "SPEC_DRIFT", severity: "critical", pddRef: "Output", codeRef: "index.ts", detail: "Wrong output." }],
    counts: { critical: 0, high: 0, medium: 0, low: 0 },
    sourceMvpPddArtifactId: mvpId, sourceCodebaseBundleArtifactId: bundleId };
}
beforeEach(() => {
  mocks.calls.mockClear(); mocks.persist.mockClear(); mocks.review.mockClear();
  mocks.artifacts.clear(); mocks.owner = "owner"; mocks.failRecheck = false; mocks.reviewRequired = false;
  mocks.attempt = null; mocks.locked = false; mocks.calls.mockReset();
  mocks.unknownRecheck = false;
  for (const a of [
    { id: mvpId, artifactType: "MVP_PDD", spartanCert: { certId: "cert" }, artifactContent: { requirement: "return 42" } },
    { id: bundleId, artifactType: "CODEBASE_BUNDLE", artifactContent: {
      ...codeBundle(), artifactClass: "FIRMWARE", hardwareConfigId: "hardware", sourceCertId: "cert", sourceMvpPddArtifactId: mvpId,
      files: [{ path: "index.ts", language: "typescript", content: "export const answer = 0;" }],
    } },
    { id: reportId, artifactType: "PFP_REPORT", artifactContent: driftReport() },
  ]) mocks.artifacts.set(a.id, { sessionId, userId: "owner", sku: null, ...a });
});
async function run() {
  const frames: string[] = []; let status = 200; let json: unknown;
  const res = { destroyed: false, writableEnded: false,
    status: (s: number) => { status = s; return res; },
    json: (v: unknown) => { json = v; return res; },
    setHeader: vi.fn(), flushHeaders: vi.fn(), write: (s: string) => frames.push(s), end: vi.fn() };
  await handleF8Remediation({ body: { sessionId, reportArtifactId: reportId }, log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request, res as unknown as Response);
  return { status, json, frames: frames.join(""), complete: () => JSON.parse(frames.find(f => f.startsWith("event: complete"))!.split("data: ")[1]) };
}
describe("automated F8 drift remediation", () => {
  it("retains originals, repairs once, immediately rechecks, and returns evidence without accepting or advancing", async () => {
    const original = structuredClone(mocks.artifacts.get(bundleId));
    const result = await run(); const done = result.complete();
    expect(done.state).toBe("RECHECKED");
    expect(done.sourceMvpPddArtifactId).toBe(mvpId);
    expect(done.report.verdict).toBe("fail"); expect(done.report.counts.critical).toBe(1);
    expect(done.bundle.artifactId).toBe("saved-2");
    expect(done.bundle.artifactClass).toBe("FIRMWARE"); expect(done.bundle.hardwareConfigId).toBe("hardware");
    expect(mocks.calls.mock.calls.map(c => c[1])).toEqual([
      { sessionId, userId: "owner", engineId: 9 }, { sessionId, userId: "owner", engineId: 11 },
    ]);
    expect(mocks.calls.mock.calls[0][0]).toContain(bundleId);
    expect(mocks.calls.mock.calls[1][0]).toContain("answer = 42");
    expect(mocks.artifacts.get(bundleId)).toEqual(original);
    expect(mocks.persist.mock.calls[2][0].artifactContent.sourceCodebaseBundleArtifactId).toBe("saved-2");
    expect(mocks.persist.mock.calls.every(c => !c[0].spartanCert)).toBe(true);
    expect(mocks.review.mock.calls[0][0]).toMatchObject({ state: "RETURNED", sourceHash: "post-remediation-baseline", stage: "F8" });
  });
  it("retains a repaired bundle when recheck is denied, without inventing a verdict", async () => {
    mocks.failRecheck = true;
    const done = (await run()).complete();
    expect(done.state).toBe("RECHECK_FAILED"); expect(done.bundle.artifactId).toBe("saved-2");
    expect(done.report).toBeUndefined(); expect(mocks.persist).toHaveBeenCalledTimes(2);
  });
  it("stops for requirements review without generating a replacement or running PFP", async () => {
    mocks.reviewRequired = true;
    const done = (await run()).complete();
    expect(done.state).toBe("REVIEW_REQUIRED"); expect(done.bundle).toBeUndefined();
    expect(mocks.calls).toHaveBeenCalledTimes(1); expect(mocks.persist).toHaveBeenCalledTimes(1);
  });
  it("can remediate low coverage even if the evaluator omitted individual findings", async () => {
    mocks.artifacts.get(reportId)!.artifactContent = { ...driftReport(), verdict: "fail", fci: 80, findings: [] };
    const done = (await run()).complete();
    expect(done.state).toBe("RECHECKED");
    expect(mocks.calls.mock.calls[0][0]).toContain("coverage-derived remediation instruction");
    expect(mocks.persist.mock.calls[0][0].artifactContent.derivedCoverageFinding.detail).toContain("80/100");
    expect((mocks.artifacts.get(reportId)!.artifactContent as { findings: unknown[] }).findings).toHaveLength(0);
  });
  it("rejects another owner's evidence before provider dispatch", async () => {
    mocks.owner = "stranger";
    expect((await run()).status).toBe(404); expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("rejects mismatched lineage or an uncertified contract before dispatch", async () => {
    mocks.artifacts.get(mvpId)!.spartanCert = null;
    expect((await run()).status).toBe(409); expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("rejects source changes during repair without persisting a replacement or rechecking", async () => {
    mocks.calls.mockImplementationOnce(() => {
      mocks.artifacts.get(mvpId)!.artifactContent = { requirement: "changed" };
    });
    const result = await run();
    expect(result.frames).toContain("Source evidence changed");
    expect(result.frames).not.toContain("event: complete");
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.calls).toHaveBeenCalledTimes(1);
  });
  it("rejects silent file loss, platform changes and unaccounted findings", () => {
    const repair = RepairSchema.parse({ decision: "REPAIR", summary: "Repair", corrections: [], bundle: codeBundle() });
    expect(() => validateRepair(repair, codeBundle(), 1)).toThrow(/every drift/);
    repair.corrections = [{ findingIndex: 0, action: "Fix" }];
    expect(() => validateRepair(repair, { ...codeBundle(), platform: "expo-mobile" }, 1)).toThrow(/platform/);
    expect(() => validateRepair(repair, { ...codeBundle(), files: [{ path: "missing.ts" }] }, 1)).toThrow(/omitted/);
  });
  it("replays a completed attempt without any further model calls or evidence writes", async () => {
    const first = (await run()).complete();
    const replay = (await run()).complete();
    expect(replay).toEqual(first);
    expect(mocks.calls).toHaveBeenCalledTimes(2);
    expect(mocks.persist).toHaveBeenCalledTimes(3);
    expect(mocks.review).toHaveBeenCalledTimes(1);
  });
  it("retries only a failed recheck, keeping the original corrected bundle", async () => {
    mocks.failRecheck = true;
    expect((await run()).complete().state).toBe("RECHECK_FAILED");
    mocks.failRecheck = false;
    const resumed = (await run()).complete();
    expect(resumed.state).toBe("RECHECKED");
    expect(resumed.bundle.artifactId).toBe("saved-2");
    expect(mocks.calls.mock.calls.map(c => c[1].engineId)).toEqual([9, 11, 11]);
    expect(mocks.persist).toHaveBeenCalledTimes(3);
  });
  it("rejects a concurrent request before another provider call", async () => {
    mocks.locked = true;
    const result = await run();
    expect(result.status).toBe(409);
    expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("refuses to repeat an uncertain repair dispatch after interruption", async () => {
    await run();
    mocks.attempt!.phase = "REPAIR_STARTED";
    mocks.attempt!.data = { reportArtifactId: reportId };
    mocks.calls.mockClear();
    expect((await run()).frames).toContain("unknown outcome");
    expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("recovers a saved repair and bundle after process interruption without another repair call", async () => {
    mocks.failRecheck = true;
    await run();
    mocks.attempt!.phase = "REPAIRED";
    mocks.failRecheck = false; mocks.calls.mockClear();
    expect((await run()).complete().state).toBe("RECHECKED");
    expect(mocks.calls.mock.calls.map(c => c[1].engineId)).toEqual([11]);
    expect(mocks.persist).toHaveBeenCalledTimes(3);
  });
  it("recovers an already persisted PFP report after a lost completion checkpoint", async () => {
    await run();
    mocks.attempt!.phase = "RECHECK_STARTED";
    mocks.calls.mockClear();
    expect((await run()).complete().report.verdict).toBe("fail");
    expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("does not dispatch again when a prior recheck outcome is unknown", async () => {
    mocks.failRecheck = true; await run();
    mocks.attempt!.phase = "RECHECK_STARTED"; mocks.calls.mockClear();
    expect((await run()).frames).toContain("PFP dispatch has an unknown outcome");
    expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("rejects changed source evidence on replay instead of silently starting a new paid attempt", async () => {
    await run();
    mocks.artifacts.get(mvpId)!.artifactContent = { requirement: "changed after completion" };
    mocks.calls.mockClear();
    expect((await run()).frames).toContain("Source evidence changed");
    expect(mocks.calls).not.toHaveBeenCalled();
  });
  it("does not treat an unknown provider or persistence failure as permission to recharge PFP", async () => {
    mocks.unknownRecheck = true;
    const first = (await run()).complete();
    expect(first.state).toBe("RECHECK_FAILED");
    expect(first.summary).toContain("may be billable");
    expect(mocks.attempt!.phase).toBe("RECHECK_UNCERTAIN");
    mocks.calls.mockClear();
    expect((await run()).frames).toContain("PFP dispatch has an unknown outcome");
    expect(mocks.calls).not.toHaveBeenCalled();
  });
});
