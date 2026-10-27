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
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { withStartupLock } from "./startup-lock.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "rls");
const CHECK_ONLY = process.argv.includes("--check");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const stop = (message, exitCode) => {
  throw Object.assign(new Error(message), { exitCode });
};

export async function runMigrations(
  client,
  { checkOnly = CHECK_ONLY, password = process.env.APP_DB_PASSWORD, dir = DIR } = {},
) {
  // Cover ledger bootstrap/read, checksums, all file transactions, grants AND
  // role password update. A lock just around ALTER ROLE would leave other races.
  return withStartupLock(client, () => applyMigrations(client, { checkOnly, password, dir }));
}

async function applyMigrations(client, { checkOnly, password, dir }) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS ark_meta;
    CREATE TABLE IF NOT EXISTS ark_meta.schema_migrations (
      filename   text PRIMARY KEY,
      sha256     text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by text NOT NULL DEFAULT current_user
    );`);

  const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
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
      stop("Unrecorded ARK tables require human review.", 3);
    }
  }

  let pending = 0;
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    const sum = sha256(sql);
    if (applied.has(f)) {
      if (applied.get(f) !== sum) {
        console.error(`STOP: ${f} was applied with a different checksum. Migrations are immutable.`);
        stop("Applied migration checksum mismatch.", 4);
      }
      console.log(`ok       ${f}`);
      continue;
    }
    pending++;
    if (checkOnly) { console.log(`pending  ${f}`); continue; }
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO ark_meta.schema_migrations (filename, sha256) VALUES ($1, $2)", [f, sum]);
      await client.query("COMMIT");
      console.log(`applied  ${f}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`FAILED   ${f}; transaction rolled back. Startup must stop.`);
      throw e;
    }
  }

  // Let the verifier (connected as ark_app_login) read the ledger.
  if (!checkOnly) {
    await client.query(`
      GRANT USAGE ON SCHEMA ark_meta TO ark_app;
      GRANT SELECT ON ark_meta.schema_migrations TO ark_app;`);
    if (password) {
      await client.query(
        `ALTER ROLE ark_app_login PASSWORD ${client.escapeLiteral(password)}`);
      console.log("set      ark_app_login password from APP_DB_PASSWORD");
    }
  }
  if (checkOnly && pending) stop("Pending ARK migrations.", 1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) stop("DATABASE_URL is not set", 2);
  const ssl = process.env.PGSSLMODE === "disable" || /sslmode=disable/.test(url)
    ? false : (process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined);
  const client = new pg.Client({
    connectionString: url, ssl, connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    await runMigrations(client);
  } finally {
    // Session termination also releases advisory locks if explicit unlock fails.
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    // Never dump a driver Error object: it may contain connection/query details.
    const code = e?.code === "ARK_STARTUP_LOCK_TIMEOUT" ? e.code
      : typeof e?.code === "string" && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : "UNKNOWN";
    console.error(`ARK migration failed (code ${code}). Startup must stop.`);
    process.exitCode = e.exitCode ?? 1;
  });
}
