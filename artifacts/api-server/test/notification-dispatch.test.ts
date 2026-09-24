import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  organizationsTable,
  organizationMembersTable,
  harnessSessionsTable,
  harnessEngineRunsTable,
  notificationPreferencesTable,
  stripeWebhookEventsTable,
} from "@workspace/db";

// ---------- Mock @workspace/email ----------
// Capture every send call but resolve immediately so the dispatch paths look
// like a healthy Resend round-trip.
const sentDigest: Array<Record<string, unknown>> = [];
const sentHighCost: Array<Record<string, unknown>> = [];
const sentBillingFailure: Array<Record<string, unknown>> = [];

vi.mock("@workspace/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/email")>();
  return {
    ...actual,
    sendOrgActivityDigest: vi.fn(async (args: Record<string, unknown>) => {
      sentDigest.push(args);
      return { ok: true as const, id: "test-digest" };
    }),
    sendHighCostRunAlert: vi.fn(async (args: Record<string, unknown>) => {
      sentHighCost.push(args);
      return { ok: true as const, id: "test-high-cost" };
    }),
    sendBillingFailureAlert: vi.fn(async (args: Record<string, unknown>) => {
      sentBillingFailure.push(args);
      return { ok: true as const, id: "test-billing" };
    }),
  };
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let ownerId = "";
let adminId = "";
let memberId = "";
let outsiderId = "";
let orgId = "";
let otherOrgId = "";
let sessionVisibleId = "";
let sessionHiddenId = "";
const ownerEmail = `notif-owner-${stamp}@example.test`;
const adminEmail = `notif-admin-${stamp}@example.test`;
const memberEmail = `notif-member-${stamp}@example.test`;
const outsiderEmail = `notif-outsider-${stamp}@example.test`;
const stripeCustomerId = `cus_notif_${stamp}`;

async function resetPrefs(): Promise<void> {
  await db
    .delete(notificationPreferencesTable)
    .where(
      inArray(notificationPreferencesTable.userId, [
        ownerId,
        adminId,
        memberId,
        outsiderId,
      ]),
    );
}

beforeAll(async () => {
  const [u1] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_notif_owner_${stamp}`, email: ownerEmail })
    .returning();
  const [u2] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_notif_admin_${stamp}`, email: adminEmail })
    .returning();
  const [u3] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_notif_member_${stamp}`, email: memberEmail })
    .returning();
  const [u4] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_notif_outsider_${stamp}`, email: outsiderEmail })
    .returning();
  ownerId = u1!.id;
  adminId = u2!.id;
  memberId = u3!.id;
  outsiderId = u4!.id;

  const [org] = await db
    .insert(organizationsTable)
    .values({
      name: "Notif Test Org",
      slug: `notif-${stamp}`,
      createdByUserId: ownerId,
      stripeCustomerId,
      status: "active",
    })
    .returning();
  orgId = org!.id;
  const [org2] = await db
    .insert(organizationsTable)
    .values({
      name: "Notif Empty Org",
      slug: `notif-empty-${stamp}`,
      createdByUserId: ownerId,
      status: "active",
    })
    .returning();
  otherOrgId = org2!.id;

  await db.insert(organizationMembersTable).values([
    { organizationId: orgId, userId: ownerId, role: "owner" },
    { organizationId: orgId, userId: adminId, role: "admin" },
    { organizationId: orgId, userId: memberId, role: "member" },
  ]);

  const [sv] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: memberId,
      sessionName: "visible",
      orgId,
      orgVisible: true,
    })
    .returning();
  sessionVisibleId = sv!.id;
  const [sh] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: memberId,
      sessionName: "hidden",
      orgId,
      orgVisible: false,
    })
    .returning();
  sessionHiddenId = sh!.id;
});

afterAll(async () => {
  await db
    .delete(stripeWebhookEventsTable)
    .where(eq(stripeWebhookEventsTable.customerId, stripeCustomerId));
  await db.execute(
    sql`DELETE FROM harness_engine_runs WHERE session_id IN (${sessionVisibleId}, ${sessionHiddenId})`,
  );
  await db.execute(
    sql`DELETE FROM harness_sessions WHERE id IN (${sessionVisibleId}, ${sessionHiddenId})`,
  );
  await db.execute(sql`DELETE FROM organizations WHERE id IN (${orgId}, ${otherOrgId})`);
  await db.execute(
    sql`DELETE FROM users WHERE id IN (${ownerId}, ${adminId}, ${memberId}, ${outsiderId})`,
  );
});

beforeEach(async () => {
  sentDigest.length = 0;
  sentHighCost.length = 0;
  sentBillingFailure.length = 0;
  await resetPrefs();
  await db
    .delete(harnessEngineRunsTable)
    .where(
      inArray(harnessEngineRunsTable.sessionId, [sessionVisibleId, sessionHiddenId]),
    );
  await db
    .delete(stripeWebhookEventsTable)
    .where(eq(stripeWebhookEventsTable.customerId, stripeCustomerId));
});

async function setPrefs(
  userId: string,
  scopeOrgId: string | null,
  overrides: Partial<{
    digestEnabled: boolean;
    billingAlertsEnabled: boolean;
    highCostAlertsEnabled: boolean;
    highCostThresholdUsd: string;
    lastDigestSentAt: Date | null;
  }>,
): Promise<void> {
  const { getOrCreatePreferences } = await import("../src/lib/notifications");
  const prefs = await getOrCreatePreferences(userId, scopeOrgId);
  await db
    .update(notificationPreferencesTable)
    .set(overrides)
    .where(eq(notificationPreferencesTable.id, prefs.id));
}

async function seedRun(args: {
  userId: string;
  sessionId: string;
  engineId: number;
  costUsd: string;
  createdAt?: Date;
}): Promise<void> {
  await db.insert(harnessEngineRunsTable).values({
    userId: args.userId,
    sessionId: args.sessionId,
    engineId: args.engineId,
    provider: "claude",
    modelId: "claude-sonnet-4-6",
    costUsd: args.costUsd,
    ...(args.createdAt ? { createdAt: args.createdAt } : {}),
  });
}

// ---------------- runWeeklyDigest ----------------
describe("runWeeklyDigest", () => {
  test("no-op when no contact has digestEnabled", async () => {
    const { runWeeklyDigest } = await import("../src/lib/notification-dispatch");
    const testStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const emails = [
      `notif-noop-owner-${testStamp}@example.test`,
      `notif-noop-admin-${testStamp}@example.test`,
      `notif-noop-member-${testStamp}@example.test`,
    ];
    let fixtureUserIds: string[] = [];
    let fixtureOrgId = "";
    let fixtureSessionId = "";

    try {
      const fixtureUsers = await db
        .insert(usersTable)
        .values(
          emails.map((email, index) => ({
            clerkUserId: `clerk_notif_noop_${index}_${testStamp}`,
            email,
          })),
        )
        .returning();
      fixtureUserIds = fixtureUsers.map((user) => user.id);
      const owner = fixtureUsers[0]!;
      const admin = fixtureUsers[1]!;
      const member = fixtureUsers[2]!;

      const [org] = await db
        .insert(organizationsTable)
        .values({
          name: "Notification No-op Test Org",
          slug: `notif-noop-${testStamp}`,
          createdByUserId: owner.id,
          status: "active",
        })
        .returning();
      fixtureOrgId = org!.id;

      await db.insert(organizationMembersTable).values([
        { organizationId: fixtureOrgId, userId: owner.id, role: "owner" },
        { organizationId: fixtureOrgId, userId: admin.id, role: "admin" },
        { organizationId: fixtureOrgId, userId: member.id, role: "member" },
      ]);

      const [session] = await db
        .insert(harnessSessionsTable)
        .values({
          userId: member.id,
          sessionName: "notification no-op",
          orgId: fixtureOrgId,
          orgVisible: true,
        })
        .returning();
      fixtureSessionId = session!.id;

      await setPrefs(owner.id, fixtureOrgId, { digestEnabled: false });
      await setPrefs(admin.id, fixtureOrgId, { digestEnabled: false });
      await seedRun({
        userId: member.id,
        sessionId: fixtureSessionId,
        engineId: 1,
        costUsd: "0.50",
      });

      await runWeeklyDigest(new Date());
      // Scope the assertion to this test's recipients; other orgs may send.
      const ours = sentDigest.filter((d) => emails.includes(String(d.to)));
      expect(ours).toHaveLength(0);
    } finally {
      if (fixtureUserIds.length > 0) {
        await db
          .delete(notificationPreferencesTable)
          .where(inArray(notificationPreferencesTable.userId, fixtureUserIds));
      }
      if (fixtureSessionId) {
        await db
          .delete(harnessEngineRunsTable)
          .where(eq(harnessEngineRunsTable.sessionId, fixtureSessionId));
        await db
          .delete(harnessSessionsTable)
          .where(eq(harnessSessionsTable.id, fixtureSessionId));
      }
      if (fixtureOrgId) {
        await db
          .delete(organizationMembersTable)
          .where(eq(organizationMembersTable.organizationId, fixtureOrgId));
        await db
          .delete(organizationsTable)
          .where(eq(organizationsTable.id, fixtureOrgId));
      }
      if (fixtureUserIds.length > 0) {
        await db
          .delete(usersTable)
          .where(inArray(usersTable.id, fixtureUserIds));
      }
    }
  });

  test("groups runs by engine and by member; only sends to opted-in owners/admins", async () => {
    const { runWeeklyDigest } = await import("../src/lib/notification-dispatch");
    await setPrefs(ownerId, orgId, { digestEnabled: true });
    await setPrefs(adminId, orgId, { digestEnabled: true });
    // Member preference is irrelevant — members don't receive digests.
    await setPrefs(memberId, orgId, { digestEnabled: true });

    // Visible session runs (counted)
    await seedRun({
      userId: memberId,
      sessionId: sessionVisibleId,
      engineId: 1,
      costUsd: "0.50",
    });
    await seedRun({
      userId: memberId,
      sessionId: sessionVisibleId,
      engineId: 1,
      costUsd: "0.25",
    });
    await seedRun({
      userId: ownerId,
      sessionId: sessionVisibleId,
      engineId: 2,
      costUsd: "1.00",
    });
    // Hidden session run (must NOT be counted)
    await seedRun({
      userId: memberId,
      sessionId: sessionHiddenId,
      engineId: 1,
      costUsd: "99.00",
    });

    // Billing events for this org's customer in window (one match, one stale)
    await db.insert(stripeWebhookEventsTable).values({
      eventId: `evt_notif_${stamp}_a`,
      type: "invoice.paid",
      customerId: stripeCustomerId,
      receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    await db.insert(stripeWebhookEventsTable).values({
      eventId: `evt_notif_${stamp}_old`,
      type: "invoice.paid",
      customerId: stripeCustomerId,
      receivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    await runWeeklyDigest(new Date());

    // Scope to this org's recipients (other fixtures may produce sends too).
    const ours = sentDigest.filter(
      (d) => d.to === ownerEmail || d.to === adminEmail || d.to === memberEmail || d.to === outsiderEmail,
    );
    // Two emails, one each to owner + admin; never to member or outsider.
    const recipients = ours.map((d) => d.to).sort();
    expect(recipients).toEqual([adminEmail, ownerEmail].sort());

    const sample = ours[0]!;
    expect(sample.totalRuns).toBe(3);
    expect(sample.totalCostUsd).toBeCloseTo(1.75, 5);
    const byEngine = sample.byEngine as Array<{
      label: string;
      count: number;
      costUsd: number;
    }>;
    const e1 = byEngine.find((b) => b.label === "F1")!;
    const e2 = byEngine.find((b) => b.label === "F2")!;
    expect(e1.count).toBe(2);
    expect(e1.costUsd).toBeCloseTo(0.75, 5);
    expect(e2.count).toBe(1);
    expect(e2.costUsd).toBeCloseTo(1.0, 5);
    const byMember = sample.byMember as Array<{
      label: string;
      count: number;
      costUsd: number;
    }>;
    expect(byMember.find((m) => m.label === memberEmail)!.count).toBe(2);
    expect(byMember.find((m) => m.label === ownerEmail)!.count).toBe(1);

    const billingEvents = sample.billingEvents as Array<{ type: string }>;
    expect(billingEvents).toHaveLength(1);
    expect(billingEvents[0]!.type).toBe("invoice.paid");
  });

  test("6-day lastDigestSentAt re-send guard prevents double mail", async () => {
    const { runWeeklyDigest } = await import("../src/lib/notification-dispatch");
    const now = new Date();
    // owner: already digested 3 days ago → must skip.
    await setPrefs(ownerId, orgId, {
      digestEnabled: true,
      lastDigestSentAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    });
    // admin: digested 7 days ago → eligible.
    await setPrefs(adminId, orgId, {
      digestEnabled: true,
      lastDigestSentAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    });
    await seedRun({
      userId: memberId,
      sessionId: sessionVisibleId,
      engineId: 1,
      costUsd: "0.25",
    });

    await runWeeklyDigest(now);
    const ours = sentDigest.filter(
      (d) => d.to === ownerEmail || d.to === adminEmail,
    );
    expect(ours).toHaveLength(1);
    expect(ours[0]!.to).toBe(adminEmail);
  });
});

// ---------------- maybeDispatchHighCostAlerts ----------------
describe("maybeDispatchHighCostAlerts", () => {
  async function flush(): Promise<void> {
    // safeFire is awaited inside maybeDispatchHighCostAlerts via `void`,
    // but the inner sendHighCostRunAlert promise is captured synchronously
    // by our mock when invoked. One microtask flush is enough.
    await Promise.resolve();
    await Promise.resolve();
  }

  test("skipped when session is not org-visible", async () => {
    const { maybeDispatchHighCostAlerts } = await import(
      "../src/lib/notification-dispatch"
    );
    await setPrefs(ownerId, orgId, {
      highCostAlertsEnabled: true,
      highCostThresholdUsd: "0.10",
    });
    await maybeDispatchHighCostAlerts({
      sessionId: sessionHiddenId,
      userId: memberId,
      engineId: 1,
      costUsd: 5.0,
      occurredAt: new Date(),
    });
    await flush();
    expect(sentHighCost).toHaveLength(0);
  });

  test("skipped when cost is below recipient threshold", async () => {
    const { maybeDispatchHighCostAlerts } = await import(
      "../src/lib/notification-dispatch"
    );
    await setPrefs(ownerId, orgId, {
      highCostAlertsEnabled: true,
      highCostThresholdUsd: "10.00",
    });
    await maybeDispatchHighCostAlerts({
      sessionId: sessionVisibleId,
      userId: memberId,
      engineId: 1,
      costUsd: 0.5,
      occurredAt: new Date(),
    });
    await flush();
    expect(sentHighCost).toHaveLength(0);
  });

  test("sent above threshold to opted-in owners/admins only", async () => {
    const { maybeDispatchHighCostAlerts } = await import(
      "../src/lib/notification-dispatch"
    );
    // Owner: opted in, low threshold → should receive.
    await setPrefs(ownerId, orgId, {
      highCostAlertsEnabled: true,
      highCostThresholdUsd: "1.00",
    });
    // Admin: opted OUT → must not receive.
    await setPrefs(adminId, orgId, {
      highCostAlertsEnabled: false,
      highCostThresholdUsd: "1.00",
    });
    // Member: ignored (not owner/admin), even with prefs.
    await setPrefs(memberId, orgId, {
      highCostAlertsEnabled: true,
      highCostThresholdUsd: "0.01",
    });

    await maybeDispatchHighCostAlerts({
      sessionId: sessionVisibleId,
      userId: memberId,
      engineId: 3,
      costUsd: 2.5,
      occurredAt: new Date(),
    });
    await flush();

    expect(sentHighCost).toHaveLength(1);
    const call = sentHighCost[0]!;
    expect(call.to).toBe(ownerEmail);
    expect(call.actorEmail).toBe(memberEmail);
    expect(call.costUsd).toBeCloseTo(2.5, 5);
    expect(call.thresholdUsd).toBeCloseTo(1.0, 5);
    expect(call.engineId).toBe(3);
  });
});

// ---------------- GET /api/notifications/unsubscribe/:token ----------------
describe("unsubscribe route", () => {
  function injectLog(req: Request, _res: Response, next: NextFunction): void {
    const noop = (): void => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      trace: noop,
      fatal: noop,
      child: () => (req as unknown as { log: unknown }).log,
    };
    next();
  }
  async function startApp(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
    const server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no test server address");
    return {
      url: `http://127.0.0.1:${addr.port}`,
      close: () => new Promise<void>((r) => server.close(() => r())),
    };
  }

  test("valid token flips all three flags off; unknown token 404s", async () => {
    const notificationsRouter = (await import("../src/routes/notifications")).default;
    const { getOrCreatePreferences } = await import("../src/lib/notifications");

    // Seed prefs with all three flags ON for owner@org scope.
    const prefs = await getOrCreatePreferences(ownerId, orgId);
    await db
      .update(notificationPreferencesTable)
      .set({
        digestEnabled: true,
        billingAlertsEnabled: true,
        highCostAlertsEnabled: true,
      })
      .where(eq(notificationPreferencesTable.id, prefs.id));

    const app = express();
    app.use(injectLog);
    app.use("/api", notificationsRouter);
    const srv = await startApp(app);
    try {
      const ok = await fetch(
        `${srv.url}/api/notifications/unsubscribe/${prefs.unsubscribeToken}`,
      );
      expect(ok.status).toBe(200);
      const html = await ok.text();
      expect(html).toContain("unsubscribed");

      const [after] = await db
        .select()
        .from(notificationPreferencesTable)
        .where(eq(notificationPreferencesTable.id, prefs.id))
        .limit(1);
      expect(after!.digestEnabled).toBe(false);
      expect(after!.billingAlertsEnabled).toBe(false);
      expect(after!.highCostAlertsEnabled).toBe(false);
      // Token is preserved so the user can resubscribe via prefs page.
      expect(after!.unsubscribeToken).toBe(prefs.unsubscribeToken);

      const bad = await fetch(
        `${srv.url}/api/notifications/unsubscribe/${"z".repeat(48)}`,
      );
      expect(bad.status).toBe(404);
    } finally {
      await srv.close();
    }
  });
});
