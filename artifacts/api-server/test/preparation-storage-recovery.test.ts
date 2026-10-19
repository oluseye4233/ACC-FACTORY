import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable as artifacts, preparationStorageLeasesTable as leases } from "@workspace/db";
import { recoverPreparationStorage } from "../src/lib/artifact-operations/preparation-recovery";
import { logger } from "../src/lib/logger";

describe("private preparation recovery", () => {
  let userId: string;
  let sessionId: string;
  const day = 86_400_000;
  const storage = { inspect: vi.fn(), remove: vi.fn() };
  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({ clerkUserId: `preparation-recovery-${randomUUID()}` }).returning();
    userId = user!.id;
    const [session] = await db.insert(harnessSessionsTable).values({ userId, sessionName: "Preparation recovery fixture" }).returning();
    sessionId = session!.id;
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    storage.inspect.mockReset().mockResolvedValue({ generation: "123", createdAt: new Date(Date.now() - 2 * day) });
    storage.remove.mockReset().mockResolvedValue("deleted");
    await db.delete(artifacts).where(eq(artifacts.userId, userId));
    await db.delete(leases).where(eq(leases.userId, userId));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    if (userId) {
      await db.delete(artifacts).where(eq(artifacts.userId, userId));
      await db.delete(leases).where(eq(leases.userId, userId));
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  });
  async function intent(count = 1, overrides: Partial<typeof leases.$inferInsert> = {}) {
    const id = randomUUID();
    const [row] = await db.insert(leases).values({
      id, userId, createdAt: new Date(Date.now() - 3 * day), nextRecoveryAt: new Date(Date.now() - day),
      fileKeys: Array.from({ length: count }, (_, i) => `spartan-preparations/${userId}/${id}/file-${i}`),
      ...overrides,
    }).returning();
    return row!;
  }
  async function current(id: string) {
    const [row] = await db.select().from(leases).where(eq(leases.id, id));
    return row!;
  }
  async function archive(id: string, objectKey: string) {
    await db.insert(artifacts).values({
      id, userId, sessionId, featureId: -210, artifactType: "IMPRIMA_PREPARATION",
      artifactContent: { files: [{ objectKey }], releaseAllowed: false },
    });
  }
  it("defaults to report-only with no file deletion or persistent metadata changes", async () => {
    const lease = await intent();
    const report = await recoverPreparationStorage({ storage });
    expect(report).toMatchObject({ dryRun: true, scanned: 1, candidates: 1, deleted: 0, errors: 0 });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(await current(lease.id)).toEqual(lease);
  });
  it("deletes only an expired unreferenced file's inspected generation and retains its durable provenance", async () => {
    const lease = await intent();
    const report = await recoverPreparationStorage({ dryRun: false, storage });
    expect(report).toMatchObject({ deleted: 1, errors: 0 });
    expect(storage.remove).toHaveBeenCalledWith(lease.fileKeys[0], "123");
    expect(await current(lease.id)).toMatchObject({ state: "RECOVERED", fileKeys: lease.fileKeys });
  });
  it("does not inspect young intents or anything without a durable upload intent", async () => {
    await intent(1, { createdAt: new Date() });
    expect((await recoverPreparationStorage({ dryRun: false, storage })).scanned).toBe(0);
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("retains a recent upload even when its intent is old", async () => {
    const lease = await intent();
    storage.inspect.mockResolvedValue({ generation: "123", createdAt: new Date() });
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ retained: 1, deleted: 0 });
    expect((await current(lease.id)).state).toBe("UPLOADING");
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("retains a committed artifact after an ambiguous result and retires its recovery intent", async () => {
    const lease = await intent();
    await archive(lease.id, lease.fileKeys[0]!);
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ retained: 1, deleted: 0 });
    expect((await current(lease.id)).state).toBe("COMMITTED");
    expect(storage.inspect).not.toHaveBeenCalled();
  });
  it("retains shared file references even when another artifact holds them", async () => {
    const lease = await intent(2);
    await archive(randomUUID(), lease.fileKeys[1]!);
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ retained: 2, deleted: 0 });
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("skips an active upload that holds the same account's cross-process advisory lock", async () => {
    await intent();
    let signal!: () => void, release!: () => void;
    const locked = new Promise<void>(r => { signal = r; });
    const gate = new Promise<void>(r => { release = r; });
    const writer = db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), 210)`);
      signal(); await gate;
    });
    await locked;
    try {
      expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ busy: 1, deleted: 0 });
      expect(storage.inspect).not.toHaveBeenCalled();
    } finally { release(); await writer; }
  });
  it("retains files with unknown age or an invalid generation", async () => {
    await intent(2);
    storage.inspect.mockResolvedValueOnce({ generation: "", createdAt: new Date(Date.now() - 2 * day) })
      .mockResolvedValueOnce({ generation: "123", createdAt: new Date(NaN) });
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ retained: 2, deleted: 0 });
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("does not delete a changed object and schedules another conservative inspection", async () => {
    const lease = await intent();
    storage.remove.mockResolvedValue("changed");
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ retained: 1, deleted: 0 });
    expect((await current(lease.id)).state).toBe("UPLOADING");
  });
  it("retries partial deletion safely without erasing the recovery intent", async () => {
    const lease = await intent(2);
    storage.remove.mockResolvedValueOnce("deleted").mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ deleted: 1, errors: 1 });
    expect((await current(lease.id)).state).toBe("UPLOADING");
    await db.update(leases).set({ nextRecoveryAt: new Date(Date.now() - day) }).where(eq(leases.id, lease.id));
    storage.inspect.mockResolvedValueOnce(null); // first deletion already took effect despite DB rollback
    storage.remove.mockResolvedValue("deleted");
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ missing: 1, deleted: 1, errors: 0 });
    expect((await current(lease.id)).state).toBe("RECOVERED");
  });
  it("rejects mismatched file ownership without touching storage", async () => {
    await intent(1, { fileKeys: [`spartan-preparations/${randomUUID()}/${randomUUID()}/file-0`] });
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ errors: 1, deleted: 0 });
    expect(storage.inspect).not.toHaveBeenCalled();
  });
  it("revisits recovered intents to catch a late-arriving object", async () => {
    const lease = await intent(1, { state: "RECOVERED" });
    expect(await recoverPreparationStorage({ dryRun: false, storage })).toMatchObject({ deleted: 1 });
    expect((await current(lease.id)).fileKeys).toEqual(lease.fileKeys);
  });
  it("bounds a scan to twenty durable intents", async () => {
    for (let i = 0; i < 21; i++) await intent();
    const first = await recoverPreparationStorage({ dryRun: false, storage });
    expect(first.scanned).toBe(20);
    expect((await recoverPreparationStorage({ dryRun: false, storage })).scanned).toBe(1);
  });
  it("fails closed on an unknown or future intent state", async () => {
    const lease = await intent();
    await db.execute(sql`UPDATE preparation_storage_leases SET state = 'UNKNOWN_FUTURE_STATE' WHERE id = ${lease.id}::uuid`);
    expect((await recoverPreparationStorage({ dryRun: false, storage })).scanned).toBe(0);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
