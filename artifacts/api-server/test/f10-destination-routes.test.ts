import { describe, expect, beforeAll, afterAll, it, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import { db, f10DestinationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.headers["x-test-user-id"] ?? "");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(401).json({ error: "test user not found" }); return; }
    req.localUser = user; next();
  } };
});

describe("F10 destination tenant routes", () => {
  let server: ReturnType<typeof express.prototype.listen>;
  let url = "", tenant = "", other = "";
  beforeAll(async () => {
    const [a, b] = await db.insert(usersTable).values([
      { clerkUserId: `f10-dest-a-${Date.now()}`, email: `f10-dest-a-${Date.now()}@test.invalid` },
      { clerkUserId: `f10-dest-b-${Date.now()}`, email: `f10-dest-b-${Date.now()}@test.invalid` },
    ]).returning();
    tenant = a!.id; other = b!.id;
    const app = express(); app.use(express.json());
    app.use("/api", (await import("../src/routes/f10")).default);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("server unavailable");
    url = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(f10DestinationsTable).where(eq(f10DestinationsTable.tenantId, tenant));
    await db.delete(usersTable).where(eq(usersTable.id, tenant));
    await db.delete(usersTable).where(eq(usersTable.id, other));
  });
  const request = (path: string, user: string, init?: RequestInit) => fetch(`${url}${path}`, {
    ...init, headers: { "content-type": "application/json", "x-test-user-id": user, ...(init?.headers ?? {}) },
  });

  it("creates and lists a destination without returning its secret value", async () => {
    const created = await request("/api/f10/destinations", tenant, { method: "POST", body: JSON.stringify({
      name: "staging", adapterId: "https", adapterVersion: "1", endpoint: "https://example.com/ingest",
      secretRef: "F10_SECRET_STAGING", authorizationScopes: ["release:write"],
    }) });
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.secretRef).toBeUndefined();
    const listed = await request("/api/f10/destinations", tenant);
    expect(listed.status).toBe(200);
    const rows = await listed.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].secretRef).toBeUndefined();
  });

  it("revokes only the owning tenant destination", async () => {
    const [destination] = await db.select().from(f10DestinationsTable).where(eq(f10DestinationsTable.tenantId, tenant));
    const denied = await request(`/api/f10/destinations/${destination!.id}/revoke`, other, { method: "POST" });
    expect(denied.status).toBe(404);
    const revoked = await request(`/api/f10/destinations/${destination!.id}/revoke`, tenant, { method: "POST" });
    expect(revoked.status).toBe(200);
    expect((await revoked.json()).active).toBe(false);
  });

  it("does not allow a tenant to combine another tenant's artifact and destination", async () => {
    const [destination] = await db.select().from(f10DestinationsTable).where(eq(f10DestinationsTable.tenantId, tenant));
    const response = await request("/api/f10/releases", other, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId: crypto.randomUUID(),
        destinationId: destination!.id,
        releaseIntent: "cross-tenant-probe",
      }),
    });
    expect(response.status).toBe(404);
  });
});