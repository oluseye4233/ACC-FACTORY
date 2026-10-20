import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db, usersTable, cartridgeCreditsTable as credits, preparationStorageLeasesTable as leases,
  recoveryFailuresTable as failures, recoveryAlertDeliveriesTable as deliveries,
} from "@workspace/db";
const mail = vi.hoisted(() => vi.fn());
vi.mock("@workspace/email", () => ({ sendRecoveryFailureAlert: mail }));
import { noteRecoveryFailure, resolveRecoveryFailure, dispatchRecoveryAlerts, type RecoverySubject } from "../src/lib/recovery-alerts";

// Future timestamps and resource-scoped dispatch prevent the running dev worker
// from mailing test episodes, or tests from stamping genuine operator episodes.
const NOW = new Date("6500-01-15T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
let userId: string;
let ids: string[] = [];
beforeAll(async () => {
  const [user] = await db.insert(usersTable).values({ clerkUserId: `recovery-alert-${randomUUID()}` }).returning();
  userId = user!.id;
});
beforeEach(() => {
  ids = [];
  mail.mockReset().mockResolvedValue({ ok: true, id: "test-only" });
  vi.stubEnv("ADMIN_EMAILS", "operator@example.test");
  vi.stubEnv("SUBSCRIPTIONS_ENABLED", "true");
  vi.stubEnv("PRIVATE_OBJECT_DIR", "test-only/private");
});
afterEach(async () => {
  if (ids.length) {
    const rows = await db.select().from(failures).where(inArray(failures.resourceId, ids));
    const episodes = [...new Set([
      ...rows.map(row => row.episodeId),
      ...mail.mock.calls.map(call => call[0].idempotencyKey.split("/")[1] as string),
    ])];
    if (episodes.length) await db.delete(deliveries).where(inArray(deliveries.episodeId, episodes));
    await db.delete(failures).where(inArray(failures.resourceId, ids));
    await db.delete(credits).where(inArray(credits.id, ids));
    await db.delete(leases).where(inArray(leases.id, ids));
  }
  vi.unstubAllEnvs();
});
afterAll(async () => { if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId)); });

async function subject(kind: RecoverySubject["kind"] = "credit"): Promise<RecoverySubject> {
  const id = randomUUID();
  ids.push(id);
  const scopeId = kind === "credit" ? randomUUID() : id;
  if (kind === "credit") {
    await db.insert(credits).values({
      id, userId, status: "consumed", reservationToken: scopeId, consumedAt: at(-60),
    });
  } else {
    await db.insert(leases).values({
      id, userId, fileKeys: [`spartan-preparations/${userId}/${id}/file-0`],
      createdAt: at(-1500), nextRecoveryAt: at(-10),
    });
  }
  return { kind, resourceId: id, scopeId };
}
async function repeat(s: RecoverySubject, start = -10) {
  for (const n of [start, start + 5, start + 10]) await noteRecoveryFailure(s, at(n));
}
const dispatch = (minutes = 1) => dispatchRecoveryAlerts(at(minutes), ids);
async function row(s: RecoverySubject) {
  return (await db.select().from(failures).where(eq(failures.resourceId, s.resourceId)))[0]!;
}

describe("durable per-record recovery alerts", () => {
  it("counts overlapping replicas only once per absolute five-minute bucket", async () => {
    const s = await subject();
    await Promise.all(Array.from({ length: 6 }, () => noteRecoveryFailure(s, at(-10))));
    expect((await row(s)).failures).toBe(1);
    await noteRecoveryFailure(s, at(-5));
    expect((await row(s)).failures).toBe(2);
    expect((await dispatch()).delivered).toBe(0);
    expect(mail).not.toHaveBeenCalled();
  });

  it.each(["credit", "preparation"] as const)("notifies once per recipient and episode for %s", async kind => {
    const s = await subject(kind);
    await repeat(s);
    expect((await dispatch()).delivered).toBe(1);
    expect((await dispatch(6)).delivered).toBe(0);
    expect(mail).toHaveBeenCalledOnce();
    expect(mail.mock.calls[0]![0]).toMatchObject({ kind, resourceId: s.resourceId, failures: 3 });
    expect(JSON.stringify(mail.mock.calls)).not.toContain("spartan-preparations");
  });

  it("does not consume a notification when recipients are absent", async () => {
    const s = await subject();
    await repeat(s);
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(await dispatch()).toEqual({ delivered: 0, failed: 0, deferred: true });
    vi.stubEnv("ADMIN_EMAILS", "operator@example.test");
    expect((await dispatch()).delivered).toBe(1);
  });

  it("retries provider failures with the same idempotency key after lease expiry", async () => {
    await repeat(await subject());
    mail.mockResolvedValueOnce({ ok: false, error: "provider unavailable" });
    expect((await dispatch()).failed).toBe(1);
    expect((await dispatch()).delivered).toBe(0); // lease still owned
    expect((await dispatch(4)).delivered).toBe(1);
    expect(mail).toHaveBeenCalledTimes(2);
    expect(mail.mock.calls[0]![0].idempotencyKey).toBe(mail.mock.calls[1]![0].idempotencyKey);
  });

  it("does not stamp a dry-run email as delivered", async () => {
    await repeat(await subject());
    mail.mockResolvedValueOnce({ ok: true, id: "dry-run", dryRun: true });
    expect((await dispatch()).failed).toBe(1);
    expect((await dispatch(4)).delivered).toBe(1);
    expect(mail).toHaveBeenCalledTimes(2);
  });

  it("retries only failed recipients rather than repeating successful deliveries", async () => {
    await repeat(await subject());
    vi.stubEnv("ADMIN_EMAILS", "first@example.test,second@example.test,FIRST@example.test");
    mail.mockResolvedValueOnce({ ok: true, id: "first" }).mockResolvedValueOnce({ ok: false, error: "failed" });
    expect(await dispatch()).toMatchObject({ delivered: 1, failed: 1 });
    expect(await dispatch(4)).toMatchObject({ delivered: 1, failed: 0 });
    expect(mail.mock.calls.map(call => call[0].to)).toEqual([
      "first@example.test", "second@example.test", "second@example.test",
    ]);
  });

  it("fences concurrent delivery claims", async () => {
    await repeat(await subject());
    const reports = await Promise.all([dispatch(), dispatch()]);
    expect(reports.reduce((sum, r) => sum + r.delivered, 0)).toBe(1);
    expect(mail).toHaveBeenCalledOnce();
  });

  it("never alerts an expired credit episode after a newer claim takes ownership", async () => {
    const s = await subject();
    await repeat(s);
    await db.update(credits).set({ reservationToken: randomUUID() }).where(eq(credits.id, s.resourceId));
    expect((await dispatch()).delivered).toBe(0);
    expect(mail).not.toHaveBeenCalled();
  });

  it("never alerts a preparation intent that has committed", async () => {
    const s = await subject("preparation");
    await repeat(s);
    await db.update(leases).set({ state: "COMMITTED" }).where(eq(leases.id, s.resourceId));
    expect((await dispatch()).delivered).toBe(0);
  });

  it("keeps disabled recovery lanes out of operator alerts", async () => {
    await repeat(await subject("credit"));
    await repeat(await subject("preparation"));
    vi.stubEnv("SUBSCRIPTIONS_ENABLED", "false");
    vi.stubEnv("PRIVATE_OBJECT_DIR", "");
    expect((await dispatch()).delivered).toBe(0);
    expect(mail).not.toHaveBeenCalled();
  });

  it("starts a new episode after healing, but ignores delayed pre-healing failures", async () => {
    const s = await subject();
    await repeat(s);
    await dispatch();
    const first = await row(s);
    await resolveRecoveryFailure(s, at(2));
    await noteRecoveryFailure(s, at(1));
    expect((await row(s)).resolvedAt).not.toBeNull();
    await repeat(s, 5);
    const second = await row(s);
    expect(second.episodeId).not.toBe(first.episodeId);
    expect(second.failures).toBe(3);
    expect((await dispatch(16)).delivered).toBe(1);
    expect(mail).toHaveBeenCalledTimes(2);
  });

  it("does not allow future test/fault timestamps to trigger present-day notifications", async () => {
    await repeat(await subject());
    expect((await dispatchRecoveryAlerts(new Date(), ids)).delivered).toBe(0);
    expect(mail).not.toHaveBeenCalled();
  });

  it("fails explicitly rather than silently truncating an excessive administrator list", async () => {
    await repeat(await subject());
    vi.stubEnv("ADMIN_EMAILS", Array.from({ length: 21 }, (_, n) => `admin${n}@example.test`).join(","));
    expect((await dispatch()).failed).toBe(1);
    expect(mail).not.toHaveBeenCalled();
  });
});
