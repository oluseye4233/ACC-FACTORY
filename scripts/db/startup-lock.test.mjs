import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { withStartupLock } from "./startup-lock.mjs";
import { runMigrations } from "./migrate.mjs";

test("two cooperating sessions cannot execute startup work concurrently", async () => {
  let holder;
  let active = 0;
  let maximum = 0;
  const events = [];
  function client(id) {
    return {
      async query(sql) {
        if (sql.includes("pg_try_advisory_lock")) {
          const acquired = holder === undefined;
          if (acquired) holder = id;
          return { rows: [{ acquired }] };
        }
        assert.equal(holder, id);
        holder = undefined;
        events.push(`unlock-${id}`);
        return { rows: [] };
      },
    };
  }
  await Promise.all([1, 2].map((id) => withStartupLock(client(id), async () => {
    active++;
    maximum = Math.max(maximum, active);
    events.push(`work-${id}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
  }, { pause: () => new Promise((resolve) => setTimeout(resolve, 1)) })));
  assert.equal(maximum, 1);
  assert.deepEqual(events, ["work-1", "unlock-1", "work-2", "unlock-2"]);
});

test("lock timeout fails closed without running work or unlocking someone else's lock", async () => {
  let clock = 0;
  const queries = [];
  const client = { async query(sql) { queries.push(sql); return { rows: [{ acquired: false }] }; } };
  await assert.rejects(withStartupLock(client, () => assert.fail("must not run"), {
    timeoutMs: 10, now: () => clock, pause: async (ms) => { clock += ms; },
  }), /timed out/);
  assert.ok(queries.every((sql) => sql.includes("pg_try_advisory_lock")));
});

test("query failure cannot bypass lock acquisition", async () => {
  await assert.rejects(withStartupLock({
    async query() { throw new Error("connection lost"); },
  }, () => assert.fail("must not run")), /connection lost/);
});

test("work failure releases the lock and propagates failure", async () => {
  const queries = [];
  await assert.rejects(withStartupLock({
    async query(sql) { queries.push(sql); return { rows: [{ acquired: true }] }; },
  }, async () => { throw new Error("security verification must stop"); }), /must stop/);
  assert.match(queries.at(-1), /pg_advisory_unlock/);
});

const sql = "SELECT 'mock migration only';";
const checksum = createHash("sha256").update(sql).digest("hex");
async function fixture(work, { applied = [], stray = [], failSql = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ark-runner-test-"));
  writeFileSync(join(dir, "000_test.sql"), sql);
  const queries = [];
  const client = {
    escapeLiteral: (value) => `'${value.replaceAll("'", "''")}'`,
    async query(query, params) {
      queries.push({ query, params });
      if (query.includes("pg_try_advisory_lock")) return { rows: [{ acquired: true }] };
      if (query.startsWith("SELECT filename")) return { rows: applied };
      if (query.includes("FROM pg_class")) return { rows: stray };
      if (query === sql && failSql) throw new Error("simulated SQL failure");
      return { rows: [] };
    },
  };
  try { await work(client, dir, queries); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("the entire runner, including ledger and password update, stays inside the lock", async () => {
  await fixture(async (client, dir, queries) => {
    await runMigrations(client, { dir, password: "synthetic-test-only" });
    assert.match(queries[0].query, /pg_try_advisory_lock/);
    assert.match(queries.at(-1).query, /pg_advisory_unlock/);
    const statements = queries.map((q) => q.query);
    assert.ok(statements.includes("BEGIN"));
    assert.ok(statements.includes("COMMIT"));
    assert.ok(statements.some((q) => q.includes("INSERT INTO ark_meta.schema_migrations")));
    assert.ok(statements.some((q) => q.includes("ALTER ROLE ark_app_login PASSWORD")));
  });
});

test("unchanged recorded migrations are not replayed", async () => {
  await fixture(async (client, dir, queries) => {
    await runMigrations(client, { dir, password: "" });
    assert.equal(queries.some((q) => q.query === sql), false);
  }, { applied: [{ filename: "000_test.sql", sha256: checksum }] });
});

test("checksum drift and unrecorded tables still stop startup before password updates", async () => {
  for (const options of [
    { applied: [{ filename: "000_test.sql", sha256: "wrong" }] },
    { stray: [{ t: "imprima.existing" }] },
  ]) {
    await fixture(async (client, dir, queries) => {
      await assert.rejects(runMigrations(client, { dir, password: "synthetic" }));
      assert.equal(queries.some((q) => q.query.includes("ALTER ROLE")), false);
      assert.match(queries.at(-1).query, /pg_advisory_unlock/);
    }, options);
  }
});

test("SQL failure rolls back, unlocks and never updates the password", async () => {
  await fixture(async (client, dir, queries) => {
    await assert.rejects(runMigrations(client, { dir, password: "synthetic" }), /simulated SQL/);
    assert.ok(queries.some((q) => q.query === "ROLLBACK"));
    assert.equal(queries.some((q) => q.query === "COMMIT" || q.query.includes("ALTER ROLE")), false);
    assert.match(queries.at(-1).query, /pg_advisory_unlock/);
  }, { failSql: true });
});

test("check-only pending migrations remain nonzero without applying SQL or credentials", async () => {
  await fixture(async (client, dir, queries) => {
    await assert.rejects(runMigrations(client, { dir, checkOnly: true, password: "synthetic" }), /Pending/);
    assert.equal(queries.some((q) => q.query === sql || q.query.includes("ALTER ROLE")), false);
    assert.match(queries.at(-1).query, /pg_advisory_unlock/);
  });
});
