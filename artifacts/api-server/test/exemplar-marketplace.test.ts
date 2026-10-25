import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  db, exemplarLibraryItemsTable, sphinxMarketplaceSettingsTable, usersTable,
  type ExemplarKind,
} from "@workspace/db";

const auth = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", async (original) => ({
  ...await original<typeof import("../src/lib/auth")>(), requireAuth: auth,
}));
import exemplarRoutes from "../src/routes/exemplars";
import integrationRoutes from "../src/routes/integrations";
import { createExemplarMarketplaceRouter } from "../src/routes/exemplar-marketplace";

describe("Exemplar → Sphinx supply catalog", () => {
  const settingsId = `test-marketplace-${randomUUID()}`;
  let owner: typeof usersTable.$inferSelect;
  let other: typeof usersTable.$inferSelect;
  let admin: typeof usersTable.$inferSelect;
  let server: ReturnType<typeof express.prototype.listen>;
  let base: string;
  const review = {
    decision: "APPROVED", jcse: 35, tokenCount: 100_000, version: "1.0.0",
    notes: "Internal baseline evidence reviewed.",
    documentation: "README section in the reviewed artifact",
    tests: "Basic cases and results reviewed in test appendix",
    rightsCleared: true, safetyReviewed: true,
  };

  beforeAll(async () => {
    [owner, other, admin] = await Promise.all(["owner", "other", "admin"].map(async (role) => {
      const [row] = await db.insert(usersTable).values({
        clerkUserId: `exemplar-${role}-${randomUUID()}`,
        email: `exemplar-${randomUUID()}@example.test`,
        role: role === "admin" ? "ADMIN" : "USER",
      }).returning();
      return row!;
    }));
    auth.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      const user = { owner, other, admin }[String(req.headers.authorization) as "owner"];
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
      req.localUser = user;
      next();
    });
    const app = express();
    app.use(express.json());
    app.use("/api", createExemplarMarketplaceRouter(settingsId));
    app.use("/api", exemplarRoutes);
    app.use("/api", integrationRoutes);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    base = `http://127.0.0.1:${address.port}/api`;
  });
  beforeEach(async () => {
    await db.delete(exemplarLibraryItemsTable)
      .where(inArray(exemplarLibraryItemsTable.ownerUserId, [owner.id, other.id, admin.id]));
    await db.insert(sphinxMarketplaceSettingsTable).values({ id: settingsId, publicOpen: false })
      .onConflictDoUpdate({ target: sphinxMarketplaceSettingsTable.id, set: { publicOpen: false } });
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(sphinxMarketplaceSettingsTable).where(eq(sphinxMarketplaceSettingsTable.id, settingsId));
    const ids = [owner?.id, other?.id, admin?.id].filter(Boolean);
    if (ids.length) await db.delete(usersTable).where(inArray(usersTable.id, ids));
  });

  async function api(path: string, method = "GET", body?: unknown, user = "owner") {
    return fetch(`${base}${path}`, {
      method, headers: { authorization: user, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function item(kind: ExemplarKind = "SPC") {
    const [row] = await db.insert(exemplarLibraryItemsTable).values({
      ownerUserId: owner.id, kind, title: `Supply ${kind}`, tagline: "Test supply item",
      body: "# PRIVATE ARTIFACT BODY\nThis full content must never enter the public preview.",
    }).returning();
    return row!;
  }
  async function approve(id: string) {
    const response = await api(`/exemplars/${id}/qualification`, "POST", review, "admin");
    expect(response.status).toBe(200);
  }
  async function select(id: string, mode = "SPHINX_ARTIFACT") {
    return api(`/exemplars/${id}/visibility`, "PATCH", { artifactMode: mode, commercialConsent: true });
  }

  it("keeps library content authenticated and public discovery closed by default", async () => {
    const row = await item();
    expect((await api("/exemplars", "GET", undefined, "anonymous")).status).toBe(401);
    expect((await api(`/exemplars/${row.id}`, "GET", undefined, "anonymous")).status).toBe(401);
    expect(await (await api("/sphinx/catalog", "GET", undefined, "anonymous")).json())
      .toEqual({ publicOpen: false, items: [] });
  });

  it("only gives ownership controls to the contributor; platform references cannot be switched", async () => {
    const row = await item();
    const own = await (await api(`/exemplars/${row.id}`)).json();
    expect(own).toMatchObject({ isOwner: true, artifactMode: "LIBRARY_ARTIFACT", active: true, eligibility: { eligible: false } });
    // Newly admitted Practitioner identities must not read another owner's
    // private library artifacts merely by knowing their IDs.
    expect((await api(`/exemplars/${row.id}`, "GET", undefined, "other")).status).toBe(404);
    const othersLibrary = await (await api("/exemplars", "GET", undefined, "other")).json();
    expect(othersLibrary.some((entry: { id: string }) => entry.id === row.id)).toBe(false);
    expect((await api(`/exemplars/${row.id}`, "GET", undefined, "admin")).status).toBe(200);
    expect((await api(`/exemplars/${row.id}/visibility`, "PATCH", { active: false }, "other")).status).toBe(404);
    expect((await api(`/exemplars/${row.id}/visibility`, "PATCH", { active: false }, "admin")).status).toBe(404);
    expect((await api("/exemplars/sphinx-ultra-si/visibility", "PATCH", { artifactMode: "SPHINX_ARTIFACT" })).status).toBe(400);
  });

  it("rejects unqualified opt-in, forged qualification and non-admin reviews", async () => {
    const row = await item();
    expect((await select(row.id)).status).toBe(409);
    expect((await api(`/exemplars/${row.id}/visibility`, "PATCH", { qualification: review, artifactMode: "SPHINX_ARTIFACT" })).status).toBe(400);
    expect((await api(`/exemplars/${row.id}/qualification`, "POST", review)).status).toBe(403);
    expect((await api("/exemplars/marketplace", "PATCH", { publicOpen: true })).status).toBe(403);
  });

  it.each([
    { jcse: 34 }, { tokenCount: 100_001 }, { rightsCleared: false },
    { safetyReviewed: false }, { version: "latest" }, { documentation: "" }, { tests: "" },
  ])("enforces the baseline on approval: %j", async (bad) => {
    const row = await item();
    expect((await api(`/exemplars/${row.id}/qualification`, "POST", { ...review, ...bad }, "admin")).status).toBe(400);
  });

  it.each(["MA", "SPC", "MPDD", "PDD"] as ExemplarKind[])("allows a reviewed %s to opt in with explicit consent", async (kind) => {
    const row = await item(kind);
    await approve(row.id);
    expect((await api(`/exemplars/${row.id}/visibility`, "PATCH", { artifactMode: "SPHINX_ARTIFACT" })).status).toBe(409);
    const response = await select(row.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ artifactMode: "SPHINX_ARTIFACT", eligibility: { eligible: true } });
    expect((await (await api("/sphinx/catalog")).json()).items).toHaveLength(0);
  });

  it("publishes only opted-in approved active metadata after admin launch, and withdraws immediately", async () => {
    const row = await item();
    await item("MA"); // Unreviewed library item must not leak.
    await approve(row.id);
    await select(row.id);
    expect((await api("/exemplars/marketplace", "PATCH", { publicOpen: true }, "admin")).status).toBe(200);
    const catalog = await (await api("/sphinx/catalog", "GET", undefined, "anonymous")).json();
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).toMatchObject({ id: row.id, kind: "SPC", jcse: 35 });
    expect(catalog.items[0]).not.toHaveProperty("body");
    expect(catalog.items[0]).not.toHaveProperty("qualification");
    expect(catalog.items[0]).not.toHaveProperty("ownerUserId");
    await select(row.id, "LIBRARY_ARTIFACT");
    expect((await (await api("/sphinx/catalog")).json()).items).toHaveLength(0);
  });

  it("archiving resets commercial opt-in, and reactivation does not silently restore it", async () => {
    const row = await item();
    await approve(row.id); await select(row.id);
    const archived = await (await api(`/exemplars/${row.id}/visibility`, "PATCH", { active: false })).json();
    expect(archived).toMatchObject({ active: false, artifactMode: "LIBRARY_ARTIFACT", eligibility: { eligible: false } });
    const active = await (await api(`/exemplars/${row.id}/visibility`, "PATCH", { active: true })).json();
    expect(active).toMatchObject({ active: true, artifactMode: "LIBRARY_ARTIFACT" });
  });

  it("revocation resets the switch, and changed content invalidates a previous approval", async () => {
    const row = await item();
    await approve(row.id); await select(row.id);
    await api("/exemplars/marketplace", "PATCH", { publicOpen: true }, "admin");
    await db.update(exemplarLibraryItemsTable).set({ body: "Changed content after review" })
      .where(eq(exemplarLibraryItemsTable.id, row.id));
    expect((await (await api("/sphinx/catalog")).json()).items).toHaveLength(0);
    expect((await select(row.id)).status).toBe(409);
    const revoked = await (await api(`/exemplars/${row.id}/qualification`, "POST", { ...review, decision: "REJECTED" }, "admin")).json();
    expect(revoked.artifactMode).toBe("LIBRARY_ARTIFACT");
    expect(revoked.eligibility.eligible).toBe(false);
  });

  it("never commercializes F0 reports or unresolved GRO safety states", async () => {
    const report = await item("F0_REPORT");
    expect((await api(`/exemplars/${report.id}/qualification`, "POST", review, "admin")).status).toBe(400);
    expect((await select(report.id)).status).toBe(409);
    const unsafe = await item();
    await db.update(exemplarLibraryItemsTable).set({ artifactSnapshot: { gro: "RED" } })
      .where(eq(exemplarLibraryItemsTable.id, unsafe.id));
    expect((await api(`/exemplars/${unsafe.id}/qualification`, "POST", review, "admin")).status).toBe(400);
    expect((await select(unsafe.id)).status).toBe(409);
  });

  it("does not let legacy direct publishing bypass library qualification", async () => {
    const response = await api("/integrations/sphinx/publish", "POST", { artifactId: randomUUID() });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("SPHINX_LIBRARY_QUALIFICATION_REQUIRED");
  });
});
