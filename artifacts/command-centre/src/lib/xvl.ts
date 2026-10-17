import type { XvlArtifact, XvlEvalset, XvlRule, XvlRuleOperator } from "@workspace/api-client-react";

export const JSON_TYPE_NAMES = ["string", "number", "boolean", "object", "array", "null"] as const;

export interface RuleDraft {
  path: string;
  operator: XvlRuleOperator;
  expected: string;
}

/** Converts a form draft to an XvlRule, or returns an error message. Never guesses. */
export function parseRuleDraft(d: RuleDraft): { rule: XvlRule } | { error: string } {
  const path = d.path;
  if (path.length > 256) return { error: "Path exceeds 256 characters" };
  if (path !== "" && !path.startsWith("/")) return { error: "JSON Pointer must be empty (root) or start with /" };
  const raw = d.expected.trim();
  switch (d.operator) {
    case "exists":
      return { rule: { path, operator: "exists" } };
    case "type":
      if (!(JSON_TYPE_NAMES as readonly string[]).includes(raw)) return { error: "Choose a JSON type name" };
      return { rule: { path, operator: "type", expected: raw } };
    case "equals": {
      if (raw === "") return { error: "Enter a JSON scalar, e.g. \"draft\", 3, true, null" };
      let v: unknown;
      try {
        v = JSON.parse(raw);
      } catch {
        return { error: "Not valid JSON. Strings need double quotes" };
      }
      if (v !== null && !["string", "number", "boolean"].includes(typeof v))
        return { error: "equals takes a scalar only (no object/array)" };
      return { rule: { path, operator: "equals", expected: v as string | number | boolean | null } };
    }
    case "minLength":
    case "maxLength": {
      if (!/^\d+$/.test(raw)) return { error: "Nonnegative integer required" };
      return { rule: { path, operator: d.operator, expected: Number(raw) } };
    }
  }
  return { error: "Unknown operator" };
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function runEligibility(artifact: XvlArtifact | undefined, evalset: XvlEvalset | undefined): Eligibility {
  if (!artifact || !evalset) return { ok: false, reason: "Select a contract and an artifact" };
  if (artifact.stage !== evalset.stage)
    return { ok: false, reason: `Stage mismatch: artifact ${artifact.stage}, contract ${evalset.stage}` };
  if (!(new Date(artifact.createdAt).getTime() > new Date(evalset.registeredAt).getTime()))
    return {
      ok: false,
      reason: "Artifact predates the contract. Regenerate this stage in the cockpit, then run.",
    };
  return { ok: true };
}

export function describeRule(r: XvlRule): string {
  const p = r.path === "" ? "(root)" : r.path;
  if (r.operator === "exists") return `${p} exists`;
  return `${p} ${r.operator} ${JSON.stringify(r.expected ?? null)}`;
}
