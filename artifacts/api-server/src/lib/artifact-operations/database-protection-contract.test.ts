import { describe, expect, it } from "vitest";
import { EXPECTED_OPERATION_POLICIES, operationPolicyChecks } from "./database-protection-contract";

function reviewedPolicies() {
  return EXPECTED_OPERATION_POLICIES.map(p => ({ ...p, roles: ["0"], permissive: true }));
}
describe("reviewed workflow RLS contract", () => {
  it("recognizes the exact reviewed command, role and predicate set", () => {
    expect(operationPolicyChecks(reviewedPolicies())).toEqual({
      owner_policies: true, authority_policies: true, policy_scope: true,
    });
    expect(operationPolicyChecks(reviewedPolicies().map(p => ({ ...p, roles: [0] }))).owner_policies).toBe(true);
  });
  it.each([
    ["USING bypass", { using: `${EXPECTED_OPERATION_POLICIES[0].using} OR true` }],
    ["WITH CHECK bypass", { check: `${EXPECTED_OPERATION_POLICIES[0].check} OR true` }],
    ["missing WITH CHECK", { check: null }],
    ["read-only command", { command: "r" }],
    ["wrong role", { roles: ["1234"] }],
    ["extra role", { roles: ["0", "1234"] }],
    ["coerced role", { roles: ["00"] }],
    ["missing role", { roles: [] }],
    ["changed policy mode", { permissive: false }],
  ])("refuses an owner policy with %s", (_name, change) => {
    const rows = reviewedPolicies();
    expect(operationPolicyChecks([{ ...rows[0], ...change }, ...rows.slice(1)]).owner_policies).toBe(false);
  });
  it.each(["sprint_verifiers_read", "sprint_verifiers_admin_insert", "sprint_verifiers_admin_update"])(
    "rejects broadened authority policy %s", name => {
      const rows = reviewedPolicies().map(p => p.name === name ? {
        ...p, ...(p.using ? { using: `${p.using} OR true` } : { check: `${p.check} OR true` }),
      } : p);
      expect(operationPolicyChecks(rows).authority_policies).toBe(false);
    });
  it("detects extra permissive policies even when the expected ones are unchanged", () => {
    const extra = { ...reviewedPolicies()[0], name: "unexpected_public_access", using: "true", check: "true" };
    const checks = operationPolicyChecks([...reviewedPolicies(), extra]);
    expect(checks.owner_policies).toBe(true);
    expect(checks.policy_scope).toBe(false);
  });
  it("does not mistake additional restrictive predicates for an OR bypass", () => {
    expect(operationPolicyChecks([...reviewedPolicies(), {
      ...reviewedPolicies()[0], name: "restrictive_control", permissive: false,
    }]).policy_scope).toBe(true);
  });
  it("fails closed on missing, duplicate or malformed expected definitions", () => {
    for (const input of [null, {}, [], reviewedPolicies().slice(1), [...reviewedPolicies(), reviewedPolicies()[0]]]) {
      expect(operationPolicyChecks(input).owner_policies).toBe(false);
    }
  });
});
