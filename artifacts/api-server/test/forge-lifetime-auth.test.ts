import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Subscriber } from "@workspace/db";

const state = vi.hoisted(() => ({ identity: null as any, enrolled: undefined as any, failed: false }));
vi.mock("../src/lib/learning-identity", () => ({
  learningIdentity: async () => {
    if (state.failed) throw new Error("identity lookup unavailable");
    return state.identity;
  },
}));
vi.mock("../src/lib/staff-auth", () => ({
  STAFF_COOKIE: "staff", parseSession: () => null,
  ensureStaffUser: vi.fn(), ensureStaffSubscriber: vi.fn(),
}));
vi.mock("../src/lib/learning-access", async (original) => ({
  ...await original<typeof import("../src/lib/learning-access")>(),
  activeLearningMembership: async () => state.enrolled,
}));

import { requireAuth, requireAdmin } from "../src/lib/auth";
import { requireTier } from "../src/lib/tier";
import { applyForgePractitioner } from "../src/lib/forge-lifetime";
import { learningRouteAllowed } from "../src/lib/learning-access";

const base = {
  id: "67ab4b19-f257-45f6-b5fe-06344218490e", userId: "user",
  tier: "EXPLORER", status: "inactive", f1Today: 7,
  stripeSubscriptionId: null, f1000Member: false,
} as Subscriber;

describe("FORGE lifetime Practitioner authorization", () => {
  let server: ReturnType<express.Express["listen"]>, origin: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.log = { error: vi.fn(), warn: vi.fn() } as any; next(); });
    const view: express.RequestHandler = (req, res) => {
      res.json({ tier: req.effectiveTier, role: req.localUser?.role, education: Boolean(req.education) });
    };
    app.post("/harness/f5", requireAuth, requireTier("PRACTITIONER"), view);
    app.post("/harness/f8", requireAuth, requireTier("ARCHITECT"), view);
    app.post("/admin/subscribers", requireAuth, requireAdmin, view);
    app.post("/billing/checkout", requireAuth, view);
    app.post("/f10/releases", requireAuth, view);
    app.get("/exemplars", requireAuth, view);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.on("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  beforeEach(() => {
    state.failed = false; state.enrolled = undefined;
    state.identity = {
      user: { id: "user", role: "USER", clerkUserId: "clerk-user" },
      email: "verified@example.test", lifetimePractitioner: true,
      subscriber: applyForgePractitioner(base, true),
    };
  });
  const post = (path: string) => fetch(`${origin}${path}`, { method: "POST" });

  test("offers a Practitioner floor without overwriting payment records, counters or higher plans", () => {
    expect(applyForgePractitioner(base, false)).toBe(base);
    expect(applyForgePractitioner(base, true)).toEqual({ ...base, tier: "PRACTITIONER" });
    for (const tier of ["PRACTITIONER", "ARCHITECT", "INSTITUTION"] as const) {
      const higher = { ...base, tier, stripeSubscriptionId: "paid-record" };
      expect(applyForgePractitioner(higher, true)).toBe(higher);
    }
    expect(base.tier).toBe("EXPLORER");
  });
  test("retains ordinary Practitioner access after course expiry with no educational bypass", async () => {
    const response = await post("/harness/f5");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tier: "PRACTITIONER", role: "USER", education: false });
    expect((await fetch(`${origin}/exemplars`)).status).toBe(200);
    expect((await post("/harness/f8")).status).toBe(403);
  });
  test("blocks staff-only operations, paid checkout and external release without broadening access", async () => {
    for (const path of ["/admin/subscribers", "/billing/checkout", "/f10/releases"]) {
      expect((await post(path)).status, path).toBe(403);
    }
  });
  test("does not treat a course-only identity or client-selected tier as a lifetime grant", async () => {
    state.identity.lifetimePractitioner = false;
    state.identity.subscriber = base;
    expect((await post("/harness/f5")).status).toBe(403);
    expect((await fetch(`${origin}/harness/f5`, {
      method: "POST", headers: { "x-tier": "INSTITUTION", "x-lifetime-practitioner": "true" },
    })).status).toBe(403);
  });
  test("identity failure stays closed; anonymous callers receive no benefit", async () => {
    state.identity = null;
    expect((await post("/harness/f5")).status).toBe(401);
    state.failed = true;
    expect((await post("/harness/f5")).status).toBe(503);
  });
  test("course funding never leaks into newly available library operations", async () => {
    state.enrolled = { cohort: { id: "cohort" }, member: { id: "membership" } };
    expect(await (await fetch(`${origin}/exemplars`)).json()).toMatchObject({ education: false });
    expect(await (await post("/harness/f5")).json()).toMatchObject({ education: true });
  });
  test("lifetime route extension retains explicit deny boundaries", () => {
    for (const path of ["/admin", "/orgs", "/operations", "/f11/releases", "/harness/f9", "/spc-player/runs/id/deliver"]) {
      expect(learningRouteAllowed("POST", path, false, true), path).toBe(false);
    }
    expect(learningRouteAllowed("POST", "/ingest", false, true)).toBe(true);
    expect(learningRouteAllowed("POST", "/ingest", false, false)).toBe(false);
  });
});
