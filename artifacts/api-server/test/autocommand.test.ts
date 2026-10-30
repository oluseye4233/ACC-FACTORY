import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, autoCommandUploadsTable as uploads } from "@workspace/db";
import { autoCommandCatalog, packageFor } from "../src/lib/autocommand/catalog";
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
    expect(await response.json()).toEqual({ authenticated: false, verifiedEmail: null, drafts: [] });
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
