import { z } from "zod/v4";
import { artifactOutputHash } from "./command-deck-capture";

export const SPRINT_POLICY_VERSION = "ARK-GAP-2026-10-16-ELG-2";
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
function fact<T extends z.ZodType>(value: T) {
  return z.object({ value: value.nullable(), evidenceHash: sha256.nullable() }).strict();
}
const count = fact(z.number().int().nonnegative());
const flag = fact(z.boolean());
export const sprintEligibilityInputSchema = z.object({
  circuit: z.enum(["SC_ONE", "SC_TWO"]),
  target: z.enum(["SOFTWARE", "FIRMWARE"]),
  profile: z.enum(["PROTOTYPE_LIGHT", "STANDARD", "REGULATED"]),
  sourceArtifactHash: sha256.nullable(),
  facts: z.object({
    sourceStageCertified: flag,
    regulatedTracksAdded: flag,
    toolPermissionsDeclared: flag,
    atomicPromptCount: count,
    toolCount: count,
    buildElapsedMinutes: fact(z.number().finite().nonnegative()),
    interfaceContractPresent: flag,
    hasCodebase: flag,
    openCriticalCount: count,
    f2Certified: flag,
    jsonIoContractsValid: flag,
    hostDeployableByConfiguration: flag,
    singleAgent: flag,
  }).strict(),
}).strict();
type Input = z.infer<typeof sprintEligibilityInputSchema>;
type FactName = keyof Input["facts"];
type Result = {
  id: string; status: "PASS" | "FAIL" | "UNKNOWN";
  reason: string; remedy: string | null; evidenceHash: string | null;
};

/**
 * Internal eligibility policy, NOT a public assertion/approval endpoint.
 * Future callers must resolve hashes against trusted certified stage records;
 * a caller-supplied digest is not proof that its fact is true.
 */
export function evaluateSprintEligibility(raw: unknown) {
  const input = sprintEligibilityInputSchema.parse(raw);
  const results: Result[] = [];
  function check(id: string, name: FactName, predicate: (value: number | boolean) => boolean, reason: string, remedy: string) {
    const observed = input.facts[name];
    const known = observed.value !== null && observed.evidenceHash !== null;
    const status = !known ? "UNKNOWN" : predicate(observed.value!) ? "PASS" : "FAIL";
    results.push({
      id, status, reason: known ? reason : `Missing measured/certified evidence for ${name}`,
      remedy: status === "PASS" ? null : known ? remedy : `${remedy} Resolve this fact from a trusted stage record; do not substitute a self-reported value.`,
      evidenceHash: observed.evidenceHash,
    });
  }
  results.push({
    id: "SOURCE_VERSION_BOUND",
    status: input.sourceArtifactHash ? "PASS" : "UNKNOWN",
    reason: input.sourceArtifactHash ? "Assessment is bound to the selected artifact content hash" : "The selected artifact version has no usable content hash",
    remedy: input.sourceArtifactHash ? null : "Resolve a bounded, owner-held source output before assessing its certification.",
    evidenceHash: input.sourceArtifactHash,
  });
  check("SOURCE_STAGE_CERTIFIED", "sourceStageCertified", (v) => v === true,
    "The source F4/F5 stage must be certified for the selected artifact version", "Complete the required stage certification; legacy flags and advisory contract PASS do not establish it.");
  if (input.profile === "REGULATED") {
    check("REGULATED_TRACKS", "regulatedTracksAdded", (v) => v === true,
      "A Regulated short circuit must include Tracks H and C", "Add both required tracks to the governed verification profile.");
  }
  check("NO_OPEN_CRITICAL", "openCriticalCount", (v) => v === 0,
    "No open CRITICAL findings may enter a short route", "Remediate the CRITICAL finding or continue on the full route without releasing.");
  check("NO_CODEBASE", "hasCodebase", (v) => v === false,
    "Short circuits are specification/configuration products, not codebase builds", "Use the full software or firmware build path.");
  check("SINGLE_AGENT", "singleAgent", (v) => v === true,
    "Short circuits are single-agent specifications", "Use the full route for multi-agent systems.");
  if (input.circuit === "SC_ONE") {
    check("PROMPT_LIMIT", "atomicPromptCount", (v) => typeof v === "number" && v >= 1 && v <= 3,
      "SC ONE requires 1–3 Atomic Prompts", "Reduce to one Molecular Agent or continue to F5.");
    check("TOOL_LIMIT", "toolCount", (v) => typeof v === "number" && v <= 1,
      "SC ONE permits at most one tool", "Reduce tool scope or continue to F5.");
    check("BUILD_TIME_LIMIT", "buildElapsedMinutes", (v) => typeof v === "number" && v <= 90,
      "SC ONE has a conservative 90-minute MA-build eligibility ceiling", "Continue to F5; do not reset the build clock or alter the measured duration.");
    check("INTERFACE_CONTRACT", "interfaceContractPresent", (v) => v === true,
      "The Molecular Agent requires an Interface Contract", "Produce the missing Interface Contract before reconsidering SC ONE.");
  } else {
    check("F2_CERTIFIED", "f2Certified", (v) => v === true,
      "SC TWO requires certified F2 prompts", "Complete the required F2 certification.");
    check("JSON_IO", "jsonIoContractsValid", (v) => v === true,
      "SC TWO requires valid JSON input/output contracts", "Validate and persist the input/output contracts.");
    check("HOST_CONFIG", "hostDeployableByConfiguration", (v) => v === true,
      "SC TWO must be host-deployable by configuration", "Provide validated host configuration or use the full codebase route.");
    check("TOOL_PERMISSIONS", "toolPermissionsDeclared", (v) => v === true,
      "SC TWO tools must be listed with their permissions", "Provide validated tool and permission declarations.");
  }
  const state = results.some((r) => r.status === "FAIL") ? "INELIGIBLE" :
    results.some((r) => r.status === "UNKNOWN") ? "INCONCLUSIVE" : "ELIGIBLE";
  return {
    policyVersion: SPRINT_POLICY_VERSION, circuit: input.circuit, state, results,
    eligibilityHash: artifactOutputHash({ policyVersion: SPRINT_POLICY_VERSION, ...input, results }),
    verificationPackRequired: true,
    additionalRegulatedTracks: input.profile === "REGULATED" ? ["H", "C"] : [],
    requiredPostStages: [...(input.target === "FIRMWARE" ? ["F9"] : []), "F9.5", "F10", "F11", "F12"],
    releaseAllowed: false,
    limitation: "Structural eligibility only. Certified-record resolution, gate decisions, verification packs, custody, staged release and F12 adapters are not activated by this evaluator.",
  };
}
