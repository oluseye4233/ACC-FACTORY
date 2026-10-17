import { z } from "zod/v4";
import { artifactOutputHash } from "./command-deck-capture";
import { traceStages } from "./command-deck-trace-contract";

export const ADAPTER_ID = "atanda-json-contract";
export const ADAPTER_VERSION = "1";
export const VERIFICATION_SCOPE = "JSON contract checks only. Advisory: no stage promotion, release clearance, scientific validation or certification.";

export const contractRuleSchema = z.object({
  path: z.string().max(256).regex(/^(?:\/(?:[^~/]|~[01])*)*$/, "Use a JSON Pointer such as /title or /items/0"),
  operator: z.enum(["exists", "type", "equals", "minLength", "maxLength"]),
  expected: z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]).optional(),
}).strict().superRefine((rule, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: "custom", path: ["expected"], message });
  if (rule.operator === "exists" && rule.expected !== undefined) invalid("exists takes no expected value");
  if (rule.operator === "equals" && rule.expected === undefined) invalid("equals needs an expected value");
  if (rule.operator === "type" && !["string", "number", "boolean", "object", "array", "null"].includes(String(rule.expected))) {
    invalid("type needs string, number, boolean, object, array or null");
  }
  if (["minLength", "maxLength"].includes(rule.operator) &&
    (typeof rule.expected !== "number" || !Number.isSafeInteger(rule.expected) || rule.expected < 0 || rule.expected > 1000000)) {
    invalid("Length must be a nonnegative integer no greater than 1000000");
  }
});
export const evalsetInputSchema = z.object({
  stage: z.enum(traceStages),
  title: z.string().trim().min(1).max(120),
  rules: z.array(contractRuleSchema).min(1).max(100),
}).strict();
export type ContractRule = z.infer<typeof contractRuleSchema>;

function readPointer(value: unknown, pointer: string): { found: boolean; value: unknown } {
  if (!pointer) return { found: true, value };
  let current = value;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    // Arrays are JSON values, not JS objects with addressable .length.
    if (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(key)) return { found: false, value: undefined };
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[key];
  }
  return { found: true, value: current };
}
function matches(value: unknown, rule: ContractRule) {
  const target = readPointer(value, rule.path);
  if (rule.operator === "exists") return target.found;
  if (!target.found) return false;
  const actual = target.value;
  if (rule.operator === "equals") return actual === rule.expected;
  if (rule.operator === "type") {
    const type = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
    return type === rule.expected;
  }
  if (typeof actual !== "string" && !Array.isArray(actual)) return false;
  const length = typeof actual === "string" ? Array.from(actual).length : actual.length;
  return rule.operator === "minLength" ? length >= Number(rule.expected) : length <= Number(rule.expected);
}

/** No generated judge, shell execution or third-party data disclosure. */
export function evaluateJsonContract(content: unknown, rules: unknown) {
  try {
    const parsed = z.array(contractRuleSchema).min(1).max(100).parse(rules);
    if (Buffer.byteLength(JSON.stringify(content), "utf8") > 512_000) {
      return { outcome: "INCONCLUSIVE" as const, results: [], reason: "ARTIFACT_SIZE_LIMIT" };
    }
    const results = parsed.map((rule, index) => ({ index, passed: matches(content, rule) }));
    return {
      outcome: results.every((r) => r.passed) ? "PASS" as const : "FAIL" as const,
      results, reason: "DETERMINISTIC_CONTRACT_CHECK",
    };
  } catch {
    // Corrupt contracts and adapter errors never become successful evidence.
    return { outcome: "INCONCLUSIVE" as const, results: [], reason: "INVALID_CONTRACT_OR_ADAPTER_ERROR" };
  }
}
export function evalsetDigest(stage: string, rules: unknown) {
  return artifactOutputHash({ adapter: ADAPTER_ID, version: ADAPTER_VERSION, stage, rules });
}

export const trackCatalog = [
  { id: "S", name: "Self-attested", independence: "I0", available: false, reason: "Existing self-assessment is not external verification." },
  { id: "E", name: "Eval-as-contract", independence: "I2", available: true, reason: "Bounded deterministic JSON contract adapter only; Google ADK reference adapter is not implemented." },
  { id: "J", name: "Cross-model judge", independence: "I1", available: false, reason: "Independent model identity, rubric and budget adapter pending." },
  { id: "R", name: "Red-team", independence: "I2", available: false, reason: "Real adversarial runner and scenario adapter pending." },
  { id: "H", name: "Human panel", independence: "I3", available: false, reason: "Named independent reviewers and conflict-of-interest authority pending." },
  { id: "C", name: "Compliance and custody", independence: "I2", available: false, reason: "Control mapping and required consent/security evidence pending." },
  { id: "P", name: "Provider readiness", independence: "I2", available: false, reason: "Provider baseline/conformance adapter pending." },
  { id: "B", name: "Benchmark trial", independence: "I3", available: false, reason: "Outside study partner, protocol and approvals pending." },
];
