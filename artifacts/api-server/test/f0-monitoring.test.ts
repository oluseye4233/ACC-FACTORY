import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, notificationPreferencesTable } from "@workspace/db";

// ---------- Mock @workspace/email ----------
const sentRetainer: Array<Record<string, unknown>> = [];

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendRetainerMonitoringAlert: vi.fn(async (args: Record<string, unknown>) => {
      sentRetainer.push(args);
      return { ok: true } as unknown;
    }),
  };
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = "";
const userEmail = `f0mon-${stamp}@example.test`;

beforeAll(async () => {
  const [u] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_f0mon_${stamp}`, email: userEmail })
    .returning();
  userId = u!.id;
});

afterAll(async () => {
  await db
    .delete(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
});

beforeEach(async () => {
  sentRetainer.length = 0;
  await db
    .delete(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
});

const alertPayload = {
  retainerTitle: "Acme retainer",
  capiPosture: "Slipping",
  highestUrgency: "ACT_NOW",
  alerts: [{ urgency: "ACT_NOW", alert: "Competitor launched", recommendedAction: "Respond" }],
  weeklyCounsel: "Move fast.",
  occurredAt: new Date(),
};

// ---------------- evaluateMonitoringBreach ----------------
describe("evaluateMonitoringBreach", () => {
  test("no alerts → not breached, null highest", async () => {
    const { evaluateMonitoringBreach } = await import("../src/engines/f0");
    const r = evaluateMonitoringBreach({
      capiPosture: "Stable",
      movements: [],
      eventAlerts: [],
      weeklyCounsel: "",
    });
    expect(r.breached).toBe(false);
    expect(r.highestUrgency).toBeNull();
  });

  test("only WATCH alerts → not breached", async () => {
    const { evaluateMonitoringBreach } = await import("../src/engines/f0");
    const r = evaluateMonitoringBreach({
      capiPosture: "Stable",
      movements: [],
      eventAlerts: [{ alert: "minor", urgency: "WATCH", recommendedAction: "note" }],
      weeklyCounsel: "",
    });
    expect(r.breached).toBe(false);
    expect(r.highestUrgency).toBe("WATCH");
  });

  test("ACT_SOON breaches; highest tracks ACT_NOW over mixed set", async () => {
    const { evaluateMonitoringBreach } = await import("../src/engines/f0");
    const soon = evaluateMonitoringBreach({
      capiPosture: "Slipping",
      movements: [],
      eventAlerts: [{ alert: "x", urgency: "ACT_SOON", recommendedAction: "y" }],
      weeklyCounsel: "",
    });
    expect(soon.breached).toBe(true);
    expect(soon.highestUrgency).toBe("ACT_SOON");

    const mixed = evaluateMonitoringBreach({
      capiPosture: "Slipping",
      movements: [],
      eventAlerts: [
        { alert: "a", urgency: "WATCH", recommendedAction: "y" },
        { alert: "b", urgency: "ACT_NOW", recommendedAction: "y" },
        { alert: "c", urgency: "ACT_SOON", recommendedAction: "y" },
      ],
      weeklyCounsel: "",
    });
    expect(mixed.breached).toBe(true);
    expect(mixed.highestUrgency).toBe("ACT_NOW");
  });
});

// ---------------- dispatchRetainerMonitoringAlert ----------------
describe("dispatchRetainerMonitoringAlert", () => {
  test("emails the owner and returns true when retainerAlertsEnabled (default)", async () => {
    const { dispatchRetainerMonitoringAlert } = await import("../src/lib/notification-dispatch");
    const sent = await dispatchRetainerMonitoringAlert({ userId, ...alertPayload });
    expect(sent).toBe(true);
    expect(sentRetainer).toHaveLength(1);
    expect(sentRetainer[0]!.to).toBe(userEmail);
    expect(sentRetainer[0]!.retainerTitle).toBe("Acme retainer");
  });

  test("suppressed (returns false, no email) when retainerAlertsEnabled is off", async () => {
    const { dispatchRetainerMonitoringAlert } = await import("../src/lib/notification-dispatch");
    const { getOrCreatePreferences } = await import("../src/lib/notifications");
    const prefs = await getOrCreatePreferences(userId, null);
    await db
      .update(notificationPreferencesTable)
      .set({ retainerAlertsEnabled: false })
      .where(eq(notificationPreferencesTable.id, prefs.id));

    const sent = await dispatchRetainerMonitoringAlert({ userId, ...alertPayload });
    expect(sent).toBe(false);
    expect(sentRetainer).toHaveLength(0);
  });

  test("returns false for unknown user", async () => {
    const { dispatchRetainerMonitoringAlert } = await import("../src/lib/notification-dispatch");
    const sent = await dispatchRetainerMonitoringAlert({
      userId: "00000000-0000-0000-0000-000000000000",
      ...alertPayload,
    });
    expect(sent).toBe(false);
    expect(sentRetainer).toHaveLength(0);
  });
});
