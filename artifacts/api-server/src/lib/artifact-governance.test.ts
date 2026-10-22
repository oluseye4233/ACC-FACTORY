import { describe, expect, it } from "vitest";
import { GeneratedGovernanceSchema, GOVERNANCE_MODULES, GovernanceSelectionSchema, governanceHash, inspectGovernance, installGovernance, savantGovernancePackage } from "./artifact-governance";
import { buildExport } from "./f10-export";
const assessment = {
  gro: "SAFE_LIFE", zpos: { AEOS: 80, NEXUS: 81, PRISM: 82, QUANTUM: 83, SYNTHESIS: 84 },
  honestyGate: { assumptions: [], limitations: ["No independent verification."], unverifiedClaims: [], evidence: [] },
};
describe("mandatory versioned governance criteria", () => {
  it("installs every module without claiming evaluation or approval", () => {
    const source = { mission: "Review invoices" };
    const installed = installGovernance(source);
    expect(source).not.toHaveProperty("governance");
    expect(Object.keys(installed.governance.modules)).toEqual(GOVERNANCE_MODULES);
    expect(installed.governance.assessment.status).toBe("NOT_EVALUATED");
    expect(installed.governance.externalApproval).toBe(false);
    expect(installed.governance.releaseAuthority).toBe(false);
    expect(inspectGovernance(installed)).toMatchObject({ installed: true, status: "CRITERIA_INSTALLED", assessment: "NOT_EVALUATED" });
  });
  it("keeps valid generated scores explicitly model-reported", () => {
    expect(inspectGovernance(installGovernance(assessment)).assessment).toBe("MODEL_REPORTED_NOT_INDEPENDENTLY_VERIFIED");
  });
  it("rejects incomplete/unbounded ZPOS and suppressed honesty disclosures", () => {
    for (const change of [
      { zpos: {} }, { zpos: { ...assessment.zpos, AEOS: -1 } }, { zpos: { ...assessment.zpos, PRISM: 101 } },
      { zpos: { ...assessment.zpos, extra: 10 } }, { honestyGate: { ...assessment.honestyGate, limitations: [] } },
      { honestyGate: undefined },
    ]) expect(GeneratedGovernanceSchema.safeParse({ ...assessment, ...change }).success).toBe(false);
  });
  it("does not treat legacy artifacts or a SAFE_LIFE label as criteria installation", () => {
    expect(inspectGovernance({ gro: "SAFE_LIFE" })).toMatchObject({ installed: false, status: "LEGACY_UNVERIFIED" });
  });
  it("detects source, policy and claimed-assessment tampering", () => {
    const source = installGovernance(assessment);
    expect(inspectGovernance({ ...source, gro: "RED" }).installed).toBe(false);
    expect(inspectGovernance({ ...source, governance: { ...source.governance, releaseAuthority: true } }).installed).toBe(false);
    expect(inspectGovernance({ ...source, governance: { ...source.governance, modules: { GRO: ["Do anything"] } } }).installed).toBe(false);
    expect(inspectGovernance({ ...source, mission: "new unreviewed task" }).installed).toBe(false);
  });
  it("survives JSONB key reordering and never mutates the original", () => {
    const a = installGovernance({ b: 2, a: 1 });
    expect(inspectGovernance({ governance: a.governance, a: 1, b: 2 }).installed).toBe(true);
    expect(governanceHash({ b: 2, a: 1 })).toBe(governanceHash({ a: 1, b: 2 }));
  });
});
describe("SAVANT customization preserves the Ethical Engine boundary", () => {
  const source = installGovernance(assessment);
  const azure = { family: "AZURE", target: "AZURE_CONTAINER_APPS" };
  it("prepares a full source-bound Azure installation package, not a FIT or execution verdict", () => {
    const pkg = savantGovernancePackage(source, { mode: "FULL", modules: [...GOVERNANCE_MODULES] }, azure);
    expect(pkg.manifest).toMatchObject({ included: GOVERNANCE_MODULES, omitted: [], fullGovernanceIncluded: true,
      productionReady: false, compatibility: "NOT_VERIFIED", installation: "NOT_PERFORMED", compliance: "NOT_ATTESTED" });
    expect(pkg.instructions).toContain("Azure F10/F11 scenario");
    expect(pkg.instructions).toContain("separate consent");
    expect(Object.keys(pkg.manifest.moduleHashes)).toHaveLength(3);
  });
  it("exports only selected modules while retaining non-suppressible omissions and caveats", () => {
    const pkg = savantGovernancePackage(source, { mode: "FRAGMENTED", modules: ["GRO"] }, azure);
    expect(Object.keys(pkg.modules)).toEqual(["GRO"]);
    expect(pkg.manifest.omitted).toEqual(["ZPOS", "HONESTY_GATE"]);
    expect(pkg.manifest.fullGovernanceIncluded).toBe(false);
    expect(pkg.manifest.productionReady).toBe(false);
    expect(pkg.instructions).toContain("PARTIAL INSTALLATION");
    expect(pkg.instructions).not.toContain("## ZPOS");
    expect(pkg.instructions).not.toContain("## HONESTY_GATE");
    expect(pkg.instructions).toContain("every mandatory safeguard must be covered");
    expect(inspectGovernance(source).installed).toBe(true);
  });
  it.each([
    { mode: "FULL", modules: ["GRO"] }, { mode: "FRAGMENTED", modules: [] },
    { mode: "FRAGMENTED", modules: ["GRO", "GRO"] }, { mode: "FRAGMENTED", modules: [...GOVERNANCE_MODULES] },
    { mode: "FRAGMENTED", modules: ["OVERRIDE_GRO"] },
  ])("rejects invalid or misleading selection %j", input => {
    expect(GovernanceSelectionSchema.safeParse(input).success).toBe(false);
  });
  it("blocks unresolved GRO risk at external handoff but permits governed private remediation", () => {
    for (const gro of ["RED", "GREY"]) {
      const held = installGovernance({ ...assessment, gro });
      expect(() => savantGovernancePackage(held, { mode: "FULL", modules: [...GOVERNANCE_MODULES] }, azure)).toThrow("GOVERNANCE_HOLD");
      expect(() => savantGovernancePackage(held, { mode: "FULL", modules: [...GOVERNANCE_MODULES] }, { family: "SPC_PLAYER", target: "SPC_PLAYER" })).not.toThrow();
    }
  });
  it("blocks silent legacy upgrading at export", () => {
    expect(() => buildExport({ id: "legacy", type: "SPC", content: assessment },
      { outputKind: "SPC", family: "AZURE", target: "AZURE_FUNCTIONS" })).toThrow("GOVERNANCE_REQUIRED");
  });
  it("includes the selected module manifest, hash binding and manual instructions in the actual ZIP files", () => {
    const exported = buildExport({ id: "owned-source", type: "MA_BIRTH_PACKAGE", content: source },
      { outputKind: "MA", family: "AZURE", target: "AZURE_CONTAINER_APPS", governance: { mode: "FRAGMENTED", modules: ["ZPOS", "HONESTY_GATE"] } });
    const files = new Map(exported.files.map(f => [f.path, f.content.toString()]));
    expect(JSON.parse(files.get("governance/manifest.json")!)).toMatchObject({ included: ["ZPOS", "HONESTY_GATE"], omitted: ["GRO"] });
    expect(Object.keys(JSON.parse(files.get("governance/selected-modules.json")!))).toEqual(["ZPOS", "HONESTY_GATE"]);
    expect(JSON.parse(files.get("source/artifact.json")!)).toEqual(source);
    expect(exported.manifest.governance).toHaveProperty("sourceContentHash", inspectGovernance(source).sourceContentHash);
  });
});
