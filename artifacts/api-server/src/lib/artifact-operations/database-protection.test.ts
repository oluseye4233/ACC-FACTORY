import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { databaseProtection } from "./database-protection";
import { EXPECTED_OPERATION_POLICIES, IMMUTABLE_VERSION_FUNCTION_BODY, REQUIRED_OPERATION_PRIVILEGES } from "./database-protection-contract";
import type { OperationsTx } from "./context";

const readyRow = () => ({
  restricted_role: true, role_membership: true, required_permissions: true,
  forced_rls: true, immutable_versions: true, restricted_permissions: true,
  policies: EXPECTED_OPERATION_POLICIES.map(p => ({ ...p, permissive: true, roles: ["0"] })),
});
function executor(row: Record<string, unknown> | undefined = readyRow()) {
  const execute = vi.fn().mockResolvedValue({ rows: row ? [row] : [] });
  return { execute } as unknown as Pick<OperationsTx, "execute"> & { execute: typeof execute };
}
describe("fail-closed protected workflow readiness", () => {
  it("requires the full set of independently named checks", async () => {
    const status = await databaseProtection(executor());
    expect(status.ready).toBe(true);
    expect(status.checks.map(c => c.id)).toEqual([
      "restricted_role", "role_membership", "required_permissions", "forced_rls",
      "owner_policies", "authority_policies", "policy_scope", "immutable_versions", "restricted_permissions",
    ]);
  });
  it.each(["restricted_role", "role_membership", "required_permissions", "forced_rls", "immutable_versions", "restricted_permissions"])(
    "does not let other passing checks hide a failed %s", async id => {
      const status = await databaseProtection(executor({ ...readyRow(), [id]: false }));
      expect(status.ready).toBe(false);
      expect(status.checks.find(c => c.id === id)?.ready).toBe(false);
    });
  it("requires actual boolean truth, not missing or truthy text", async () => {
    for (const value of [null, undefined, "true", 1]) {
      expect((await databaseProtection(executor({ ...readyRow(), required_permissions: value }))).ready).toBe(false);
    }
    expect((await databaseProtection(executor({}))).ready).toBe(false);
    const empty = executor();
    empty.execute.mockResolvedValueOnce({ rows: [] });
    expect((await databaseProtection(empty)).ready).toBe(false);
  });
  it("propagates catalog read errors instead of reporting ready", async () => {
    const e = executor();
    e.execute.mockRejectedValueOnce(new Error("catalog unavailable"));
    await expect(databaseProtection(e)).rejects.toThrow("catalog unavailable");
  });
  it("checks positive privileges, forbidden privileges, role switching and trigger implementation with read-only SQL", async () => {
    const e = executor();
    await databaseProtection(e);
    const query = new PgDialect().sqlToQuery(e.execute.mock.calls[0][0]);
    expect(query.sql).toContain("has_table_privilege");
    expect(query.sql).toContain("pg_has_role");
    expect(query.sql).toContain("has_schema_privilege");
    expect(query.sql).toContain("c.relowner=r.oid");
    expect(query.sql).toContain("t.tgqual IS NULL");
    expect(query.sql).toContain("t.tgattr=''");
    expect(query.sql).toContain("f.prosrc=");
    expect(query.sql).toContain("f.prolang=");
    expect(query.sql).not.toMatch(/\b(CREATE|ALTER|GRANT|REVOKE|INSERT INTO|UPDATE SET|DELETE FROM)\b(?!')/);
    expect(query.params).toContain(IMMUTABLE_VERSION_FUNCTION_BODY);
    expect(query.params.slice(0, -1)).toEqual(REQUIRED_OPERATION_PRIVILEGES.flat());
    expect(REQUIRED_OPERATION_PRIVILEGES).toContainEqual(["imprima_files", "INSERT"]);
    expect(REQUIRED_OPERATION_PRIVILEGES).not.toContainEqual(["imprima_files", "UPDATE"]);
    expect(REQUIRED_OPERATION_PRIVILEGES).toContainEqual(["command_deck_traces", "INSERT"]);
    expect(REQUIRED_OPERATION_PRIVILEGES).toContainEqual(["vte_verification_failures", "UPDATE"]);
  });
});
