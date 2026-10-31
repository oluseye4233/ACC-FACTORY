import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, usersTable, autoCommandUploadsTable as uploads, autoCommandDraftsTable as drafts,
  autoCommandOrdersTable as orders, autoCommandStepsTable as steps } from "@workspace/db";
import { AUTO_COMMAND_READINESS, autoCommandCatalog, packageFor } from "../src/lib/autocommand/catalog";
import { autoCommandPlan } from "../src/lib/autocommand/plan";
import { prepareAutoCommandOrder, getAutoCommandOrder, listAutoCommandOrders } from "../src/lib/autocommand/orders";
import { runAutoCommandPipeline, type AutoCommandStageAdapter } from "../src/lib/autocommand/pipeline";
import {
  AutoCommandIntakeSchema, autoCommandWorkspace, saveAutoCommandDraft, validateAutoCommandLogo,
} from "../src/lib/autocommand/intake";

vi.mock("../src/lib/learning-identity", () => ({ learningIdentity: vi.fn(async () => null) }));
import router from "../src/routes/autocommand";

const userIds: string[] = [];
const input = (extra: Record<string, unknown> = {}) => AutoCommandIntakeSchema.parse({
  requestKey: randomUUID(), projectName: "Test specification", packageType: "BASIC_AGENT",
  intakeMode: "PROMPT", documentType: "BUSINESS_ANALYSIS",
  specification: "Create a governed assistant that summarizes customer questions without inventing answers.",
  targetEmail: "recipient@example.test", contactName: "Test Customer", phone: "+1 555 0100",
  ownerName: "Test Customer", creatorName: "Test Customer", targets: ["IDE"], rightsConfirmed: true,
  ...extra,
});
let first: string, second: string, base: string;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { warn: vi.fn() } as never; next(); });
app.use(router);
const server = createServer(app);
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const id = randomUUID();
    await db.insert(usersTable).values({ id, clerkUserId: `autocommand-${id}`, email: `${id}@example.test` });
    userIds.push(id);
  }
  [first, second] = userIds as [string, string];
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test port missing");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const id of userIds) await db.delete(usersTable).where(eq(usersTable.id, id));
});

describe("AutoCommand frozen production requests", () => {
  it.each(["BASIC_AGENT", "ADVANCED_AGENT", "WEB_APPLICATION"] as const)("plans only applicable stages for %s", type => {
    const plan = autoCommandPlan(type).map(stage => stage.key);
    expect(plan[0]).toBe("F1");
    expect(plan.at(-1)).toBe("F8");
    expect(plan).not.toEqual(expect.arrayContaining(["F9", "F10", "F11", "F12"]));
    expect(plan.includes("F6")).toBe(type === "WEB_APPLICATION");
    expect(plan.includes("F7")).toBe(type === "WEB_APPLICATION");
    expect(plan.includes("SPC_CHEAT_SHEET")).toBe(type !== "BASIC_AGENT");
    if (type !== "BASIC_AGENT") expect(plan.indexOf("SPC_CHEAT_SHEET")).toBe(plan.indexOf("F5") + 1);
  });
  it("freezes server-priced input atomically and replays concurrent preparations", async () => {
    const draft = await saveAutoCommandDraft(first, "verified@example.test", input());
    const [a, b] = await Promise.all([
      prepareAutoCommandOrder(first, "verified@example.test", draft.id),
      prepareAutoCommandOrder(first, "verified@example.test", draft.id),
    ]);
    expect(a).toEqual(b);
    expect(a.standardPriceCents).toBe(1000);
    expect(a.state).toBe("AWAITING_AUTHORIZATION");
    expect(a.completedStages).toBe(1);
    expect(a.stages[0]).toMatchObject({ key: "F1", state: "COMPLETE" });
    expect(a.stages.slice(1).every(stage => stage.state === "PENDING")).toBe(true);
    expect(a.promotionStatus).toBe("NOT_CLAIMED");
    expect(a.paymentStatus).toBe("NOT_STARTED");
    expect(a.deliveryStatus).toBe("NOT_STARTED");
    // Simulated later draft change cannot alter the accepted order snapshot.
    await db.update(drafts).set({ input: { ...draft.input, projectName: "Different later input" } }).where(eq(drafts.id, draft.id));
    const [stored] = await db.select().from(orders).where(eq(orders.id, a.id));
    expect(stored.snapshot.input).toMatchObject({ projectName: draft.projectName });
    expect(await getAutoCommandOrder(first, a.id)).toEqual(a);
    expect((await listAutoCommandOrders(first)).some(row => row.id === a.id)).toBe(true);
  });
  it("isolates orders and rejects an identity changed since intake", async () => {
    const draft = await saveAutoCommandDraft(first, "verified@example.test", input());
    await expect(prepareAutoCommandOrder(second, "verified@example.test", draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(prepareAutoCommandOrder(first, "other@example.test", draft.id)).rejects.toMatchObject({ status: 409 });
    const order = await prepareAutoCommandOrder(first, "verified@example.test", draft.id);
    await expect(getAutoCommandOrder(second, order.id)).rejects.toMatchObject({ status: 404 });
    expect((await listAutoCommandOrders(second)).some(row => row.id === order.id)).toBe(false);
  });
  it("does not dispatch while the public production gate is closed", async () => {
    const authorize = vi.fn(async () => true);
    expect(await runAutoCommandPipeline(randomUUID(), { authorize, adapters: {} })).toBe("DISABLED");
    expect(authorize).not.toHaveBeenCalled();
  });
});

describe("AutoCommand runner with test-only adapters and test-only authorization", () => {
  async function prepared() {
    const draft = await saveAutoCommandDraft(second, "verified@example.test", input());
    return prepareAutoCommandOrder(second, "verified@example.test", draft.id);
  }
  async function enabled<T>(action: () => Promise<T>) {
    AUTO_COMMAND_READINESS.automaticProductionEnabled = true;
    try { return await action(); } finally { AUTO_COMMAND_READINESS.automaticProductionEnabled = false; }
  }
  it("blocks missing grants and adapters before recording dispatch", async () => {
    const order = await prepared();
    await enabled(async () => {
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => false, adapters: {} })).toBe("NOT_AUTHORIZED");
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: {} })).toBe("ADAPTER_UNAVAILABLE");
    });
    expect((await getAutoCommandOrder(second, order.id)).state).toBe("AWAITING_AUTHORIZATION");
  });
  it("persists each completion, replays saved progress and never treats generation as delivery", async () => {
    const order = await prepared();
    const calls: string[] = [];
    const adapters = Object.fromEntries(order.stages.slice(1).map(stage => [stage.key, vi.fn(async (context) => {
      calls.push(stage.key);
      expect(context.previous).toHaveLength(calls.length - 1);
      return { artifactIds: [randomUUID()] };
    }) as AutoCommandStageAdapter]));
    await enabled(async () => {
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters })).toBe("AWAITING_PUBLICATION");
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters })).toBe("AWAITING_PUBLICATION");
    });
    expect(calls).toEqual(order.stages.slice(1).map(stage => stage.key));
    const saved = await getAutoCommandOrder(second, order.id);
    expect(saved.completedStages).toBe(saved.totalStages);
    expect(saved.deliveryStatus).toBe("NOT_STARTED");
  });
  it("serializes concurrent workers without redispatching an in-flight external call", async () => {
    const order = await prepared();
    let signal!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { signal = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const adapter = vi.fn(async () => { signal(); await held; return { artifactIds: [randomUUID()] }; });
    await enabled(async () => {
      const firstRun = runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: { F0: adapter } });
      await entered;
      try {
        expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: { F0: adapter } })).toBe("IN_FLIGHT_OR_UNCERTAIN");
      } finally { release(); }
      expect(await firstRun).toBe("ADAPTER_UNAVAILABLE");
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it("never redispatches after an uncertain provider outcome", async () => {
    const order = await prepared();
    const adapter = vi.fn(async () => { throw new Error("Connection lost after dispatch"); });
    await enabled(async () => {
      for (let i = 0; i < 2; i++) expect(await runAutoCommandPipeline(order.id,
        { authorize: async () => true, adapters: { F0: adapter } })).toBe("REVIEW_REQUIRED");
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect((await getAutoCommandOrder(second, order.id)).state).toBe("REVIEW_REQUIRED");
  });
  it("does not reclaim a dispatch after a process interruption, regardless of age", async () => {
    const order = await prepared();
    await db.update(steps).set({ state: "DISPATCHING", claimToken: randomUUID(), startedAt: new Date(0) })
      .where(and(eq(steps.orderId, order.id), eq(steps.key, "F0")));
    const adapter = vi.fn(async () => ({ artifactIds: [randomUUID()] }));
    await enabled(async () => {
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: { F0: adapter } })).toBe("IN_FLIGHT_OR_UNCERTAIN");
    });
    expect(adapter).not.toHaveBeenCalled();
  });
  it("fails closed on changed snapshots", async () => {
    const order = await prepared();
    await db.update(orders).set({ snapshotHash: "not-the-saved-hash" }).where(eq(orders.id, order.id));
    const adapter = vi.fn(async () => ({ artifactIds: [randomUUID()] }));
    await enabled(async () => {
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: { F0: adapter } })).toBe("REVIEW_REQUIRED");
    });
    expect(adapter).not.toHaveBeenCalled();
  });
  it("rejects missing stage records rather than declaring a package complete", async () => {
    const order = await prepared();
    await db.delete(steps).where(and(eq(steps.orderId, order.id), eq(steps.key, "F8")));
    const adapter = vi.fn(async () => ({ artifactIds: [randomUUID()] }));
    await enabled(async () => {
      expect(await runAutoCommandPipeline(order.id, { authorize: async () => true, adapters: { F0: adapter } })).toBe("REVIEW_REQUIRED");
    });
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe("AutoCommand catalog and honest readiness", () => {
  it("publishes exactly the requested active prices and disabled future products", () => {
    const catalog = autoCommandCatalog();
    expect(catalog.packages.filter(item => item.available).map(item => item.priceCents)).toEqual([1000, 2500, 5000]);
    expect(catalog.packages.filter(item => !item.available).map(item => item.id)).toEqual(["FIRMWARE", "ROBOTWARE", "CHIPWARE"]);
    expect(catalog.promotion.policy).toBe("FIRST_PACKAGE_PER_VERIFIED_EMAIL");
    expect(catalog.readiness.checkoutEnabled).toBe(false);
    expect(catalog.readiness.automaticProductionEnabled).toBe(false);
    expect(catalog.readiness.emailDeliveryEnabled).toBe(false);
  });
  it("rejects unsupported and inactive products", () => {
    expect(() => packageFor("FIRMWARE")).toThrow();
    expect(() => input({ packageType: "ROBOTWARE" })).toThrow();
  });
  it("keeps the public catalog available without a verified customer", async () => {
    const response = await fetch(`${base}/autocommand/catalog`);
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe("ATANDA AutoCommand");
  });
  it("returns no private workspace to an unverified identity", async () => {
    const response = await fetch(`${base}/autocommand/workspace`);
    expect(await response.json()).toEqual({ authenticated: false, verifiedEmail: null, drafts: [], orders: [] });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects a forged body email and shared staff cookies", async () => {
    const response = await fetch(`${base}/autocommand/drafts`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: "staff_session=fake" },
      body: JSON.stringify({ ...input(), verifiedEmail: "forged@example.test" }),
    });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("verified email");
  });
  it("has no working checkout, run or publication bypass endpoints", async () => {
    for (const suffix of ["checkout", "run", "download"]) {
      const response = await fetch(`${base}/autocommand/${suffix}`, { method: "POST" });
      expect(response.status).toBe(404);
    }
  });
});

describe("AutoCommand private intake", () => {
  it("saves a durable draft, not an order or promotion redemption", async () => {
    const saved = await saveAutoCommandDraft(first, "Verified@Example.test ", input());
    expect(saved.state).toBe("DRAFT");
    expect(saved.verifiedEmail).toBe("verified@example.test");
    expect(saved.promotionStatus).toBe("CHECK_AT_CHECKOUT");
    expect(saved.standardPriceCents).toBe(1000);
    expect((await autoCommandWorkspace(first, "verified@example.test")).drafts.some(row => row.id === saved.id)).toBe(true);
  });
  it("replays a duplicate request without creating a second draft", async () => {
    const data = input();
    const [a, b] = await Promise.all([
      saveAutoCommandDraft(first, "verified@example.test", data),
      saveAutoCommandDraft(first, "verified@example.test", data),
    ]);
    expect(a.id).toBe(b.id);
    await expect(saveAutoCommandDraft(first, "verified@example.test", { ...data, projectName: "Changed project" })).rejects.toMatchObject({ status: 409 });
  });
  it("isolates drafts across users and does not infer promotion entitlement", async () => {
    const saved = await saveAutoCommandDraft(first, "shared-email@example.test", input());
    const workspace = await autoCommandWorkspace(second, "shared-email@example.test");
    expect(workspace.drafts.some(row => row.id === saved.id)).toBe(false);
    expect(workspace).not.toHaveProperty("freePackageAvailable");
  });
  it("requires real document/cartridge inputs and honest corporate ownership", () => {
    expect(() => input({ intakeMode: "INTAKE" })).toThrow();
    expect(() => input({ intakeMode: "CARTRIDGE", cartridgeContext: "" })).toThrow();
    expect(() => input({ companyName: "Company", ownerName: "Individual" })).toThrow();
    expect(() => input({ rightsConfirmed: false })).toThrow();
    expect(() => input({ targets: ["IDE", "IDE"] })).toThrow();
    expect(() => input({ standardPriceCents: 0 })).toThrow();
    expect(input({ companyName: "Company", ownerName: "Company" }).creatorName).toBe("Test Customer");
  });
  it("rejects foreign, incomplete and wrong-purpose upload references", async () => {
    const id = randomUUID();
    await db.insert(uploads).values({
      id, userId: first, purpose: "LOGO", state: "STORED", filename: "logo.png",
      mime: "image/png", storageKey: `test/${id}`, contentHash: "test-not-a-real-file",
    });
    await expect(saveAutoCommandDraft(second, "second@example.test", input({
      companyName: "Company", ownerName: "Company", logoUploadId: id,
    }))).rejects.toMatchObject({ status: 404 });
    await expect(saveAutoCommandDraft(first, "first@example.test", input({
      intakeMode: "INTAKE", documentUploadId: id,
    }))).rejects.toMatchObject({ status: 404 });
    await db.update(uploads).set({ state: "PENDING" }).where(eq(uploads.id, id));
    await expect(saveAutoCommandDraft(first, "first@example.test", input({
      companyName: "Company", ownerName: "Company", logoUploadId: id,
    }))).rejects.toMatchObject({ status: 404 });
  });
  it("rejects active SVG, renamed files and oversized raster logos", () => {
    expect(() => validateAutoCommandLogo(Buffer.from("<svg/>"), "logo.svg")).toThrow();
    expect(() => validateAutoCommandLogo(Buffer.from("not a png"), "logo.png")).toThrow();
    expect(() => validateAutoCommandLogo(Buffer.alloc(2_000_001), "logo.png")).toThrow();
    const png = Buffer.alloc(25);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
    png.write("IHDR", 12); png.writeUInt32BE(32, 16); png.writeUInt32BE(32, 20);
    expect(validateAutoCommandLogo(png, "logo.png")).toBe("image/png");
    expect(() => validateAutoCommandLogo(png, "logo.jpg")).toThrow();
  });
});
