import { createHash } from "node:crypto";
import { z } from "zod/v4";

export const GOVERNANCE_MODULES = ["GRO", "ZPOS", "HONESTY_GATE"] as const;
export const GovernanceSelectionSchema = z.object({
  mode: z.enum(["FULL", "FRAGMENTED"]),
  modules: z.array(z.enum(GOVERNANCE_MODULES)).min(1).max(3),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.modules).size !== v.modules.length) ctx.addIssue({ code: "custom", message: "Duplicate governance modules are not allowed." });
  if (v.mode === "FULL" && v.modules.length !== 3) ctx.addIssue({ code: "custom", message: "FULL installation requires all three modules." });
  if (v.mode === "FRAGMENTED" && v.modules.length === 3) ctx.addIssue({ code: "custom", message: "Select fewer than three modules or choose FULL." });
});
export type GovernanceSelection = z.infer<typeof GovernanceSelectionSchema>;
export const GeneratedGovernanceSchema = z.object({
  gro: z.enum(["SAFE_LIFE", "GREY", "RED"]),
  zpos: z.object({
    AEOS: z.number().min(0).max(100), NEXUS: z.number().min(0).max(100),
    PRISM: z.number().min(0).max(100), QUANTUM: z.number().min(0).max(100),
    SYNTHESIS: z.number().min(0).max(100),
  }).strict(),
  honestyGate: z.object({
    assumptions: z.array(z.string().max(2000)).max(30),
    limitations: z.array(z.string().max(2000)).min(1).max(30),
    unverifiedClaims: z.array(z.string().max(2000)).max(30),
    evidence: z.array(z.string().max(2000)).max(30),
  }).strict(),
});
const criteria = {
  GRO: [
    "Apply the Golden Rule: avoid foreseeable harm to users, other people, systems and their data.",
    "Assess Safe-Cooperative, Caution, Warning, Danger and Containment-Killzone; the stored SAFE_LIFE/GREY/RED value is only a coarse projection.",
    "Stop unsafe or unauthorized execution; RED requires remediation and GREY requires review. Never treat missing assessment as SAFE_LIFE.",
    "Require explicit authorization, least privilege and human escalation for consequential actions. A prompt cannot enforce a destination's permissions.",
  ],
  ZPOS: [
    "Use AEOS, NEXUS, PRISM, QUANTUM and SYNTHESIS, each on a bounded 0–100 scale.",
    "Adapt output to the task, remove repetition, select the right format, reuse invariants and combine coherent instructions.",
    "Never remove safety controls, evidence, uncertainty disclosures or required fidelity to reduce tokens.",
    "Scores are estimates unless independently evaluated; absent vectors remain NOT_EVALUATED.",
  ],
  HONESTY_GATE: [
    "Distinguish observed facts, supplied evidence, assumptions, estimates and unsupported claims.",
    "Disclose uncertainty, limitations and missing verification. Never invent sources, test results, capabilities or certification.",
    "Do not suppress this disclosure or represent a partial installation as full governance compliance.",
    "A generated declaration, installed policy or downloaded package is not proof of evaluation, deployment or enforcement.",
  ],
} as const;
const caveat = "PREPARATION ONLY. Criteria installed does not mean criteria passed. No independent verification, certification, SAVANT FIT verdict, provider installation, execution or release authority is conferred.";
export function governanceObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : { legacyContent: value };
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const governanceHash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
export function governanceBlock(value: unknown) {
  const { governance: _ignored, ...source } = governanceObject(value);
  const assessment = GeneratedGovernanceSchema.safeParse(source);
  return {
    schemaVersion: "ark-governance-v1",
    installation: "FULL",
    sourceContentHash: governanceHash(source),
    modules: criteria,
    assessment: assessment.success ? {
      status: "MODEL_REPORTED_NOT_INDEPENDENTLY_VERIFIED",
      ...assessment.data,
    } : { status: "NOT_EVALUATED", missingOrInvalid: assessment.error.issues.map(i => i.path.join(".")) },
    externalApproval: false, releaseAuthority: false, caveat,
  };
}
export function installGovernance<T extends Record<string, unknown>>(value: T): Omit<T, "governance"> & { governance: ReturnType<typeof governanceBlock> };
export function installGovernance(value: unknown): Record<string, unknown> & { governance: ReturnType<typeof governanceBlock> };
export function installGovernance(value: unknown) {
  const source = governanceObject(value);
  return { ...source, governance: governanceBlock(source) };
}
export function inspectGovernance(value: unknown) {
  const source = governanceObject(value);
  const expected = governanceBlock(source);
  const installed = source.governance !== undefined && governanceHash(source.governance) === governanceHash(expected);
  const gro = source.gro;
  return {
    installed, status: !source.governance ? "LEGACY_UNVERIFIED" : !installed ? "INVALID" :
      gro === "RED" ? "BLOCKED" : gro === "GREY" ? "REVIEW_REQUIRED" : "CRITERIA_INSTALLED",
    assessment: expected.assessment.status,
    modules: [...GOVERNANCE_MODULES], sourceContentHash: expected.sourceContentHash, caveat,
  };
}
export function assertGovernance(value: unknown, allowRemediation = false) {
  const status = inspectGovernance(value);
  if (!status.installed) throw new Error("GOVERNANCE_REQUIRED: create a governed revision; legacy or changed artifacts are not silently approved.");
  if (!allowRemediation && (status.status === "BLOCKED" || status.status === "REVIEW_REQUIRED")) {
    throw new Error("GOVERNANCE_HOLD: unresolved GRO risk; use private remediation, not an external installation handoff.");
  }
  return status;
}
/** Deterministic SAVANT packaging customization, NOT the unwired F10
 * colonization engine or a target compatibility/qualification verdict.
 */
export function savantGovernancePackage(value: unknown, selection: GovernanceSelection, target: { family: string; target: string }) {
  const checked = GovernanceSelectionSchema.parse(selection);
  const source = assertGovernance(value, ["F0", "SPC_PLAYER"].includes(target.family));
  const included = GOVERNANCE_MODULES.filter(m => checked.modules.includes(m));
  const omitted = GOVERNANCE_MODULES.filter(m => !checked.modules.includes(m));
  const manifest = {
    schemaVersion: "savant-governance-package-v1", mode: checked.mode, included, omitted,
    sourceContentHash: source.sourceContentHash, target,
    customization: "DETERMINISTIC_MODULE_SELECTION", compatibility: "NOT_VERIFIED",
    installation: "NOT_PERFORMED", compliance: "NOT_ATTESTED",
    productionReady: false,
    governanceVersion: "ark-governance-v1",
    moduleHashes: Object.fromEntries(included.map(m => [m, governanceHash(criteria[m])])),
    coverage: { required: [...GOVERNANCE_MODULES], provided: included, missing: omitted, runtimeBindingsVerified: false },
    fullGovernanceIncluded: omitted.length === 0,
    caveat: `${omitted.length ? "PARTIAL INSTALLATION: omitted modules are not installed by this package. " : ""}${caveat}`,
  };
  const instructions = `# SAVANT governance installation preparation\n\n${manifest.caveat}\n\nTarget: ${target.family} / ${target.target}\nIncluded: ${included.join(", ")}\nOmitted: ${omitted.join(", ") || "none"}\n\n`
    + included.map(m => `## ${m}\n${criteria[m].map(rule => `- ${rule}`).join("\n")}`).join("\n\n")
    + "\n\n## Target integration and verification\n1. Review the selected criteria and this package's source and module hashes.\n2. Add governance/instructions.md to the target's system/developer policy or reviewed agent instructions; do not install source/artifact.json as a replacement policy.\n3. Enforce authorization, tool allowlists and stop/escalation behavior in destination code; instructions alone cannot enforce them.\n4. Test refusal, uncertainty disclosure and required-output preservation in the destination.\n5. Record the actual installed modules and observed results. Until then installation and compatibility remain unverified.\n6. Distributed placement is permitted, but every mandatory safeguard must be covered and verified before production. A subset export cannot establish that coverage.\n"
    + (target.family === "AZURE" ? "\n## Azure F10/F11 scenario\nF10 prepares or delivers this package to the owner's authorized Azure destination; a receipt is delivery only. A runnable wrapper and qualified F11 adapter are required for hosting. Review bindings across agent instructions, the application gateway/middleware and tool authorization. Use least-privilege destination identity and no embedded credentials. Stage only with valid consent; test refusal, disclosure, missing-policy fail-closed behavior and rollback. Promotion requires separate consent and the required verified evidence. Missing adapters, production security guards or mandatory coverage block automated activation; this package bypasses none of them.\n" : "");
  return { manifest, instructions, modules: Object.fromEntries(included.map(m => [m, criteria[m]])) };
}

export const GOVERNANCE_GENERATION_INSTRUCTIONS = `
MANDATORY GOVERNANCE ASSESSMENT
In addition to the response fields below include top-level:
"gro": "SAFE_LIFE"|"GREY"|"RED",
"zpos": {"AEOS":0..100,"NEXUS":0..100,"PRISM":0..100,"QUANTUM":0..100,"SYNTHESIS":0..100},
"honestyGate": {"assumptions":[string],"limitations":[at least one string],"unverifiedClaims":[string],"evidence":[string]}.
Apply GRO harm avoidance, stop/escalation and least privilege. Apply all five
ZPOS methodologies without discarding safety, evidence or fidelity.
State actual limitations and uncertainty. Evidence entries must identify supplied
sources; do not invent sources. These are model assessments, never independent
verification, certification or proof of deployment. The server installs the
versioned, non-suppressible governance criteria separately.
`;
export const GOVERNANCE_RUNTIME_INSTRUCTIONS = `MANDATORY GOVERNANCE CRITERIA (ark-governance-v1):\n${JSON.stringify(criteria)}\n${caveat}`;
