import { describe, expect, test, beforeAll, afterAll, vi } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  osirisCalibrationsTable,
  osirisCustodiesTable,
  osirisCustodyEventsTable,
  osirisDeviationsTable,
  usersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  f9MechaRunsTable,
} from "@workspace/db";

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return {
    ...actual,
    requireAuth: async (req: Request, res: Response, next: NextFunction) => {
      const header = req.headers["x-test-user-id"];
      const userId = Array.isArray(header) ? header[0] : header;
      if (!userId) {
        res.status(401).json({ error: "test user header missing" });
        return;
      }
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) {
        res.status(401).json({ error: "test user not found" });
        return;
      }
      req.localUser = user;
      next();
    },
  };
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let ownerId = "";
let adminId = "";
let memberId = "";
let strangerId = "";
let organizationId = "";
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

async function createUser(label: string) {
  const [user] = await db
    .insert(usersTable)
    .values({ clerkUserId: `osiris-${label}-${stamp}`, email: `${label}-${stamp}@example.test` })
    .returning();
  return user!.id;
}

async function request(path: string, userId: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-test-user-id": userId, ...(init?.headers ?? {}) },
  });
}

beforeAll(async () => {
  ownerId = await createUser("owner");
  adminId = await createUser("admin");
  memberId = await createUser("member");
  strangerId = await createUser("stranger");
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: `OSIRIS ${stamp}`, slug: `osiris-${stamp}`, createdByUserId: ownerId })
    .returning();
  organizationId = org!.id;
  await db.insert(organizationMembersTable).values([
    { organizationId, userId: ownerId, role: "owner" },
    { organizationId, userId: adminId, role: "admin" },
    { organizationId, userId: memberId, role: "member" },
  ]);

  const app = express();
  app.use(express.json());
  const osirisRouter = (await import("../src/routes/osiris")).default;
  app.use("/api", osirisRouter);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await db.delete(osirisCustodiesTable).where(eq(osirisCustodiesTable.ownerUserId, ownerId));
  await db.delete(organizationMembersTable).where(eq(organizationMembersTable.organizationId, organizationId));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
  await db.execute(sql`DELETE FROM users WHERE id IN (${ownerId}, ${adminId}, ${memberId}, ${strangerId})`);
});

describe("OSIRIS custody routes", () => {
  test("registers an immutable snapshot and append-only event", async () => {
    const machineArtifactId = crypto.randomUUID();
    const payload = {
      machineArtifactId,
      sourceHash: "sha256:original",
      sourceSignature: "sig-v1",
      artifactVersion: "1.0.0",
      mediaType: "application/json",
      telemetryContract: { intervalSeconds: 60, required: ["health", "custody"] },
      expiresAt: "2030-01-01T00:00:00.000Z",
      organizationId,
    };
    const response = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(201);
    const custody = (await response.json()) as { id: string; sourceHash: string };
    expect(custody.sourceHash).toBe(payload.sourceHash);
    const detail = await request(`/api/osiris/custodies/${custody.id}`, ownerId);
    const body = (await detail.json()) as { events: Array<{ eventType: string }>; custody: { sourceSignature: string } };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]!.eventType).toBe("registered");
    expect(body.custody.sourceSignature).toBe("sig-v1");
    return { custodyId: custody.id, machineArtifactId };
  });

  test("rejects an F9 UUID custody snapshot with mismatched immutable fields", async () => {
    const [session] = await db.insert(harnessSessionsTable).values({ userId: ownerId }).returning();
    const [source] = await db.insert(harnessArtifactsTable).values({
      sessionId: session!.id, userId: ownerId, featureId: 9, artifactType: "CODEBASE_BUNDLE",
      artifactContent: {},
    }).returning();
    const [run] = await db.insert(f9MechaRunsTable).values({
      sessionId: session!.id, userId: ownerId, sourceArtifactId: source!.id,
      mechaRunId: `MECHA-TEST-${crypto.randomUUID()}`, deviceClass: "test",
      artifactVersion: "1.0.0", status: "EMITTED", payloadHash: "hash-correct",
      artifactSignature: "signature-correct", artifactContent: { machine_artifact_id: "" },
      osirisCustody: true,
    }).returning();
    const response = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId: run!.id, sourceHash: "hash-wrong", sourceSignature: "signature-correct",
        artifactVersion: "1.0.0", mediaType: "application/json", telemetryContract: {},
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    });
    expect(response.status).toBe(409);
    await db.delete(f9MechaRunsTable).where(eq(f9MechaRunsTable.id, run!.id));
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, source!.id));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, session!.id));
  });

  test("records healthy and degraded/lost telemetry with deviation and calibration lineage", async () => {
    const machineArtifactId = crypto.randomUUID();
    const response = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId,
        sourceHash: "sha256:telemetry",
        sourceSignature: "sig-telemetry",
        artifactVersion: "2.0.0",
        mediaType: "application/json",
        telemetryContract: { intervalSeconds: 30 },
        expiresAt: "2030-01-01T00:00:00.000Z",
        organizationId,
      }),
    });
    const custody = (await response.json()) as { id: string };
    const healthy = await request(`/api/osiris/custodies/${custody.id}/telemetry`, ownerId, {
      method: "POST",
      body: JSON.stringify({ health: "healthy", reason: "heartbeat received" }),
    });
    expect(healthy.status).toBe(200);
    const degraded = await request(`/api/osiris/custodies/${custody.id}/telemetry`, memberId, {
      method: "POST",
      body: JSON.stringify({
        health: "degraded",
        reason: "signature monitor mismatch",
        deviation: { severity: "high", category: "integrity", detail: "Observed signature mismatch" },
        calibration: "Re-verify upstream signing key before release",
      }),
    });
    expect(degraded.status).toBe(200);
    const detail = await request(`/api/osiris/custodies/${custody.id}`, ownerId);
    const body = (await detail.json()) as {
      custody: { sourceHash: string; custodyState: string };
      deviations: Array<{ lineage: { routedTo: string } }>;
      calibrations: Array<{ lineage: { machineArtifactId: string } }>;
    };
    expect(body.custody.sourceHash).toBe("sha256:telemetry");
    expect(body.custody.custodyState).toBe("lost");
    expect(body.deviations[0]!.lineage.routedTo).toBe("SOLVA_F0");
    expect(body.calibrations[0]!.lineage.machineArtifactId).toBe(machineArtifactId);
  });

  test("allows owner/admin recovery but forbids ordinary members", async () => {
    const machineArtifactId = crypto.randomUUID();
    const created = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId,
        sourceHash: "sha256:recover",
        sourceSignature: "sig-recover",
        artifactVersion: "1.0.0",
        mediaType: "application/json",
        telemetryContract: {},
        expiresAt: "2030-01-01T00:00:00.000Z",
        organizationId,
      }),
    });
    const custody = (await created.json()) as { id: string };
    await request(`/api/osiris/custodies/${custody.id}/telemetry`, ownerId, {
      method: "POST",
      body: JSON.stringify({ health: "degraded", custodyState: "lost", reason: "lost" }),
    });
    const forbidden = await request(`/api/osiris/custodies/${custody.id}/recover`, memberId, { method: "POST", body: "{}" });
    expect(forbidden.status).toBe(403);
    const telemetryBypass = await request(`/api/osiris/custodies/${custody.id}/telemetry`, memberId, {
      method: "POST",
      body: JSON.stringify({ health: "healthy", custodyState: "recovered", reason: "bypass" }),
    });
    expect(telemetryBypass.status).toBe(400);
    const recovered = await request(`/api/osiris/custodies/${custody.id}/recover`, adminId, { method: "POST", body: "{}" });
    expect(recovered.status).toBe(200);
    const attestation = await request(`/api/osiris/attestations/${machineArtifactId}`, adminId);
    expect(attestation.status).toBe(200);
  });

  test("denies foreign tenant detail, telemetry, recovery, and attestation", async () => {
    const machineArtifactId = crypto.randomUUID();
    const created = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId,
        sourceHash: "sha256:private",
        sourceSignature: "sig-private",
        artifactVersion: "1.0.0",
        mediaType: "application/json",
        telemetryContract: {},
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    });
    const custody = (await created.json()) as { id: string };
    expect((await request(`/api/osiris/custodies/${custody.id}`, strangerId)).status).toBe(404);
    expect((await request(`/api/osiris/custodies/${custody.id}/telemetry`, strangerId, {
      method: "POST",
      body: JSON.stringify({ health: "healthy", reason: "foreign" }),
    })).status).toBe(404);
    expect((await request(`/api/osiris/custodies/${custody.id}/recover`, strangerId, { method: "POST", body: "{}" })).status).toBe(404);
    expect((await request(`/api/osiris/attestations/${machineArtifactId}`, strangerId)).status).toBe(404);
  });

  test("persists one expiry transition and blocks expired and lost attestations", async () => {
    const machineArtifactId = crypto.randomUUID();
    const created = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId,
        sourceHash: "sha256:expiry",
        sourceSignature: "sig-expiry",
        artifactVersion: "1.0.0",
        mediaType: "application/json",
        telemetryContract: {},
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    });
    const custody = (await created.json()) as { id: string };
    await db.update(osirisCustodiesTable).set({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }).where(eq(osirisCustodiesTable.id, custody.id));
    expect((await request(`/api/osiris/attestations/${machineArtifactId}`, ownerId)).status).toBe(409);
    expect((await request(`/api/osiris/attestations/${machineArtifactId}`, ownerId)).status).toBe(409);
    const events = await db.select().from(osirisCustodyEventsTable).where(and(eq(osirisCustodyEventsTable.custodyId, custody.id), eq(osirisCustodyEventsTable.eventType, "expired")));
    expect(events).toHaveLength(1);

    const lostArtifactId = crypto.randomUUID();
    const lost = await request("/api/osiris/custodies", ownerId, {
      method: "POST",
      body: JSON.stringify({
        machineArtifactId: lostArtifactId,
        sourceHash: "sha256:lost",
        sourceSignature: "sig-lost",
        artifactVersion: "1.0.0",
        mediaType: "application/json",
        telemetryContract: {},
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    });
    const lostCustody = (await lost.json()) as { id: string };
    await request(`/api/osiris/custodies/${lostCustody.id}/telemetry`, ownerId, {
      method: "POST",
      body: JSON.stringify({ health: "degraded", custodyState: "lost", reason: "lost" }),
    });
    expect((await request(`/api/osiris/attestations/${lostArtifactId}`, ownerId)).status).toBe(409);
  });
});