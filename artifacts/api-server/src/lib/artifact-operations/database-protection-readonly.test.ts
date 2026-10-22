import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { databaseProtection } from "./database-protection";
import { withOperationsActor } from "./context";

/** Development catalog/context probes only: no fixtures or security DDL.
 * This is not a production RLS attestation or a tenant-isolation write test.
 */
describe("read-only development workflow guard integration", () => {
  it("verifies the reviewed development catalog in a read-only transaction", async () => {
    await db.transaction(async tx => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      const status = await databaseProtection(tx);
      expect(status.checks).toHaveLength(9);
      expect(status.checks.filter(c => !c.ready)).toEqual([]);
      expect(status.ready).toBe(true);
    });
  });
  it("enters the restricted role and clears actor/admin state before reusing the same connection", async () => {
    // Pin one connection for the probe, so reset is not accidentally tested on
    // a different idle connection. Savepoint rollback resets SET LOCAL state.
    await db.transaction(async tx => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      const readContext = async () => (await tx.execute(sql`SELECT current_user AS role,
        current_setting('app.operations_actor',true) AS actor,
        current_setting('app.operations_admin',true) AS admin`)).rows[0];
      const before = await readContext();
      await tx.execute(sql`SAVEPOINT workflow_context_probe`);
      const id = randomUUID();
      await tx.execute(sql`SET LOCAL ROLE atanda_artifact_operations`);
      await tx.execute(sql`SELECT set_config('app.operations_actor',${id},true),set_config('app.operations_admin','false',true)`);
      expect(await readContext()).toMatchObject({ role: "atanda_artifact_operations", actor: id, admin: "false" });
      await tx.execute(sql`ROLLBACK TO SAVEPOINT workflow_context_probe`);
      const after = await readContext();
      expect(after.role).toBe(before.role);
      // PostgreSQL may retain an empty placeholder for a rolled-back custom
      // GUC that did not previously exist; neither is authenticated context.
      expect(after.actor ?? "").toBe(before.actor ?? "");
      expect(after.admin ?? "").toBe(before.admin ?? "");
    });
  });
  it("runs the actual workflow callback only under the restricted, non-admin context", async () => {
    const id = randomUUID();
    const row = await withOperationsActor({ id, role: "PRACTITIONER", displayName: "Read-only fixture" }, async tx => {
      // The wrapper runs catalog SELECTs and transaction-local settings only.
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      const result = await tx.execute(sql`SELECT current_user AS role,
        current_setting('app.operations_actor',true) AS actor,
        current_setting('app.operations_admin',true) AS admin`);
      return result.rows[0];
    });
    expect(row).toMatchObject({ role: "atanda_artifact_operations", actor: id, admin: "false" });
  });
});
