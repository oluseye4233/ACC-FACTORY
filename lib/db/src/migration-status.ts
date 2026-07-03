import fs from "node:fs";
import path from "node:path";
import type pg from "pg";

/**
 * Migration drift detection.
 *
 * The dev/test DB is synced by applying committed drizzle migrations
 * (`pnpm --filter @workspace/db run migrate`). When a merge lands a new
 * migration but `migrate` doesn't run, the DB silently falls behind the
 * committed schema and features 500 at runtime ("relation/column does not
 * exist"). This module compares the committed migration journal
 * (`lib/db/migrations/meta/_journal.json`) against the applied rows in
 * `drizzle.__drizzle_migrations` so the drift is caught at startup / in
 * post-merge output instead of via a broken feature.
 *
 * Drizzle's migrator stores each applied migration's journal `when`
 * timestamp as `created_at`, so membership of journal `when` values in the
 * applied `created_at` set identifies exactly which entries are pending.
 */

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

export type MigrationStatus =
  | {
      status: "ok";
      appliedCount: number;
      journalCount: number;
    }
  | {
      status: "pending";
      appliedCount: number;
      journalCount: number;
      pendingTags: string[];
    }
  | {
      /** The check could not run (journal or migrations table not found). */
      status: "unknown";
      reason: string;
    };

const JOURNAL_RELATIVE_PATH = path.join(
  "lib",
  "db",
  "migrations",
  "meta",
  "_journal.json",
);

/**
 * Walk up from `startDir` looking for `lib/db/migrations/meta/_journal.json`.
 * Works from any workspace CWD (repo root, an artifact dir, or `scripts/`).
 * Returns null when the journal cannot be found (e.g. a deployment bundle
 * that doesn't ship workspace sources).
 */
export function findMigrationJournal(
  startDir: string = process.cwd(),
): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, JOURNAL_RELATIVE_PATH);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Compare the committed migration journal against the applied migrations in
 * `drizzle.__drizzle_migrations`.
 *
 * Never throws for "environment doesn't support the check" conditions
 * (missing journal file, missing migrations table) — those return
 * `status: "unknown"` so callers can decide how loud to be. A genuine query
 * failure (e.g. DB unreachable) DOES propagate so callers can distinguish it.
 */
export async function getMigrationStatus(
  pool: pg.Pool,
  startDir?: string,
): Promise<MigrationStatus> {
  const journalPath = findMigrationJournal(startDir);
  if (!journalPath) {
    return {
      status: "unknown",
      reason: `migration journal not found (looked for ${JOURNAL_RELATIVE_PATH} walking up from ${path.resolve(startDir ?? process.cwd())})`,
    };
  }

  let entries: JournalEntry[];
  try {
    const parsed = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries?: JournalEntry[];
    };
    entries = parsed.entries ?? [];
  } catch (err) {
    return {
      status: "unknown",
      reason: `failed to parse migration journal at ${journalPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const tableExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
     ) AS "exists"`,
  );
  if (!tableExists.rows[0]?.exists) {
    return {
      status: "unknown",
      reason:
        "drizzle.__drizzle_migrations table does not exist — this database is not migration-managed (e.g. production is synced via Publish)",
    };
  }

  const applied = await pool.query<{ created_at: string }>(
    "SELECT created_at FROM drizzle.__drizzle_migrations",
  );
  const appliedWhens = new Set(applied.rows.map((r) => String(r.created_at)));

  const pendingTags = entries
    .filter((e) => !appliedWhens.has(String(e.when)))
    .map((e) => e.tag);

  if (pendingTags.length > 0) {
    return {
      status: "pending",
      appliedCount: appliedWhens.size,
      journalCount: entries.length,
      pendingTags,
    };
  }

  return {
    status: "ok",
    appliedCount: appliedWhens.size,
    journalCount: entries.length,
  };
}

/** The one command that fixes pending migrations — used in log messages. */
export const MIGRATE_FIX_COMMAND = "pnpm --filter @workspace/db run migrate";
