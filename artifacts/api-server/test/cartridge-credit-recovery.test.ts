import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, usersTable, cartridgeCreditsTable as credits, cartridgePackagesTable as packages } from "@workspace/db";
import {
  claimCartridgeCredit, releaseCartridgeCredit, linkCreditToCartridge,
  reconcileStaleCartridgeCredits, CartridgeCreditReservationLostError,
} from "../src/lib/cartridge-credits";

describe("Cartridge reservation recovery", () => {
  let userId: string;
  const old = () => new Date(Date.now() - 60 * 60 * 1000);
  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({ clerkUserId: `cartridge-recovery-${randomUUID()}` }).returning();
    userId = user!.id;
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.delete(credits).where(eq(credits.userId, userId));
    await db.delete(packages).where(eq(packages.userId, userId));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  });
  async function seed(values: Partial<typeof credits.$inferInsert> = {}) {
    const [row] = await db.insert(credits).values({ userId, ...values }).returning();
    return row!;
  }
  async function pkg() {
    const [row] = await db.insert(packages).values({
      userId, projectName: "Recovery fixture", outcomeOneLiner: "test", scopeStatement: "test", seedPrompt: "test",
    }).returning();
    return row!;
  }
  async function current(id: string) {
    const [row] = await db.select().from(credits).where(eq(credits.id, id));
    return row!;
  }
  it("concurrent claims cannot double-spend; each subsequent claim has a new token", async () => {
    const credit = await seed();
    const claimed = (await Promise.all([claimCartridgeCredit(userId), claimCartridgeCredit(userId)])).filter(x => x !== null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.id).toBe(credit.id);
    await releaseCartridgeCredit(claimed[0]!);
    const next = await claimCartridgeCredit(userId);
    expect(next!.token).not.toBe(claimed[0]!.token);
  });
  it("recovers only expired tokened unlinked consumption, retaining fresh, linked and legacy rows", async () => {
    const linkedPackage = await pkg();
    const abandoned = await seed({ status: "consumed", consumedAt: old(), reservationToken: randomUUID() });
    const fresh = await seed({ status: "consumed", consumedAt: new Date(), reservationToken: randomUUID() });
    const linked = await seed({ status: "consumed", consumedAt: old(), reservationToken: randomUUID(), cartridgePackageId: linkedPackage.id });
    const legacy = await seed({ status: "consumed", consumedAt: old() });
    expect(await reconcileStaleCartridgeCredits()).toBe(1);
    expect(await current(abandoned.id)).toMatchObject({ status: "available", consumedAt: null, reservationToken: null });
    for (const row of [fresh, linked, legacy]) expect((await current(row.id)).status).toBe("consumed");
  });
  it("fences an old request from releasing or linking a reclaimed reservation", async () => {
    const credit = await seed();
    const previous = (await claimCartridgeCredit(userId))!;
    await db.update(credits).set({ consumedAt: old() }).where(eq(credits.id, credit.id));
    expect(await reconcileStaleCartridgeCredits()).toBe(1);
    const next = (await claimCartridgeCredit(userId))!;
    const target = await pkg();
    await expect(releaseCartridgeCredit(previous)).rejects.toBeInstanceOf(CartridgeCreditReservationLostError);
    await expect(linkCreditToCartridge(previous, target.id)).rejects.toBeInstanceOf(CartridgeCreditReservationLostError);
    expect((await current(credit.id)).reservationToken).toBe(next.token);
    await linkCreditToCartridge(next, target.id);
    expect(await current(credit.id)).toMatchObject({ status: "consumed", cartridgePackageId: target.id, reservationToken: null });
  });
  it("never releases or unlinks a successfully committed package after a response/commit ambiguity", async () => {
    const credit = await seed();
    const reservation = (await claimCartridgeCredit(userId))!;
    const target = await pkg();
    await db.transaction(tx => linkCreditToCartridge(reservation, target.id, tx));
    await expect(releaseCartridgeCredit(reservation)).rejects.toBeInstanceOf(CartridgeCreditReservationLostError);
    expect(await reconcileStaleCartridgeCredits(new Date(Date.now() + 60 * 60 * 1000))).toBe(0);
    expect((await current(credit.id)).cartridgePackageId).toBe(target.id);
  });
  it("rolls back package persistence when reservation ownership has been lost", async () => {
    const credit = await seed();
    const reservation = (await claimCartridgeCredit(userId))!;
    await db.update(credits).set({ consumedAt: old() }).where(eq(credits.id, credit.id));
    await reconcileStaleCartridgeCredits();
    const id = randomUUID();
    await expect(db.transaction(async tx => {
      await tx.insert(packages).values({ id, userId, projectName: "Must roll back", outcomeOneLiner: "test", scopeStatement: "test", seedPrompt: "test" });
      await linkCreditToCartridge(reservation, id, tx);
    })).rejects.toBeInstanceOf(CartridgeCreditReservationLostError);
    expect(await db.select().from(packages).where(eq(packages.id, id))).toHaveLength(0);
  });
  it("retries a transient release failure without changing reservation ownership", async () => {
    const credit = await seed();
    const reservation = (await claimCartridgeCredit(userId))!;
    const spy = vi.spyOn(db, "update")
      .mockImplementationOnce(() => { throw new Error("transient connection failure"); })
      .mockImplementationOnce(() => { throw new Error("transient connection failure"); });
    await releaseCartridgeCredit(reservation);
    expect(spy).toHaveBeenCalledTimes(3);
    expect((await current(credit.id)).status).toBe("available");
  });
  it("skips a row locked by another worker and recovers it after that worker finishes", async () => {
    const credit = await seed({ status: "consumed", consumedAt: old(), reservationToken: randomUUID() });
    let unlock!: () => void, signal!: () => void;
    const locked = new Promise<void>(r => { signal = r; });
    const gate = new Promise<void>(r => { unlock = r; });
    const writer = db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM cartridge_credits WHERE id = ${credit.id}::uuid FOR UPDATE`);
      signal(); await gate;
    });
    await locked;
    try { expect(await reconcileStaleCartridgeCredits()).toBe(0); }
    finally { unlock(); await writer; }
    expect(await reconcileStaleCartridgeCredits()).toBe(1);
  });
  it("bounds each pass and drains remaining abandoned reservations on the next pass", async () => {
    await db.insert(credits).values(Array.from({ length: 101 }, () => ({
      userId, status: "consumed" as const, consumedAt: old(), reservationToken: randomUUID(),
    })));
    expect(await reconcileStaleCartridgeCredits()).toBe(100);
    expect(await reconcileStaleCartridgeCredits()).toBe(1);
    expect(await db.select().from(credits).where(and(eq(credits.userId, userId), eq(credits.status, "consumed")))).toHaveLength(0);
  });
});
