import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { OperationsTx } from "./context";

/**
 * Read-only readiness, shared by the verifier UI and the fail-closed full lane.
 * This does not install, repair or migrate anything in either environment.
 */
export async function databaseProtection(executor: Pick<OperationsTx, "execute"> = db) {
  const result = await executor.execute(sql`
    SELECT
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atanda_artifact_operations'
        AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin
        AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) AS restricted_role,
      (SELECT count(*)=5 FROM pg_class WHERE relnamespace='public'::regnamespace
        AND relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')
        AND relrowsecurity AND relforcerowsecurity) AS forced_rls,
      (SELECT count(*)=4 FROM pg_policy p
        JOIN pg_class c ON c.oid=p.polrelid AND c.relnamespace='public'::regnamespace
        JOIN (VALUES ('imprima_jobs','imprima_jobs_owner'),('imprima_files','imprima_files_owner'),
          ('short_sprint_runs','short_sprint_runs_owner'),('artifact_operation_events','artifact_operation_events_owner')) expected(tbl,pol)
          ON c.relname=expected.tbl AND p.polname=expected.pol
        WHERE p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL
          AND pg_get_expr(p.polqual,p.polrelid) LIKE '%app.operations_actor%'
          AND pg_get_expr(p.polwithcheck,p.polrelid) LIKE '%app.operations_actor%'
          AND pg_get_expr(p.polqual,p.polrelid) LIKE '%user_id%') AS owner_policies,
      (SELECT count(*)=3 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
        WHERE c.relnamespace='public'::regnamespace AND c.relname='sprint_verifier_authorities' AND (
          (p.polname='sprint_verifiers_read' AND pg_get_expr(p.polqual,p.polrelid) LIKE '%app.operations_actor%')
          OR (p.polname='sprint_verifiers_admin_insert' AND pg_get_expr(p.polwithcheck,p.polrelid) LIKE '%app.operations_admin%')
          OR (p.polname='sprint_verifiers_admin_update' AND pg_get_expr(p.polqual,p.polrelid) LIKE '%app.operations_admin%'
            AND pg_get_expr(p.polwithcheck,p.polrelid) LIKE '%app.operations_admin%'))) AS authority_policies,
      (EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atanda_artifact_operations')
        AND NOT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN pg_roles r
          WHERE r.rolname='atanda_artifact_operations' AND c.relnamespace='public'::regnamespace
            AND c.relname IN ('imprima_jobs','imprima_files','short_sprint_runs','artifact_operation_events','sprint_verifier_authorities')
            AND (has_table_privilege(r.oid,c.oid,'DELETE') OR has_table_privilege(r.oid,c.oid,'TRUNCATE')
              OR (c.relname IN ('imprima_files','artifact_operation_events') AND has_table_privilege(r.oid,c.oid,'UPDATE'))))) AS restricted_permissions,
      (SELECT count(*)=2 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_proc f ON f.oid=t.tgfoid
        WHERE c.relnamespace='public'::regnamespace AND t.tgenabled='O' AND t.tgtype=19
          AND f.pronamespace='public'::regnamespace AND f.proname='protect_imprima_immutable_version'
          AND ((t.tgname='imprima_file_immutable' AND c.relname='imprima_files')
            OR (t.tgname='imprima_final_immutable' AND c.relname='imprima_jobs'))) AS immutable_versions
  `);
  const row = result.rows[0] ?? {};
  const checks = ["restricted_role", "forced_rls", "owner_policies", "authority_policies", "immutable_versions", "restricted_permissions"].map(id => ({ id, ready: row[id] === true }));
  return { ready: checks.every(c => c.ready), checks };
}
