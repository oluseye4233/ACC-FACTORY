import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  harnessSessionsTable,
  organizationsTable,
  organizationMembersTable,
  organizationInvitesTable,
  usersTable,
  type OrgMemberRole,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { memberRole, ownerCount } from "../lib/orgs";
import { getUncachableStripeClient } from "../lib/stripe";

const router: IRouter = Router();

const slugRe = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

const CreateOrgBody = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(slugRe, "Slug must be 3-80 chars, lowercase alphanumeric or dashes"),
});

const UpdateOrgBody = z.object({
  name: z.string().min(1).max(255),
});

const UpdateMemberBody = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

const CreateInviteBody = z.object({
  email: z.email().max(320),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

const CheckoutBody = z.object({
  interval: z.enum(["month", "year"]),
  seats: z.number().int().min(1).max(500),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

const PortalBody = z.object({
  returnUrl: z.string().optional(),
});

const UpdateSeatsBody = z.object({
  seats: z.number().int().min(1).max(500),
  prorationBehavior: z.enum(["create_prorations", "none", "always_invoice"]).default("create_prorations"),
});

/**
 * Returns the current member count and the count of "live" invites
 * (not accepted, not revoked, not expired) for an org. Used to enforce
 * the per-org seat cap on invite creation/acceptance and to surface
 * usage in the org detail page.
 */
async function loadSeatUsage(
  orgId: string,
): Promise<{ membersCount: number; pendingInviteCount: number }> {
  const [m] = await db
    .select({ n: sql<string>`COUNT(*)` })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.organizationId, orgId));
  const [p] = await db
    .select({ n: sql<string>`COUNT(*)` })
    .from(organizationInvitesTable)
    .where(
      and(
        eq(organizationInvitesTable.organizationId, orgId),
        isNull(organizationInvitesTable.acceptedAt),
        isNull(organizationInvitesTable.revokedAt),
        gt(organizationInvitesTable.expiresAt, new Date()),
      ),
    );
  return {
    membersCount: Number(m?.n ?? 0),
    pendingInviteCount: Number(p?.n ?? 0),
  };
}

/**
 * Seat-cap enforcement is only meaningful when the org has an active
 * team-seat subscription. Otherwise the org has no purchased seats and
 * the cap doesn't apply.
 */
function seatCapActive(org: typeof organizationsTable.$inferSelect): boolean {
  return (
    (org.status === "active" || org.status === "trialing") &&
    (org.seatsPurchased ?? 0) > 0
  );
}

function serializeOrg(o: typeof organizationsTable.$inferSelect) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    seatsPurchased: o.seatsPurchased,
    status: o.status,
    stripeSubscriptionId: o.stripeSubscriptionId,
    stripePriceId: o.stripePriceId,
    currentPeriodEnd: o.currentPeriodEnd ? o.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: o.cancelAtPeriodEnd,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

async function requireMembership(
  res: import("express").Response,
  userId: string,
  orgId: string,
  minRole: OrgMemberRole = "member",
): Promise<OrgMemberRole | null> {
  const role = await memberRole(userId, orgId);
  if (!role) {
    res.status(404).json({ error: "Organization not found" });
    return null;
  }
  const rank: Record<OrgMemberRole, number> = { member: 0, admin: 1, owner: 2 };
  if (rank[role] < rank[minRole]) {
    res.status(403).json({ error: `Role '${minRole}' or above required (have '${role}')` });
    return null;
  }
  return role;
}

router.get("/orgs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const rows = await db
    .select({
      org: organizationsTable,
      role: organizationMembersTable.role,
    })
    .from(organizationMembersTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, organizationMembersTable.organizationId))
    .where(eq(organizationMembersTable.userId, userId))
    .orderBy(organizationsTable.name);
  res.json(
    rows.map((r) => ({
      ...serializeOrg(r.org),
      role: r.role,
    })),
  );
});

router.post("/orgs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrgBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const slug = parsed.data.slug.toLowerCase();
  try {
    const created = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizationsTable)
        .values({
          name: parsed.data.name,
          slug,
          createdByUserId: userId,
        })
        .returning();
      await tx.insert(organizationMembersTable).values({
        organizationId: org!.id,
        userId,
        role: "owner",
      });
      return org!;
    });
    res.status(201).json({ ...serializeOrg(created), role: "owner" as const });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/duplicate|unique/i.test(msg)) {
      res.status(409).json({ error: "Slug already taken" });
      return;
    }
    throw err;
  }
});

router.get("/orgs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id);
  if (!role) return;
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const usage = await loadSeatUsage(id);
  res.json({ ...serializeOrg(org), role, ...usage });
});

router.patch("/orgs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "admin");
  if (!role) return;
  const parsed = UpdateOrgBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(organizationsTable)
    .set({ name: parsed.data.name })
    .where(eq(organizationsTable.id, id))
    .returning();
  res.json({ ...serializeOrg(updated!), role });
});

router.delete("/orgs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "owner");
  if (!role) return;
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (org.status === "active" || org.status === "trialing") {
    res.status(409).json({
      error:
        "Cancel the team subscription via the Billing portal before deleting this organization.",
    });
    return;
  }
  await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
  res.status(204).send();
});

router.get("/orgs/:id/members", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id);
  if (!role) return;
  const rows = await db
    .select({
      userId: organizationMembersTable.userId,
      role: organizationMembersTable.role,
      createdAt: organizationMembersTable.createdAt,
      email: usersTable.email,
      displayName: usersTable.displayName,
    })
    .from(organizationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
    .where(eq(organizationMembersTable.organizationId, id))
    .orderBy(desc(organizationMembersTable.role));
  res.json(
    rows.map((r) => ({
      userId: r.userId,
      role: r.role,
      email: r.email,
      displayName: r.displayName,
      joinedAt: r.createdAt.toISOString(),
    })),
  );
});

router.patch("/orgs/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const targetUserId = String(req.params.userId);
  const role = await requireMembership(res, req.localUser!.id, id, "owner");
  if (!role) return;
  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await memberRole(targetUserId, id);
  if (!current) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (current === "owner" && parsed.data.role !== "owner") {
    const owners = await ownerCount(id);
    if (owners <= 1) {
      res.status(409).json({ error: "Cannot demote the last owner" });
      return;
    }
  }
  await db
    .update(organizationMembersTable)
    .set({ role: parsed.data.role })
    .where(
      and(
        eq(organizationMembersTable.organizationId, id),
        eq(organizationMembersTable.userId, targetUserId),
      ),
    );
  res.json({ ok: true, role: parsed.data.role });
});

router.delete("/orgs/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const targetUserId = String(req.params.userId);
  const callerUserId = req.localUser!.id;
  // Owners can remove anyone; members can remove themselves; admins can remove non-owner members.
  const callerRole = await memberRole(callerUserId, id);
  if (!callerRole) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const targetRole = await memberRole(targetUserId, id);
  if (!targetRole) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const isSelf = callerUserId === targetUserId;
  if (!isSelf) {
    if (callerRole === "member") {
      res.status(403).json({ error: "Members can only remove themselves" });
      return;
    }
    if (callerRole === "admin" && targetRole === "owner") {
      res.status(403).json({ error: "Admins cannot remove owners" });
      return;
    }
  }
  if (targetRole === "owner") {
    const owners = await ownerCount(id);
    if (owners <= 1) {
      res
        .status(409)
        .json({ error: "Cannot remove the last owner — promote another member first" });
      return;
    }
  }
  await db
    .delete(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.organizationId, id),
        eq(organizationMembersTable.userId, targetUserId),
      ),
    );
  res.status(204).send();
});

router.get("/orgs/:id/invites", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "admin");
  if (!role) return;
  const rows = await db
    .select()
    .from(organizationInvitesTable)
    .where(eq(organizationInvitesTable.organizationId, id))
    .orderBy(desc(organizationInvitesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/orgs/:id/invites", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "admin");
  if (!role) return;
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (role !== "owner" && parsed.data.role === "owner") {
    res.status(403).json({ error: "Only owners can invite new owners" });
    return;
  }
  const [orgRow] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id))
    .limit(1);
  if (!orgRow) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (seatCapActive(orgRow)) {
    const usage = await loadSeatUsage(id);
    const used = usage.membersCount + usage.pendingInviteCount;
    if (used >= orgRow.seatsPurchased) {
      res.status(409).json({
        error: `Seat limit reached: ${used} / ${orgRow.seatsPurchased} seats used (members + pending invites). Buy more seats to invite again.`,
        code: "SEAT_LIMIT",
        seatsPurchased: orgRow.seatsPurchased,
        membersCount: usage.membersCount,
        pendingInviteCount: usage.pendingInviteCount,
      });
      return;
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(organizationInvitesTable)
    .values({
      organizationId: id,
      invitedByUserId: req.localUser!.id,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      token,
      expiresAt,
    })
    .returning();
  // Best-effort email
  try {
    const { sendOrgInvite } = await import("@workspace/email");
    const origin =
      req.headers.origin?.toString() ||
      (req.headers["x-forwarded-proto"] && req.headers.host
        ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
        : process.env.PUBLIC_BASE_URL ?? "");
    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, id))
      .limit(1);
    await sendOrgInvite({
      to: parsed.data.email,
      orgName: org?.name ?? "an organization",
      acceptUrl: `${origin}/accept-invite/${token}`,
      inviterEmail: req.localUser!.email,
    });
  } catch (err) {
    req.log.warn({ err }, "org invite email failed");
  }
  res.status(201).json({
    id: created!.id,
    email: created!.email,
    role: created!.role,
    token: created!.token,
    expiresAt: created!.expiresAt.toISOString(),
  });
});

router.delete("/orgs/:id/invites/:inviteId", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const inviteId = String(req.params.inviteId);
  const role = await requireMembership(res, req.localUser!.id, id, "admin");
  if (!role) return;
  await db
    .update(organizationInvitesTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organizationInvitesTable.organizationId, id),
        eq(organizationInvitesTable.id, inviteId),
      ),
    );
  res.status(204).send();
});

router.post("/invites/:token/accept", requireAuth, async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const [invite] = await db
    .select()
    .from(organizationInvitesTable)
    .where(eq(organizationInvitesTable.token, token))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.revokedAt) {
    res.status(410).json({ error: "Invite was revoked" });
    return;
  }
  if (invite.acceptedAt) {
    res.status(410).json({ error: "Invite already accepted" });
    return;
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error: "Invite expired" });
    return;
  }
  const userEmail = req.localUser!.email?.toLowerCase() ?? null;
  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    res.status(403).json({
      error: `This invite was sent to ${invite.email}. Sign in with that email to accept.`,
    });
    return;
  }
  // Enforce the seat cap at acceptance time too — a 5-seat org with 5 live
  // invites still must refuse a 6th body walking in the door. Existing members
  // re-accepting their own invite (idempotent) are allowed to pass through.
  const [orgRow] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, invite.organizationId))
    .limit(1);
  if (orgRow && seatCapActive(orgRow)) {
    const alreadyMember = await memberRole(req.localUser!.id, invite.organizationId);
    if (!alreadyMember) {
      const usage = await loadSeatUsage(invite.organizationId);
      if (usage.membersCount >= orgRow.seatsPurchased) {
        res.status(409).json({
          error: `This organization is at its seat limit (${usage.membersCount} / ${orgRow.seatsPurchased}). Ask an owner to buy more seats.`,
          code: "SEAT_LIMIT",
          seatsPurchased: orgRow.seatsPurchased,
          membersCount: usage.membersCount,
        });
        return;
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(organizationMembersTable)
      .values({
        organizationId: invite.organizationId,
        userId: req.localUser!.id,
        role: invite.role,
      })
      .onConflictDoNothing({
        target: [organizationMembersTable.organizationId, organizationMembersTable.userId],
      });
    await tx
      .update(organizationInvitesTable)
      .set({ acceptedAt: new Date(), acceptedByUserId: req.localUser!.id })
      .where(eq(organizationInvitesTable.id, invite.id));
  });
  res.json({ ok: true, organizationId: invite.organizationId });
});

router.post("/orgs/:id/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "owner");
  if (!role) return;
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const priceId =
    parsed.data.interval === "year"
      ? process.env.STRIPE_PRICE_TEAM_SEAT_YEARLY
      : process.env.STRIPE_PRICE_TEAM_SEAT_MONTHLY;
  if (!priceId) {
    res
      .status(503)
      .json({ error: `Team seat Stripe price not configured for ${parsed.data.interval}` });
    return;
  }
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");
  let customerId = org.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: req.localUser!.email ?? undefined,
      metadata: { orgId: org.id, createdByLocalUserId: req.localUser!.id },
    });
    customerId = customer.id;
    await db
      .update(organizationsTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(organizationsTable.id, org.id));
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: parsed.data.seats }],
    success_url: parsed.data.successUrl ?? `${origin}/orgs/${org.id}?status=success`,
    cancel_url: parsed.data.cancelUrl ?? `${origin}/orgs/${org.id}?status=cancel`,
    metadata: { kind: "team_subscription", orgId: org.id, seats: String(parsed.data.seats) },
    subscription_data: {
      metadata: { kind: "team_subscription", orgId: org.id },
    },
  });
  res.json({ url: session.url ?? "" });
});

router.post("/orgs/:id/billing/portal", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "owner");
  if (!role) return;
  const parsed = PortalBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org || !org.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer on file for this organization" });
    return;
  }
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }
  const origin =
    req.headers.origin?.toString() ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "");
  const portal = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: parsed.data.returnUrl ?? `${origin}/orgs/${org.id}`,
  });
  res.json({ url: portal.url });
});

router.post("/orgs/:id/billing/seats", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const role = await requireMembership(res, req.localUser!.id, id, "owner");
  if (!role) return;
  const parsed = UpdateSeatsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (!org.stripeSubscriptionId) {
    res.status(400).json({
      error: "No active team subscription — start one via the CHECKOUT button first.",
      code: "NO_SUBSCRIPTION",
    });
    return;
  }
  // Refuse to shrink below current occupancy — otherwise Stripe would happily
  // bill the smaller quantity while the org still has 7 active members.
  const usage = await loadSeatUsage(id);
  const floor = Math.max(usage.membersCount, 1);
  if (parsed.data.seats < floor) {
    res.status(409).json({
      error: `Cannot reduce seats to ${parsed.data.seats}: org has ${usage.membersCount} active member(s). Remove members first or pick at least ${floor}.`,
      code: "SEATS_BELOW_OCCUPANCY",
      membersCount: usage.membersCount,
      minSeats: floor,
    });
    return;
  }
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    req.log.error({ err }, "Stripe client unavailable");
    res.status(503).json({ error: "Billing not configured" });
    return;
  }
  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) {
      res.status(500).json({ error: "Subscription has no line items" });
      return;
    }
    await stripe.subscriptions.update(org.stripeSubscriptionId, {
      items: [{ id: item.id, quantity: parsed.data.seats }],
      proration_behavior: parsed.data.prorationBehavior,
    });
  } catch (err) {
    req.log.error({ err, orgId: id }, "Stripe seat-quantity update failed");
    res.status(502).json({ error: "Stripe rejected the seat update", detail: (err as Error).message });
    return;
  }
  // The Stripe webhook (customer.subscription.updated) is the source of truth
  // for seatsPurchased, but write it eagerly here too so the UI reflects the
  // change immediately instead of waiting for the webhook round-trip.
  await db
    .update(organizationsTable)
    .set({ seatsPurchased: parsed.data.seats })
    .where(eq(organizationsTable.id, id));
  res.json({ ok: true, seatsPurchased: parsed.data.seats });
});

const OrgVisibilityBody = z.object({
  orgId: z.string().uuid().nullable(),
  orgVisible: z.boolean(),
});

router.patch("/sessions/:id/org-visibility", requireAuth, async (req, res): Promise<void> => {
  const sessionId = String(req.params.id);
  const parsed = OrgVisibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  // Owner check on session
  const [session] = await db
    .select()
    .from(harnessSessionsTable)
    .where(and(eq(harnessSessionsTable.id, sessionId), eq(harnessSessionsTable.userId, userId)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  // If pinning to an org, caller must be a member.
  if (parsed.data.orgId) {
    const role = await memberRole(userId, parsed.data.orgId);
    if (!role) {
      res.status(403).json({ error: "You are not a member of that organization" });
      return;
    }
  }
  const [updated] = await db
    .update(harnessSessionsTable)
    .set({ orgId: parsed.data.orgId, orgVisible: parsed.data.orgVisible })
    .where(eq(harnessSessionsTable.id, sessionId))
    .returning({ id: harnessSessionsTable.id, orgId: harnessSessionsTable.orgId, orgVisible: harnessSessionsTable.orgVisible });
  res.json(updated);
});

// Suppress unused-import noise for `ne` (re-exported for future scope/role queries).
void ne;

export default router;
