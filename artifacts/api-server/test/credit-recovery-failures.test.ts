import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(), update: vi.fn(), returning: vi.fn(),
  note: vi.fn(), resolve: vi.fn(),
}));
vi.mock("@workspace/db", async importOriginal => ({
  ...await importOriginal<typeof import("@workspace/db")>(),
  db: { execute: mocks.execute, update: mocks.update },
}));
vi.mock("../src/lib/recovery-alerts", () => ({
  noteRecoveryFailure: mocks.note, resolveRecoveryFailure: mocks.resolve, dispatchRecoveryAlerts: vi.fn(),
}));
vi.mock("../src/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
import {
  reconcileStaleCartridgeCredits, releaseCartridgeCredit, CartridgeCreditReservationLostError,
} from "../src/lib/cartridge-credits";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.note.mockResolvedValue(undefined);
  mocks.resolve.mockResolvedValue(undefined);
  mocks.update.mockReturnValue({ set: () => ({ where: () => ({ returning: mocks.returning }) }) });
});
const candidate = () => ({ id: randomUUID(), reservation_token: randomUUID() });

describe("per-reservation recovery failure isolation", () => {
  it("clears the exact old claim episode after normal batch recovery", async () => {
    const row = candidate();
    mocks.execute.mockResolvedValueOnce({ rows: [row] });
    expect(await reconcileStaleCartridgeCredits()).toBe(1);
    expect(mocks.resolve).toHaveBeenCalledWith({
      kind: "credit", resourceId: row.id, scopeId: row.reservation_token,
    }, expect.any(Date));
  });

  it("isolates a failed reservation without blocking other recoveries or losing token fencing", async () => {
    const bad = candidate(), good = candidate();
    mocks.execute
      .mockRejectedValueOnce(new Error("batch failed"))
      .mockResolvedValueOnce({ rows: [bad, good] })
      .mockRejectedValueOnce(new Error("bad row"))
      .mockResolvedValueOnce({ rows: [{ id: good.id }] });
    await expect(reconcileStaleCartridgeCredits()).rejects.toThrow("1 reservations; 1 recovered");
    expect(mocks.note).toHaveBeenCalledWith({
      kind: "credit", resourceId: bad.id, scopeId: bad.reservation_token,
    }, expect.any(Date));
    expect(mocks.resolve).toHaveBeenCalledWith({
      kind: "credit", resourceId: good.id, scopeId: good.reservation_token,
    }, expect.any(Date));
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[2]![0]);
    expect(query.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(query.sql).toContain("consumed_at <");
    expect(query.sql).toContain("reservation_token =");
    expect(query.params).toContain(bad.id);
    expect(query.params).toContain(bad.reservation_token);
  });

  it("does not diagnose a locked or superseded claim as a failed recovery", async () => {
    mocks.execute
      .mockRejectedValueOnce(new Error("batch failed"))
      .mockResolvedValueOnce({ rows: [candidate()] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await reconcileStaleCartridgeCredits()).toBe(0);
    expect(mocks.note).not.toHaveBeenCalled();
  });

  it("reports an unavailable database without inventing per-record diagnoses", async () => {
    mocks.execute.mockRejectedValue(new Error("database unavailable"));
    await expect(reconcileStaleCartridgeCredits()).rejects.toThrow("database unavailable");
    expect(mocks.note).not.toHaveBeenCalled();
  });

  it("records one failed release period only after exhausting the three immediate retries", async () => {
    const reservation = { id: randomUUID(), token: randomUUID() };
    mocks.returning.mockRejectedValue(new Error("release failed"));
    await expect(releaseCartridgeCredit(reservation)).rejects.toThrow("release failed");
    expect(mocks.returning).toHaveBeenCalledTimes(3);
    expect(mocks.note).toHaveBeenCalledExactlyOnceWith({
      kind: "credit", resourceId: reservation.id, scopeId: reservation.token,
    });
  });

  it("does not create operator failure episodes for lost reservation ownership", async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(releaseCartridgeCredit({ id: randomUUID(), token: randomUUID() }))
      .rejects.toBeInstanceOf(CartridgeCreditReservationLostError);
    expect(mocks.returning).toHaveBeenCalledOnce();
    expect(mocks.note).not.toHaveBeenCalled();
  });
});
