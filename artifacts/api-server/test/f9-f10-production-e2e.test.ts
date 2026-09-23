import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  commandCentreSubscribersTable,
  db,
  f10AttemptsTable,
  f10DestinationsTable,
  f10ReceiptsTable,
  f10ReleaseRequestsTable,
  f10ReleaseTransitionsTable,
  f9MechaRunsTable,
  harnessArtifactsTable,
  harnessSessionsTable,
  osirisCustodiesTable,
  usersTable,
} from "@workspace/db";
import { createF10CustodyProvider, createF10ProductionStore } from "../src/lib/f10-production";
import { F10ReleaseService } from "../src/lib/f10-service";

const requireAuthMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: requireAuthMock };
});

process.env.SESSION_SECRET ??= `f9-f10-e2e-${randomUUID()}`;
process.env.F10_RECEIPT_SIGNING_SECRET ??= `f10-receipt-${randomUUID()}`;

const phases = [
  { phase: 1, evidence: { target_profile: "FIRMWARE_MCU", cardinality: "SINGLE", interlock_present: true, regulatory_regimes_named: ["IEC 60730"], platform_allocation: [{ target: "MCU", language: "C", framework: "bare-metal" }] } },
  { phase: 2, evidence: { candidates: [{ name: "cutout", layer: "L5", evidence_tier: "HIGH" }] } },
  { phase: 3, evidence: { hazard_class: "NON_SAFETY_RELATED", lane: "SWITCH" } },
  { phase: 4, evidence: { fail_safe_default: "OPEN_CIRCUIT", architecture_complete: true, control_path_has_llm: false, icd: { input: "temperature", output: "relay" } } },
  { phase: 5, evidence: { mm_verdict: "MATH_VERIFIED", ares: { a: "PASS", b: "PASS", c: "PASS" }, fail_safe_reached: true } },
  { phase: 6, evidence: { hold_ip: false, savant_verdict: "FIT", ucg: { jcse_score: 40, self_adjudicated: false, author_id: "author", scorer_id: "scorer", adjudicator_id: "adjudicator" } } },
  { phase: 7, evidence: { pce: { coverage_pct: 100, orphans: 0, ares_scan: "CLEAN" }, osiris_custody: true, reverification_due: "2099-01-01T00:00:00.000Z", spk: { constraint_fingerprint: {}, gro_colonization_record: {}, mm_package: {}, ucg_certificate: {}, fail_safe_declaration: {}, icd: {}, traceability_map: {} } } },
] as const;

describe("F9 to OSIRIS to F10 production path", () => {
  let server: ReturnType<typeof express.prototype.listen>;
  let tenantId = "", sessionId = "", sourceArtifactId = "", artifactId = "", releaseId = "";

  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({ clerkUserId: `f9-f10-${randomUUID()}`, email: `f9-f10-${randomUUID()}@test.invalid` }).returning();
    tenantId = user!.id;
    const [subscriber] = await db.insert(commandCentreSubscribersTable).values({ userId: tenantId, tier: "ARCHITECT", status: "active" }).returning();
    const [session] = await db.insert(harnessSessionsTable).values({ userId: tenantId, sessionName: "F9/F10 production path" }).returning();
    sessionId = session!.id;
    const [mvp] = await db.insert(harnessArtifactsTable).values({ sessionId, userId: tenantId, featureId: 7, artifactType: "MVP_PDD", artifactContent: {}, spartanCert: { verdict: "PASS" } }).returning();
    const [bundle] = await db.insert(harnessArtifactsTable).values({ sessionId, userId: tenantId, featureId: 8, artifactType: "CODEBASE_BUNDLE", artifactContent: { sourceMvpPddArtifactId: mvp!.id } }).returning();
    sourceArtifactId = bundle!.id;
    requireAuthMock.mockImplementation(async (req: Request, res: Response, next: NextFunction) => {
      req.localUser = user!;
      req.subscriber = subscriber!;
      req.effectiveTier = "ARCHITECT";
      next();
    });
    const app = express();
    app.use(express.json());
    app.use("/api", (await import("../src/routes/harness")).default);
    app.use("/api", (await import("../src/routes/osiris")).default);
    app.use("/api", (await import("../src/routes/f10")).default);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (releaseId) {
      await db.delete(f10ReceiptsTable).where(eq(f10ReceiptsTable.releaseId, releaseId));
      await db.delete(f10AttemptsTable).where(eq(f10AttemptsTable.releaseId, releaseId));
      await db.delete(f10ReleaseTransitionsTable).where(eq(f10ReleaseTransitionsTable.releaseId, releaseId));
      await db.delete(f10ReleaseRequestsTable).where(eq(f10ReleaseRequestsTable.id, releaseId));
    }
    if (artifactId) await db.delete(osirisCustodiesTable).where(eq(osirisCustodiesTable.machineArtifactId, artifactId));
    if (sessionId) {
      await db.delete(f9MechaRunsTable).where(eq(f9MechaRunsTable.sessionId, sessionId));
      await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId));
      await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    }
    if (tenantId) {
      await db.delete(f10DestinationsTable).where(eq(f10DestinationsTable.tenantId, tenantId));
      await db.delete(commandCentreSubscribersTable).where(eq(commandCentreSubscribersTable.userId, tenantId));
      await db.delete(usersTable).where(eq(usersTable.id, tenantId));
    }
  });

  const request = (path: string, init: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server unavailable");
    return fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  };

  it("emits F9, registers exact OSIRIS custody, and acknowledges through production F10", async () => {
    const emittedResponse = await request("/api/harness/f9", { method: "POST", body: JSON.stringify({ sessionId, sourceArtifactId, deviceClass: "controller", hardwareConfigId: "INDUSTRIAL_MCU", artifactVersion: "1.0.0", phases }) });
    const artifact = await emittedResponse.json() as Record<string, any>;
    expect(emittedResponse.status, JSON.stringify(artifact)).toBe(201);
    expect(artifact.ucg_certificate.verdict).toBe("THRESHOLD_PASS");
    artifactId = artifact.machine_artifact_id;

    const custodyResponse = await request("/api/osiris/custodies", { method: "POST", body: JSON.stringify({
      machineArtifactId: artifactId, sourceHash: artifact.payload_hash, sourceSignature: artifact.artifact_signature,
      artifactVersion: artifact.artifact_version, mediaType: "application/json", telemetryContract: {},
      expiresAt: "2099-01-01T00:00:00.000Z",
    }) });
    expect(custodyResponse.status).toBe(201);

    const destinationResponse = await request("/api/f10/destinations", { method: "POST", body: JSON.stringify({
      name: "production-test", adapterId: "https", adapterVersion: "1", endpoint: "https://example.com/ingest",
      secretRef: "F10_SECRET_E2E", authorizationScopes: ["release:write"],
    }) });
    expect(destinationResponse.status).toBe(201);
    const destination = await destinationResponse.json() as { id: string };
    const releaseResponse = await request("/api/f10/releases", { method: "POST", body: JSON.stringify({ machineArtifactId: artifactId, destinationId: destination.id, releaseIntent: "production-e2e", sessionId }) });
    expect(releaseResponse.status).toBe(201);
    const release = await releaseResponse.json() as { id: string };
    releaseId = release.id;

    const adapter = {
      validate: vi.fn(async () => undefined),
      deliver: vi.fn(async () => ({ accepted: true, downstreamReceiptId: "downstream-e2e-1" })),
      classify: () => "permanent" as const,
      health: async () => "available" as const,
    };
    const service = new F10ReleaseService({
      store: createF10ProductionStore(),
      custody: createF10CustodyProvider(tenantId, artifactId),
      adapters: new Map([["https", adapter]]),
      secret: { get: async () => "test-secret" },
      signingSecret: process.env.F10_RECEIPT_SIGNING_SECRET!,
    });
    const result = await service.process(releaseId, tenantId);
    expect(result.state).toBe("ACKNOWLEDGED");
    expect(adapter.deliver).toHaveBeenCalledTimes(1);

    const [persisted] = await db.select().from(f10ReleaseRequestsTable).where(eq(f10ReleaseRequestsTable.id, releaseId));
    const attempts = await db.select().from(f10AttemptsTable).where(eq(f10AttemptsTable.releaseId, releaseId));
    const receipts = await db.select().from(f10ReceiptsTable).where(eq(f10ReceiptsTable.releaseId, releaseId));
    const transitions = await db.select().from(f10ReleaseTransitionsTable).where(eq(f10ReleaseTransitionsTable.releaseId, releaseId));
    expect(persisted?.state).toBe("ACKNOWLEDGED");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.state).toBe("ACKNOWLEDGED");
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.downstreamReceiptId).toBe("downstream-e2e-1");
    expect(transitions.map((t) => t.toState)).toEqual(expect.arrayContaining(["DISPATCHING", "ACKNOWLEDGED"]));
  });
});