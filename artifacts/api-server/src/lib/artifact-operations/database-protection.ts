import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { OperationsTx } from "./context";
import { IMMUTABLE_VERSION_FUNCTION_BODY, operationPolicyChecks, REQUIRED_OPERATION_PRIVILEGES } from "./database-protection-contract";

/**
 * Read-only readiness, shared by the verifier UI and the fail-closed full lane.
 * This does not install, repair or migrate anything in either environment.
 */
export async function databaseProtection(executor: Pick<OperationsTx, "execute"> = db) {
  const permissions = sql.join(REQUIRED_OPERATION_PRIVILEGES.map(([table, privilege]) => sql`(${table}, ${privilege})`), sql`, `);
  const result = await executor.execute(sql`
    WITH required_permissions(table_name, privilege) AS (VALUES ${permissions}),
    operation_role AS (SELECT oid FROM pg_roles WHERE rolname='atanda_artifact_operations')
    SELECT
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atanda_artifact_operations'
        AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin
        AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) AS restricted_role,
      EXISTS(SELECT 1 FROM operation_role r
        WHERE pg_has_role(current_user, r.oid, 'MEMBER')) AS role_membership,
      (EXISTS(SELECT 1 FROM operation_role) AND
        has_schema_privilege((SELECT oid FROM operation_role), 'public', 'USAGE') AND
        (SELECT bool_and(CASE WHEN c.oid IS NULL THEN false
          ELSE has_table_privilege((SELECT oid FROM operation_role), c.oid, p.privilege) END)
          FROM required_permissions p LEFT JOIN pg_class c
            ON c.relnamespace='public'::regnamespace AND c.relname::text=p.table_name
              AND c.relkind IN ('r','p'))) AS required_permissions,
      (SELECT count(*)=5 FROM pg_class WHERE relnamespace='public'::regnamespace
        AND relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')
        AND relrowsecurity AND relforcerowsecurity) AS forced_rls,
      (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',p.polname,
          'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,
          'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)))
        FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
        WHERE c.relnamespace='public'::regnamespace
          AND c.relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')) AS policies,
      (EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atanda_artifact_operations')
        AND NOT has_schema_privilege((SELECT oid FROM operation_role), 'public', 'CREATE')
        AND NOT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN pg_roles r
          WHERE r.rolname='atanda_artifact_operations' AND c.relnamespace='public'::regnamespace
            AND c.relname::text IN (SELECT table_name FROM required_permissions)
            AND (c.relowner=r.oid OR has_table_privilege(r.oid,c.oid,'DELETE') OR has_table_privilege(r.oid,c.oid,'TRUNCATE')
              OR (c.relname IN ('imprima_files','artifact_operation_events') AND has_table_privilege(r.oid,c.oid,'UPDATE'))))) AS restricted_permissions,
      (SELECT count(*)=2 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_proc f ON f.oid=t.tgfoid
        WHERE c.relnamespace='public'::regnamespace AND t.tgenabled IN ('O','A') AND t.tgtype=19
          AND t.tgqual IS NULL AND t.tgattr=''::int2vector
          AND f.pronamespace='public'::regnamespace AND f.proname='protect_imprima_immutable_version'
          AND f.pronargs=0 AND f.prorettype='pg_catalog.trigger'::regtype
          AND f.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
          AND NOT f.prosecdef AND f.proconfig IS NULL AND f.prosrc=${IMMUTABLE_VERSION_FUNCTION_BODY}
          AND ((t.tgname='imprima_file_immutable' AND c.relname='imprima_files')
            OR (t.tgname='imprima_final_immutable' AND c.relname='imprima_jobs'))) AS immutable_versions
  `);
  const row = result.rows[0] ?? {};
  const values: Record<string, unknown> = { ...row, ...operationPolicyChecks(row.policies) };
  const checks = ["restricted_role", "role_membership", "required_permissions", "forced_rls",
    "owner_policies", "authority_policies", "policy_scope", "immutable_versions", "restricted_permissions"]
    .map(id => ({ id, ready: values[id] === true }));
  return { ready: checks.every(c => c.ready), checks };
}
