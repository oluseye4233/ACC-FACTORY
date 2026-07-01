import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  organizationsTable,
  organizationMembersTable,
  organizationInvitesTable,
  stripeWebhookEventsTable,
} from "@workspace/db";
import { effectiveTier, loadMembershipsForUser } from "../src/lib/orgs";
import { requireTier } from "../src/lib/tier";

// ---------- Stripe mock ----------
// The real `lib/stripe.ts` reaches out to the Replit connectors host. For the
// webhook integration test we swap it for a fake that:
//   * returns a fixed webhook secret, and
//   * returns a fake Stripe client whose `webhooks.constructEvent` is the
//     identity function (we hand-craft the event payload) and whose
//     `subscriptions.retrieve` returns the seeded fake subscription matching
//     the request body.
type StoredSub = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string }; quantity: number; current_period_end: number }> };
};
const subStore = new Map<string, StoredSub>();

vi.mock("../src/lib/stripe", () => {
  return {
    getStripeWebhookSecret: async () => "whsec_test_orgs_integration",
    getUncachableStripeClient: async () => ({
      webhooks: {
        constructEvent: (body: Buffer) => JSON.parse(body.toString("utf8")),
      },
      subscriptions: {
        retrieve: async (id: string) => {
          const sub = subStore.get(id);
          if (!sub) throw new Error(`fake stripe: subscription not seeded: ${id}`);
          return sub;
        },
      },
    }),
    isStripeConfigured: async () => true,
  };
});

// ---------- Test fixtures ----------
// Subscriptions/billing are a deferred B-level feature, dormant by default in
// internal-staff mode (SUBSCRIPTIONS_ENABLED unset/false → Stripe webhook and
// billing routes skip). This suite exercises that billing path, so it opts the
// feature back ON explicitly, verifying the dormant code still works when the
// flag is flipped.
process.env.SUBSCRIPTIONS_ENABLED = "true";
const TEAM_PRICE = "price_test_team_seat_monthly_orgs_integration";
process.env.STRIPE_PRICE_TEAM_SEAT_MONTHLY = TEAM_PRICE;

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let ownerId = "";
let memberId = "";
let inviteeId = "";
let orgId = "";
const ownerEmail = `orgsint-owner-${stamp}@example.test`;
const memberEmail = `orgsint-member-${stamp}@example.test`;
const inviteeEmail = `orgsint-invitee-${stamp}@example.test`;
const stripeCustomerId = `cus_test_orgs_${stamp}`;
const eventIdsToClean: string[] = [];

beforeAll(async () => {
  const [u1] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_orgsint_owner_${stamp}`, email: ownerEmail })
    .returning();
  const [u2] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_orgsint_member_${stamp}`, email: memberEmail })
    .returning();
  const [u3] = await db
    .insert(usersTable)
    .values({ clerkUserId: `clerk_orgsint_invitee_${stamp}`, email: inviteeEmail })
    .returning();
  ownerId = u1!.id;
  memberId = u2!.id;
  inviteeId = u3!.id;

  for (const uid of [ownerId, memberId, inviteeId]) {
    await db
      .insert(commandCentreSubscribersTable)
      .values({ userId: uid, tier: "EXPLORER", status: "inactive" });
  }

  const [org] = await db
    .insert(organizationsTable)
    .values({
      name: "Orgs Integration Test",
      slug: `orgsint-${stamp}`,
      createdByUserId: ownerId,
      stripeCustomerId,
    })
    .returning();
  orgId = org!.id;
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: ownerId, role: "owner" });
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: memberId, role: "member" });
});

afterAll(async () => {
  if (eventIdsToClean.length > 0) {
    await db
      .delete(stripeWebhookEventsTable)
      .where(
        sql`event_id IN (${sql.join(
          eventIdsToClean.map((e) => sql`${e}`),
          sql`, `,
        )})`,
      );
  }
  await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
  await db.execute(
    sql`DELETE FROM users WHERE id IN (${ownerId}, ${memberId}, ${inviteeId})`,
  );
});

// ---------- Helpers ----------
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

// ---------- Test 1: Team-subscription webhook → org activates → gate passes ----------
describe("team subscription webhook → tier elevation", () => {
  test(
    "checkout.session.completed activates the org and a member's Practitioner-gated request 200s",
    async () => {
      // Build the webhook app exactly like app.ts mounts it.
      const stripeWebhookRouter = (await import("../src/routes/stripe-webhook")).default;
      const app = express();
      app.use(injectLog);
      app.use("/api/webhooks/stripe", stripeWebhookRouter);
      const srv = await startApp(app);
      try {
        const eventId = `evt_test_team_sub_${stamp}_${randomUUID()}`;
        eventIdsToClean.push(eventId);
        const subscriptionId = `sub_test_${stamp}`;
        const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        subStore.set(subscriptionId, {
          id: subscriptionId,
          customer: stripeCustomerId,
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: { id: TEAM_PRICE },
                quantity: 5,
                current_period_end: periodEnd,
              },
            ],
          },
        });

        const event = {
          id: eventId,
          type: "checkout.session.completed",
          data: {
            object: {
              id: `cs_test_${stamp}`,
              customer: stripeCustomerId,
              mode: "subscription",
              subscription: subscriptionId,
              metadata: { kind: "team_subscription", orgId, seats: "5" },
            },
          },
        };

        const res = await fetch(`${srv.url}/api/webhooks/stripe`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": "t=ignored,v1=ignored",
          },
          body: JSON.stringify(event),
        });
        const body = (await res.json()) as { ok: boolean; replay?: boolean };
        expect(res.status, JSON.stringify(body)).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.replay).toBeUndefined();

        // The org row should now be active with the seat count + sub id.
        const [org] = await db
          .select()
          .from(organizationsTable)
          .where(eq(organizationsTable.id, orgId))
          .limit(1);
        expect(org).toBeDefined();
        expect(org!.status).toBe("active");
        expect(org!.seatsPurchased).toBe(5);
        expect(org!.stripeSubscriptionId).toBe(subscriptionId);
        expect(org!.stripePriceId).toBe(TEAM_PRICE);

        // The member is still personal-tier EXPLORER, but membership in an
        // active team org should elevate the effective tier to INSTITUTION.
        const memberships = await loadMembershipsForUser(memberId);
        const eff = effectiveTier("EXPLORER", memberships);
        expect(eff).toBe("INSTITUTION");

        // Now wire the real requireTier("PRACTITIONER") gate behind a 200
        // handler and prove the member's request passes through it.
        const [memberSubRow] = await db
          .select()
          .from(commandCentreSubscribersTable)
          .where(eq(commandCentreSubscribersTable.userId, memberId))
          .limit(1);

        const gateApp = express();
        gateApp.use(injectLog);
        gateApp.use(express.json());
        gateApp.use((req, _res, next) => {
          req.localUser = {
            id: memberId,
            clerkUserId: `clerk_orgsint_member_${stamp}`,
            email: memberEmail,
            displayName: null,
            role: "USER",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never;
          req.subscriber = memberSubRow!;
          req.memberships = memberships;
          req.effectiveTier = eff;
          next();
        });
        gateApp.post("/gated", requireTier("PRACTITIONER"), (_req, res) => {
          res.json({ ok: true });
        });
        const gSrv = await startApp(gateApp);
        try {
          const g = await fetch(`${gSrv.url}/gated`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          const gBody = (await g.json()) as { ok?: boolean; error?: string };
          expect(g.status, JSON.stringify(gBody)).toBe(200);
          expect(gBody.ok).toBe(true);
        } finally {
          await gSrv.close();
        }

        // Replay the same event id → idempotent ack, no double-update.
        const replay = await fetch(`${srv.url}/api/webhooks/stripe`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": "t=ignored,v1=ignored",
          },
          body: JSON.stringify(event),
        });
        const replayBody = (await replay.json()) as { ok: boolean; replay?: boolean };
        expect(replay.status).toBe(200);
        expect(replayBody.replay).toBe(true);
      } finally {
        await srv.close();
        // Reset org state for the second test (which does not depend on it).
        await db
          .update(organizationsTable)
          .set({
            status: "inactive",
            stripeSubscriptionId: null,
            stripePriceId: null,
            seatsPurchased: 0,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          })
          .where(eq(organizationsTable.id, orgId));
      }
    },
  );
});

// ---------- Test 2: Invite issue → accept → membership row + tier elevation ----------
describe("org invite happy path → membership → tier elevation", () => {
  test(
    "issue invite, accept it as the matching-email user, membership lands and effective tier elevates",
    async () => {
      // Mock requireAuth so we can drive the orgs router as different users
      // without spinning up Clerk. The fake reads `x-test-user-id` and
      // hydrates the same shape requireAuth would.
      vi.resetModules();
      vi.doMock("../src/lib/auth", async (importOriginal) => {
        const actual =
          await importOriginal<typeof import("../src/lib/auth")>();
        const fakeRequireAuth = async (
          req: Request,
          res: Response,
          next: NextFunction,
        ): Promise<void> => {
          const headerVal = req.headers["x-test-user-id"];
          const userId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
          if (!userId) {
            res.status(401).json({ error: "test user header missing" });
            return;
          }
          const [u] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
          if (!u) {
            res.status(401).json({ error: "test user not found" });
            return;
          }
          const [sub] = await db
            .select()
            .from(commandCentreSubscribersTable)
            .where(eq(commandCentreSubscribersTable.userId, u.id))
            .limit(1);
          req.localUser = u;
          req.subscriber = sub!;
          const memberships = await loadMembershipsForUser(u.id);
          req.memberships = memberships;
          req.effectiveTier = effectiveTier(sub!.tier, memberships);
          next();
        };
        return { ...actual, requireAuth: fakeRequireAuth };
      });

      const orgsRouter = (await import("../src/routes/orgs")).default;
      const app = express();
      app.use(injectLog);
      app.use(express.json());
      app.use("/api", orgsRouter);
      const srv = await startApp(app);
      try {
        // 1. Owner issues an invite for the invitee's email.
        const issue = await fetch(`${srv.url}/api/orgs/${orgId}/invites`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-user-id": ownerId,
          },
          body: JSON.stringify({ email: inviteeEmail, role: "member" }),
        });
        const issueBody = (await issue.json()) as {
          id: string;
          token: string;
          email: string;
          role: string;
        };
        expect(issue.status, JSON.stringify(issueBody)).toBe(201);
        expect(issueBody.token.length).toBeGreaterThan(0);
        expect(issueBody.email).toBe(inviteeEmail.toLowerCase());

        // 2. The invitee accepts via the token.
        const accept = await fetch(
          `${srv.url}/api/invites/${issueBody.token}/accept`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": inviteeId,
            },
            body: JSON.stringify({}),
          },
        );
        const acceptBody = (await accept.json()) as {
          ok?: boolean;
          organizationId?: string;
          error?: string;
        };
        expect(accept.status, JSON.stringify(acceptBody)).toBe(200);
        expect(acceptBody.ok).toBe(true);
        expect(acceptBody.organizationId).toBe(orgId);

        // 3. Membership row landed; invite marked accepted.
        const memberships = await loadMembershipsForUser(inviteeId);
        const myOrg = memberships.find((m) => m.organizationId === orgId);
        expect(myOrg).toBeDefined();
        expect(myOrg!.role).toBe("member");

        const [invRow] = await db
          .select()
          .from(organizationInvitesTable)
          .where(eq(organizationInvitesTable.id, issueBody.id))
          .limit(1);
        expect(invRow!.acceptedAt).not.toBeNull();
        expect(invRow!.acceptedByUserId).toBe(inviteeId);

        // 4. With the org made active, tier elevation kicks in for the
        //    freshly-accepted member.
        await db
          .update(organizationsTable)
          .set({ status: "active" })
          .where(eq(organizationsTable.id, orgId));
        const m2 = await loadMembershipsForUser(inviteeId);
        const eff = effectiveTier("EXPLORER", m2);
        expect(eff).toBe("INSTITUTION");

        // 5. Re-acceptance with the wrong-email user is forbidden.
        const wrong = await fetch(
          `${srv.url}/api/invites/${issueBody.token}/accept`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": ownerId,
            },
            body: JSON.stringify({}),
          },
        );
        // Either 410 (already-accepted) or 403 (email mismatch) is acceptable
        // here — both prove the invite is no longer freely redeemable.
        expect([403, 410]).toContain(wrong.status);
      } finally {
        await srv.close();
        vi.doUnmock("../src/lib/auth");
      }
    },
  );
});
