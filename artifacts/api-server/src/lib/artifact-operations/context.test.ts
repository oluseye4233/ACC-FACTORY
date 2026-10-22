import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { withOperationsActor } from "./context";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), protection: vi.fn() }));
vi.mock("@workspace/db", async original => ({
  ...await original<typeof import("@workspace/db")>(), db: { transaction: mocks.transaction },
}));
vi.mock("./database-protection", () => ({ databaseProtection: mocks.protection }));
const actor = { id: "00000000-0000-4000-8000-000000000001", role: "ADMIN", displayName: "Test approver" };
const dialect = new PgDialect();
beforeEach(() => {
  vi.resetAllMocks();
  mocks.protection.mockResolvedValue({ ready: true, checks: [] });
  mocks.execute.mockResolvedValue({ rows: [{ restricted_actor: true }] });
  mocks.transaction.mockImplementation(fn => fn({ execute: mocks.execute }));
});
describe("restricted protected-workflow transaction", () => {
  it("withholds the workflow callback when any readiness check fails", async () => {
    mocks.protection.mockResolvedValue({ ready: false, checks: [{ id: "required_permissions", ready: false }] });
    const work = vi.fn();
    await expect(withOperationsActor(actor, work)).rejects.toMatchObject({ status: 503, code: "DATABASE_GUARDS_MISSING" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });
  it("does not continue when catalog protection cannot be read", async () => {
    mocks.protection.mockRejectedValueOnce(new Error("catalog read denied"));
    const work = vi.fn();
    await expect(withOperationsActor(actor, work)).rejects.toThrow("catalog read denied");
    expect(work).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("never falls back to the owner connection when SET ROLE fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("role membership denied"));
    const work = vi.fn();
    await expect(withOperationsActor(actor, work)).rejects.toMatchObject({ status: 503, code: "DATABASE_ROLE_UNAVAILABLE" });
    expect(work).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it.each([false, undefined, "true"])("requires boolean confirmation of the effective restricted role (%s)", async flag => {
    mocks.execute.mockResolvedValue({ rows: [{ restricted_actor: flag }] });
    const work = vi.fn();
    await expect(withOperationsActor(actor, work)).rejects.toMatchObject({ status: 503, code: "DATABASE_ROLE_UNVERIFIED" });
    expect(work).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
  it("refuses an empty effective-role query result", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    await expect(withOperationsActor(actor, vi.fn())).rejects.toMatchObject({ code: "DATABASE_ROLE_UNVERIFIED" });
  });
  it.each([["ADMIN", "true"], ["PRACTITIONER", "false"], ["admin", "false"]])(
    "binds verified actor context locally for role %s", async (role, admin) => {
      const work = vi.fn().mockResolvedValue("workflow result");
      expect(await withOperationsActor({ ...actor, role }, work)).toBe("workflow result");
      const queries = mocks.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query));
      expect(queries[0].sql).toBe("SET LOCAL ROLE atanda_artifact_operations");
      expect(queries[1].sql).toContain("current_user='atanda_artifact_operations'");
      expect(queries[1].sql).toContain("NOT rolbypassrls");
      expect(queries[2].sql).toContain("set_config('app.operations_actor'");
      expect(queries[2].sql).toContain("set_config('app.operations_admin'");
      expect(queries[2].sql.match(/, true\)/g)).toHaveLength(2);
      expect(queries[2].params).toEqual([actor.id, admin]);
      expect(work).toHaveBeenCalledExactlyOnceWith({ execute: mocks.execute });
    });
});
