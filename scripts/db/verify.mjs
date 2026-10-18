#!/usr/bin/env node
// =============================================================================
// scripts/db/verify.mjs — fail-closed startup check. Run BEFORE the server starts.
// Connects as the application role (APP_DATABASE_URL). Exits non-zero, and the
// app must not start, if any protection is missing.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "rls");
const url = process.env.APP_DATABASE_URL;
if (!url) { console.error("APP_DATABASE_URL is not set"); process.exit(2); }

// Expected shape of the protected schemas (update when a migration adds tables).
const EXPECT = {
  tables: { imprima: 10, short_sprints: 12 },
  immutableTables: 20,      // tables with the immutable_row trigger
  minPolicies: 49,
};

const client = new pg.Client({ connectionString: url });
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };

async function main() {
  await client.connect();
  const one = async (q, p) => (await client.query(q, p)).rows[0];

  const me = await one(`SELECT current_user AS u, rolsuper, rolbypassrls
                          FROM pg_roles WHERE rolname = current_user`);
  check(me.u === "ark_app_login", `connected as ark_app_login (got ${me.u})`);
  check(!me.rolsuper && !me.rolbypassrls, "app role is not superuser and has no BYPASSRLS");

  const t = await client.query(`
    SELECT n.nspname, count(*)::int AS total,
           count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::int AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('imprima','short_sprints') AND c.relkind = 'r'
     GROUP BY n.nspname`);
  for (const [schema, n] of Object.entries(EXPECT.tables)) {
    const r = t.rows.find((x) => x.nspname === schema) || { total: 0, forced: 0 };
    check(r.total === n, `${schema}: ${r.total} of ${n} expected tables present`);
    check(r.forced === r.total && r.total > 0, `${schema}: RLS enabled and forced on all ${r.total} tables`);
  }

  const trg = await one(`
    SELECT count(DISTINCT tgrelid)::int AS n FROM pg_trigger
     WHERE tgname = 'immutable_row' AND NOT tgisinternal AND tgenabled <> 'D'`);
  check(trg.n === EXPECT.immutableTables,
        `immutability trigger enabled on ${trg.n} of ${EXPECT.immutableTables} tables`);

  const pol = await one(`SELECT count(*)::int AS n FROM pg_policies
                          WHERE schemaname IN ('imprima','short_sprints')`);
  check(pol.n >= EXPECT.minPolicies, `${pol.n} policies present (expected at least ${EXPECT.minPolicies})`);

  const g = await one(`SELECT count(*)::int AS n FROM information_schema.role_table_grants
                        WHERE grantee IN ('ark_app','PUBLIC')
                          AND table_schema IN ('imprima','short_sprints')
                          AND privilege_type IN ('DELETE','TRUNCATE','TRIGGER','REFERENCES')`);
  check(g.n === 0, "no DELETE, TRUNCATE, TRIGGER or REFERENCES grant to the app");

  // Ledger: every migration file on disk is applied with the same checksum.
  const ledger = new Map((await client.query(
    "SELECT filename, sha256 FROM ark_meta.schema_migrations")).rows.map((r) => [r.filename, r.sha256]));
  for (const f of readdirSync(DIR).filter((x) => /^\d{3}_.+\.sql$/.test(x)).sort()) {
    const sum = createHash("sha256").update(readFileSync(join(DIR, f), "utf8")).digest("hex");
    check(ledger.get(f) === sum, `migration ${f} applied with matching checksum`);
  }

  // Context: with no request context the app sees nothing.
  const leak = await one("SELECT count(*)::int AS n FROM imprima.publish_jobs");
  check(leak.n === 0, "no request context -> 0 rows visible");

  await client.end();
  if (failures.length) {
    console.error(`\nREFUSING TO START: ${failures.length} security check(s) failed.`);
    process.exit(1);
  }
  console.log("\nDatabase security verified.");
}

main().catch((e) => { console.error("REFUSING TO START:", e.message); process.exit(1); });
