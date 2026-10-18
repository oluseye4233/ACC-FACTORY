#!/usr/bin/env node
// =============================================================================
// scripts/db/migrate.mjs — apply db/rls/*.sql in order, once each, with a
// checksum ledger. Connects as the database OWNER (Replit's DATABASE_URL).
//
//   node scripts/db/migrate.mjs            apply pending migrations
//   node scripts/db/migrate.mjs --check    report only; exit 1 if anything pending
//
// Rules
//   * Each file runs in its own transaction; any error rolls it back and stops.
//   * An applied file whose checksum changed is refused (migrations are
//     immutable, like the records they protect). Write a new file instead.
//   * If ARK tables already exist but the ledger does not list them (for example
//     a platform schema sync created them without RLS), the runner STOPS and asks
//     for a human. It never "adopts" unprotected tables.
//   * Sets ark_app_login's password from APP_DB_PASSWORD if that secret exists.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "rls");
const CHECK_ONLY = process.argv.includes("--check");
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(2); }

const ssl = process.env.PGSSLMODE === "disable" || /sslmode=disable/.test(url)
  ? false : (process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined);
const client = new pg.Client({ connectionString: url, ssl });

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

async function main() {
  await client.connect();
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS ark_meta;
    CREATE TABLE IF NOT EXISTS ark_meta.schema_migrations (
      filename   text PRIMARY KEY,
      sha256     text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by text NOT NULL DEFAULT current_user
    );`);

  const files = readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const { rows } = await client.query("SELECT filename, sha256 FROM ark_meta.schema_migrations");
  const applied = new Map(rows.map((r) => [r.filename, r.sha256]));

  // Guard: ARK tables that exist without a ledger entry were not made by us.
  if (applied.size === 0) {
    const { rows: stray } = await client.query(`
      SELECT n.nspname || '.' || c.relname AS t FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname IN ('imprima','short_sprints') AND c.relkind = 'r'`);
    if (stray.length) {
      console.error("STOP: ARK tables exist but no migration has been recorded:");
      stray.forEach((r) => console.error("  " + r.t));
      console.error("They may lack RLS and triggers. A human must inspect them (see PDD Part 4.6).");
      process.exit(3);
    }
  }

  let pending = 0;
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), "utf8");
    const sum = sha256(sql);
    if (applied.has(f)) {
      if (applied.get(f) !== sum) {
        console.error(`STOP: ${f} was applied with a different checksum. Migrations are immutable.`);
        process.exit(4);
      }
      console.log(`ok       ${f}`);
      continue;
    }
    pending++;
    if (CHECK_ONLY) { console.log(`pending  ${f}`); continue; }
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO ark_meta.schema_migrations (filename, sha256) VALUES ($1, $2)", [f, sum]);
      await client.query("COMMIT");
      console.log(`applied  ${f}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`FAILED   ${f}: ${e.message}`);
      process.exit(1);
    }
  }

  // Let the verifier (connected as ark_app_login) read the ledger.
  if (!CHECK_ONLY) {
    await client.query(`
      GRANT USAGE ON SCHEMA ark_meta TO ark_app;
      GRANT SELECT ON ark_meta.schema_migrations TO ark_app;`);
    if (process.env.APP_DB_PASSWORD) {
      await client.query(
        `ALTER ROLE ark_app_login PASSWORD ${client.escapeLiteral(process.env.APP_DB_PASSWORD)}`);
      console.log("set      ark_app_login password from APP_DB_PASSWORD");
    }
  }
  await client.end();
  if (CHECK_ONLY && pending) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
