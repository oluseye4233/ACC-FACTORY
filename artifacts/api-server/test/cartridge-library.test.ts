import express, { type Request, type Response, type NextFunction } from "express";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db, usersTable, exemplarLibraryItemsTable, cartridgePackagesTable,
  commandCentreSubscribersTable, type User, type Subscriber,
} from "@workspace/db";
import { invalidateCartridgeContext, loadCartridgeContext } from "../src/lib/cartridge-context";
import { listExemplars, getExemplar } from "../src/data/exemplars";

process.env.SUBSCRIPTIONS_ENABLED = "false";
vi.mock("../src/lib/auth", () => ({
  requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.headers["x-test-actor"]) { res.status(401).json({ error: "Unauthorized" }); return; }
    next();
  },
}));
vi.mock("../src/engines/shared", async (original) => ({
  ...await original<typeof import("../src/engines/shared")>(),
  callLlmJson: vi.fn(() => { throw new Error("Library reuse must not invoke a model"); }),
}));

let actors: User[] = [], subscribers: Subscriber[] = [], url: string;
let close: () => Promise<void>;
let owned: string, archived: string, foreignArchived: string, shared: string;
const sourceBody = "# Archived SPC — retained behavior\n\nUse this complete reference for the controlled project. ".repeat(180);

function request(path: string, options: RequestInit = {}, actor = "owner") {
  return fetch(`${url}/api${path}`, { ...options, headers: { "x-test-actor": actor, ...options.headers } });
}
function form(ids: unknown): FormData {
  const value = new FormData();
  value.set("projectName", "Cartridge library integration");
  value.set("outcomeOneLiner", "Use named archived sources at the first governed gate.");
  value.set("scopeStatement", "Create a narrowly scoped product from the selected library references, preserving operator intent, ownership boundaries, and all mandatory governance.");
  value.set("exemplarIds", typeof ids === "string" ? ids : JSON.stringify(ids));
  return value;
}
async function create(ids: unknown) {
  const response = await request("/cartridge", { method: "POST", body: form(ids) });
  return { response, body: await response.json() };
}

beforeAll(async () => {
  const stamp = randomUUID();
  actors = await db.insert(usersTable).values(["owner", "other"].map((role) => ({
    clerkUserId: `cartridge_library_${role}_${stamp}`,
    email: `cartridge-library-${role}-${stamp}@example.test`, displayName: "Cartridge Library Test", role: "ADMIN" as const,
  }))).returning();
  subscribers = await db.insert(commandCentreSubscribersTable).values(actors.map((actor) => ({
    userId: actor.id, tier: "INSTITUTION" as const, status: "active" as const,
  }))).returning();
  const rows = await db.insert(exemplarLibraryItemsTable).values([
    { ownerUserId: actors[0].id, title: "Named PDD source", kind: "PDD" as const, active: true },
    { ownerUserId: actors[0].id, title: "Archived behavior SPC", kind: "SPC" as const, active: false },
    { ownerUserId: actors[1].id, title: "Other owner's withdrawn SPC", kind: "SPC" as const, active: false },
    { ownerUserId: actors[1].id, title: "Shared active Micro Agent", kind: "MA" as const, active: true },
  ].map((row) => ({ ...row, tagline: "Test reference only", body: sourceBody }))).returning();
  [owned, archived, foreignArchived, shared] = rows.map((row) => row.id);
  const router = (await import("../src/routes/cartridge")).default;
  const app = express();
  app.use(express.json(), express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    const index = req.headers["x-test-actor"] === "other" ? 1 : 0;
    req.localUser = actors[index]; req.subscriber = subscribers[index]; req.effectiveTier = "INSTITUTION";
    const noop = () => {};
    (req as unknown as { log: unknown }).log = { info: noop, warn: noop, error: noop };
    next();
  });
  app.use("/api", router);
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  url = `http://127.0.0.1:${address.port}`;
  close = () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

afterAll(async () => {
  await close?.();
  if (actors.length) await db.delete(usersTable).where(inArray(usersTable.id, actors.map((actor) => actor.id)));
});

describe("Cartridge F1 Exemplar Library integration", () => {
  test("picker requires authentication and includes only available archived sources", async () => {
    expect((await fetch(`${url}/api/cartridge/exemplars`)).status).toBe(401);
    const response = await request("/cartridge/exemplars");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const list = await response.json();
    expect(list).toContainEqual(expect.objectContaining({ id: archived, title: "Archived behavior SPC", active: false, kind: "SPC" }));
    expect(list).toContainEqual(expect.objectContaining({ id: shared, kind: "MA", active: true }));
    expect(list.some((item: { id: string }) => item.id === foreignArchived)).toBe(false);
    expect(list[0]).not.toHaveProperty("body");
  });

  test("invalid, duplicate, excessive and unavailable selections fail before creation", async () => {
    const before = await db.select().from(cartridgePackagesTable).where(eq(cartridgePackagesTable.userId, actors[0].id));
    for (const ids of ["{broken", [archived, archived], Array.from({ length: 11 }, () => randomUUID()), null, [""], 2]) {
      const { response } = await create(ids);
      expect(response.status, String(ids)).toBe(400);
    }
    for (const ids of [[foreignArchived], [randomUUID()], ["no-such-reference"]]) {
      const { response } = await create(ids);
      expect(response.status).toBe(404);
    }
    const after = await db.select().from(cartridgePackagesTable).where(eq(cartridgePackagesTable.userId, actors[0].id));
    expect(after).toHaveLength(before.length);
  });

  test("captures named archived SPC and other artifact bodies without reactivating or commercializing", async () => {
    const { response, body } = await create([archived, owned, shared]);
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.librarySources.map((source: { id: string }) => source.id)).toEqual([archived, owned, shared]);
    expect(body.librarySources[0]).toMatchObject({
      id: archived, active: false, kind: "SPC", title: "Archived behavior SPC", body: sourceBody,
      contentSha256: createHash("sha256").update(sourceBody).digest("hex"),
    });
    const [original] = await db.select().from(exemplarLibraryItemsTable).where(eq(exemplarLibraryItemsTable.id, archived));
    expect(original.active).toBe(false); expect(original.artifactMode).toBe("LIBRARY_ARTIFACT");
    expect((await request(`/cartridge/${body.id}`, {}, "other")).status).toBe(404);
  });

  test("retains exact bytes through reload, library changes and deletion, and injects snapshots into F1 context", async () => {
    const { body } = await create([archived, owned]);
    const started = await request(`/cartridge/${body.id}/start-session`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const session = await started.json();
    expect(started.status, JSON.stringify(session)).toBe(201);
    await db.update(exemplarLibraryItemsTable).set({ body: "Changed source — must not replace the retained snapshot." }).where(eq(exemplarLibraryItemsTable.id, owned));
    await db.delete(exemplarLibraryItemsTable).where(eq(exemplarLibraryItemsTable.id, archived));
    const reloaded = await request(`/sessions/${session.id}/cartridge`);
    const saved = await reloaded.json();
    expect(reloaded.status).toBe(200);
    expect(saved.librarySources[0].body).toBe(sourceBody);
    expect(saved.librarySources[1].body).toBe(sourceBody);
    invalidateCartridgeContext(session.id);
    const context = await loadCartridgeContext(session.id);
    expect(context).toContain("EXEMPLAR LIBRARY SOURCES");
    expect(context).toContain("Archived behavior SPC");
    expect(context).toContain("Named PDD source");
    expect(context).toContain(sourceBody.slice(0, 300));
    expect(context).not.toContain("Changed source");
    expect(context).toContain("status at capture: archived");
    expect(context!.length).toBeLessThanOrEqual(24_014);
  });

  test("curated references are snapshotted when the underlying source file exists", async () => {
    const reference = listExemplars().find((entry) => {
      const text = getExemplar(entry.id)?.body;
      return text && text.length >= 20 && text.length <= 250_000;
    });
    expect(reference).toBeDefined();
    const { response, body } = await create([reference!.id]);
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.librarySources[0]).toMatchObject({ id: reference!.id, title: reference!.title, source: "curated", active: true });
    expect(body.librarySources[0].body).toBe(getExemplar(reference!.id)!.body);
  });

  test("all ten selected sources remain represented even with maximum-length project fields", async () => {
    const refs = await db.insert(exemplarLibraryItemsTable).values(Array.from({ length: 10 }, (_, i) => ({
      ownerUserId: actors[0].id, title: `${i}: ${"Long artifact name ".repeat(15)}`.slice(0, 255),
      kind: "MPDD" as const, tagline: "Boundary test", body: `REFERENCE-${i} ` + "Detailed design. ".repeat(1000),
    }))).returning();
    const payload = form(refs.map((ref) => ref.id));
    payload.set("scopeStatement", "Defined scope. ".repeat(500));
    payload.set("projectName", "P".repeat(255));
    payload.set("outcomeOneLiner", "O".repeat(1000));
    payload.set("targetPlatformHint", "T".repeat(500));
    const created = await request("/cartridge", { method: "POST", body: payload });
    const cartridge = await created.json();
    expect(created.status, JSON.stringify(cartridge)).toBe(201);
    const started = await request(`/cartridge/${cartridge.id}/start-session`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    const session = await started.json();
    expect(started.status).toBe(201);
    const context = await loadCartridgeContext(session.id);
    for (const ref of refs) expect(context).toContain(`Source ID: ${ref.id}`);
    for (let i = 0; i < refs.length; i++) expect(context).toContain(`REFERENCE-${i}`);
    expect(context!.length).toBeLessThanOrEqual(24_014);
  });
});
