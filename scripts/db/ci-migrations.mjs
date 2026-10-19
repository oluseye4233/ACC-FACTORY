// Disposable CI databases only. Never imported by application/deployment startup.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export function assertDisposableTarget(connectionString) {
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/workspace_test") {
    throw new Error("CI migration replay requires a localhost database named workspace_test; no changes made.");
  }
}

export function baselinePayload(source) {
  const start = source.indexOf("/*");
  const end = source.lastIndexOf("*/");
  if (start < 0 || end < start || source.slice(end + 2).trim()) {
    throw new Error("Unexpected introspection baseline format; review required.");
  }
  return source.slice(start + 2, end).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
}

async function main() {
  const connectionString = process.env.DATABASE_URL ?? "";
  assertDisposableTarget(connectionString);
  const folder = fileURLToPath(new URL("../../lib/db/migrations/", import.meta.url));
  const journal = JSON.parse(await readFile(`${folder}/meta/_journal.json`, "utf8"));
  const baseline = journal.entries[0];
  if (baseline.tag !== "0000_harsh_miss_america") throw new Error("Unexpected baseline; review required.");
  const source = await readFile(`${folder}/${baseline.tag}.sql`, "utf8");
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      // Fail on a non-empty target, rather than fabricating an applied ledger.
      const existing = await client.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')");
      if (existing.rows[0].n !== 0) throw new Error("CI migration replay requires an empty database; no changes made.");
      await client.query("BEGIN");
      try {
        // 0000 is an intentionally commented introspection baseline. Execute its
        // SQL only here, on the empty throwaway database, before recording it.
        for (const [index, statement] of baselinePayload(source).entries()) {
          try { await client.query(statement); }
          catch (error) { throw new Error(`${baseline.tag}.sql statement ${index + 1}: ${error.message}`); }
        }
        await client.query('CREATE SCHEMA "drizzle"');
        await client.query('CREATE TABLE "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
        await client.query('INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
          [createHash("sha256").update(source).digest("hex"), baseline.when]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally { client.release(); }
    await migrate(drizzle(pool), { migrationsFolder: folder });
    const result = await pool.query('SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"');
    if (result.rows[0].n !== journal.entries.length) throw new Error("Migration ledger count does not match the committed journal.");
    // A replay must also be safe to rerun with no new migrations.
    await migrate(drizzle(pool), { migrationsFolder: folder });
    console.log(`PASS: baseline and ${journal.entries.length - 1} incremental migrations applied; second migrate is a no-op.`);
  } finally { await pool.end(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))) {
  main().catch(error => {
    // Do not print connection strings or database error detail containing data.
    console.error(`FAIL: CI migration replay: ${error.message}`);
    process.exitCode = 1;
  });
}
