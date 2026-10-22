/** Read-only expectations for the reviewed public-schema workflow guards.
 * These describe existing migrations; they never install or repair anything.
 * Exact catalog expressions are intentional: an unfamiliar equivalent needs
 * review, rather than a substring match that also accepts `... OR true`.
 */
export const REQUIRED_OPERATION_PRIVILEGES = [
  ["imprima_jobs", "SELECT"], ["imprima_jobs", "INSERT"], ["imprima_jobs", "UPDATE"],
  ["imprima_files", "SELECT"], ["imprima_files", "INSERT"],
  ["short_sprint_runs", "SELECT"], ["short_sprint_runs", "INSERT"], ["short_sprint_runs", "UPDATE"],
  ["artifact_operation_events", "SELECT"], ["artifact_operation_events", "INSERT"],
  ["sprint_verifier_authorities", "SELECT"], ["sprint_verifier_authorities", "INSERT"], ["sprint_verifier_authorities", "UPDATE"],
  ["harness_artifacts", "SELECT"],
  ["harness_feature_state", "SELECT"], ["harness_feature_state", "INSERT"], ["harness_feature_state", "UPDATE"],
  ["command_deck_traces", "SELECT"], ["command_deck_traces", "INSERT"],
  ["vte_verification_failures", "SELECT"], ["vte_verification_failures", "INSERT"], ["vte_verification_failures", "UPDATE"],
] as const;

const owner = "((user_id = (NULLIF(current_setting('app.operations_actor'::text, true), ''::text))::uuid) OR (current_setting('app.operations_admin'::text, true) = 'true'::text))";
const admin = "(current_setting('app.operations_admin'::text, true) = 'true'::text)";
const authenticated = "((NULLIF(current_setting('app.operations_actor'::text, true), ''::text))::uuid IS NOT NULL)";

export const EXPECTED_OPERATION_POLICIES = [
  ...["artifact_operation_events", "imprima_files", "imprima_jobs", "short_sprint_runs"].map(table => ({
    table, name: `${table}_owner`, command: "*", using: owner, check: owner,
  })),
  { table: "sprint_verifier_authorities", name: "sprint_verifiers_read", command: "r", using: authenticated, check: null },
  { table: "sprint_verifier_authorities", name: "sprint_verifiers_admin_insert", command: "a", using: null, check: admin },
  { table: "sprint_verifier_authorities", name: "sprint_verifiers_admin_update", command: "w", using: admin, check: admin },
] as const;

export function operationPolicyChecks(snapshot: unknown) {
  const rows = Array.isArray(snapshot) ? snapshot : [];
  const matches = (expected: typeof EXPECTED_OPERATION_POLICIES[number]) => {
    const found = rows.filter(row => row?.table === expected.table && row?.name === expected.name);
    return found.length === 1 && found[0].command === expected.command
      && found[0].permissive === true && Array.isArray(found[0].roles)
      // pg's oid[] parser returns numbers; PostgreSQL jsonb encodes OIDs
      // as strings. Accept only those two exact representations of PUBLIC.
      && found[0].roles.length === 1 && (found[0].roles[0] === 0 || found[0].roles[0] === "0")
      && found[0].using === expected.using && found[0].check === expected.check;
  };
  return {
    owner_policies: EXPECTED_OPERATION_POLICIES.filter(p => p.command === "*").every(matches),
    authority_policies: EXPECTED_OPERATION_POLICIES.filter(p => p.command !== "*").every(matches),
    // Additional permissive policies are ORed with the intended rules. Even
    // perfect expected policies do not establish isolation in their presence.
    policy_scope: Array.isArray(snapshot) && rows.every(row => row?.permissive === false
      || EXPECTED_OPERATION_POLICIES.some(p => p.table === row?.table && p.name === row?.name)),
  };
}

export const IMMUTABLE_VERSION_FUNCTION_BODY = `
BEGIN
  IF TG_TABLE_NAME = 'imprima_files' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Publication file metadata is immutable; create a new version';
    END IF;
  ELSIF OLD.state = 'PUBLISHED' AND OLD.config->>'mode' = 'FINAL' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Published Final documents are immutable; create a new version';
    END IF;
  END IF;
  RETURN NEW;
END;
`;
