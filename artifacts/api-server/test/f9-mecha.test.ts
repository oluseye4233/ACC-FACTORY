import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  commandCentreSubscribersTable,
  db,
  f9MechaRunsTable,
  harnessArtifactsTable,
  harnessSessionsTable,
  usersTable,
} from "@workspace/db";
import { deriveF9Identity, evaluate } from "../src/engines/f9mecha";

const requireAuthMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: requireAuthMock };
});

process.env.SESSION_SECRET ??= `f9-mecha-${randomUUID()}`;

const phases = Array.from({ length: 7 }, (_, i) => ({ phase: i + 1, evidence: {} as Record<string, unknown> }));
const passingPhases = [
  { phase: 1, evidence: { target_profile: "FIRMWARE_MCU", cardinality: "SINGLE", interlock_present: true, regulatory_regimes_named: ["IEC 60730"], platform_allocation: [{ target: "MCU", language: "C", framework: "bare-metal" }] } },
  { phase: 2, evidence: { candidates: [{ name: "cutout", layer: "L5", evidence_tier: "HIGH" }] } },
  { phase: 3, evidence: { hazard_class: "NON_SAFETY_RELATED", lane: "SWITCH" } },
  { phase: 4, evidence: { fail_safe_default: "OPEN_CIRCUIT", architecture_complete: true, control_path_has_llm: false, icd: { input: "temperature", output: "relay" } } },
  { phase: 5, evidence: { mm_verdict: "MATH_VERIFIED", ares: { a: "PASS", b: "PASS", c: "PASS" }, fail_safe_reached: true } },
  { phase: 6, evidence: { hold_ip: false, savant_verdict: "FIT", ucg: { jcse_score: 40, self_adjudicated: false, author_id: "author", scorer_id: "scorer", adjudicator_id: "adjudicator" } } },
  { phase: 7, evidence: { pce: { coverage_pct: 100, orphans: 0, ares_scan: "CLEAN" }, osiris_custody: true, reverification_due: "2099-01-01T00:00:00.000Z", spk: { constraint_fingerprint: {}, gro_colonization_record: {}, mm_package: {}, ucg_certificate: {}, fail_safe_declaration: {}, icd: {}, traceability_map: {} } } },
];

describe("F9 MECHA deterministic gate orchestration", () => {
  it("derives a stable identity from canonical evidence and changes it when evidence changes", () => {
  let sourceArtifactId = "";
    const left = [{ phase: 1, evidence: { beta: 2, alpha: { y: true, x: false } } }];
    const reordered = [{ phase: 1, evidence: { alpha: { x: false, y: true }, beta: 2 } }];
    const changed = [{ phase: 1, evidence: { alpha: { x: false, y: true }, beta: 3 } }];

    expect(deriveF9Identity(sourceArtifactId, "1.0.0", left))
      .toEqual(deriveF9Identity(sourceArtifactId, "1.0.0", reordered));
    expect(deriveF9Identity(sourceArtifactId, "1.0.0", left).idempotencyKey)
      .not.toBe(deriveF9Identity(sourceArtifactId, "1.0.0", changed).idempotencyKey);
    expect(deriveF9Identity(sourceArtifactId, "1.0.0", left).idempotencyKey)
      .not.toBe(deriveF9Identity(sourceArtifactId, "1.0.1", left).idempotencyKey);
  });

  it("refuses a non-ordered run with a cited invariant", () => {
    const input = phases.map((p) => ({ ...p, evidence: { ...p.evidence } }));
    [input[0], input[1]] = [input[1]!, input[0]!];
    const result = evaluate("MECHA-F9-test", input);
    expect(result.verdict).toBe("REFUSED");
    if (result.verdict === "REFUSED") expect(result.phase_halted).toBe(1);
  });

  it("does not override a safety-related external verdict", () => {
    const input = phases.map((p) => ({ ...p, evidence: { ...p.evidence } }));
    const result = evaluate("MECHA-F9-test", input);
    expect(result.verdict).toBe("REFUSED");
    if (result.verdict === "REFUSED") expect(result.phase_halted).toBe(1);
  });

  it("does not override a safety-related external verdict", () => {
    const input = phases.map((p) => ({ ...p, evidence: { ...p.evidence } }));
    input[0].evidence = { target_profile: "FIRMWARE_MCU", cardinality: "SINGLE", interlock_present: true, regulatory_regimes_named: [], platform_allocation: [] };
    input[1].evidence = { candidates: [] };
    input[2].evidence = { hazard_class: "SAFETY_RELATED", lane: "SYSTEM" };
    const result = evaluate("MECHA-F9-test", input);
    expect(result.verdict).toBe("REFUSED");
    if (result.verdict === "REFUSED") expect(result.constraint_cited).toBe("C-MECHA-02");
  });

  it("emits only after the complete immutable gate record passes", () => {
    expect(evaluate("MECHA-F9-test", passingPhases).verdict).toBe("EMITTED");
  });
});

function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const noop = (): void => {};
  (req as Request & { log: Record<string, unknown> }).log = {
    info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop,
    child: () => (req as Request & { log: unknown }).log,
  };
  next();
}

async function startApp(): Promise<{ url: string; close: () => Promise<void> }> {
  const router = (await import("../src/routes/harness")).default;
  const app: Express = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use("/api", router);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("F9 authenticated operator flow", () => {
  let server: Awaited<ReturnType<typeof startApp>>;
  let userId = "";
  let otherUserId = "";
  let sessionId = "";
  let otherSessionId = "";
  let sourceArtifactId = "";
  let otherSourceArtifactId = "";
  let otherMvpArtifactId = "";

  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({
      clerkUserId: `f9-test-${randomUUID()}`,
      email: `f9-${randomUUID()}@example.test`,
    }).returning();
    userId = user!.id;
    const [subscriber] = await db.insert(commandCentreSubscribersTable).values({
      userId,
      tier: "ARCHITECT",
      status: "active",
    }).returning();
    const [session] = await db.insert(harnessSessionsTable).values({
      userId,
      sessionName: "F9 full operator flow",
    }).returning();
    sessionId = session!.id;
    const [mvp] = await db.insert(harnessArtifactsTable).values({
      sessionId,
      userId,
      featureId: 7,
      artifactType: "MVP_PDD",
      artifactContent: { title: "Certified upstream design" },
      spartanCert: { verdict: "PASS" },
    }).returning();
    const [bundle] = await db.insert(harnessArtifactsTable).values({
      sessionId,
      userId,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { sourceMvpPddArtifactId: mvp!.id },
    }).returning();
    sourceArtifactId = bundle!.id;
    const [otherUser] = await db.insert(usersTable).values({
      clerkUserId: `f9-other-${randomUUID()}`,
      email: `f9-other-${randomUUID()}@example.test`,
    }).returning();
    otherUserId = otherUser!.id;
    const [otherSubscriber] = await db.insert(commandCentreSubscribersTable).values({
      userId: otherUserId,
      tier: "ARCHITECT",
      status: "active",
    }).returning();
    const [otherSession] = await db.insert(harnessSessionsTable).values({
      userId: otherUserId,
      sessionName: "Other operator F9 flow",
    }).returning();
    otherSessionId = otherSession!.id;
    const [otherMvp] = await db.insert(harnessArtifactsTable).values({
      sessionId: otherSessionId,
      userId: otherUserId,
      featureId: 7,
      artifactType: "MVP_PDD",
      artifactContent: { title: "Other certified upstream design" },
      spartanCert: { verdict: "PASS" },
    }).returning();
    otherMvpArtifactId = otherMvp!.id;
    const [otherBundle] = await db.insert(harnessArtifactsTable).values({
      sessionId: otherSessionId,
      userId: otherUserId,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { sourceMvpPddArtifactId: otherMvp!.id },
    }).returning();
    otherSourceArtifactId = otherBundle!.id;
    requireAuthMock.mockImplementation(async (req: Request, res: Response, next: NextFunction) => {
      const identity = req.headers.authorization === "Bearer f9-integration"
        ? { user, subscriber }
        : req.headers.authorization === "Bearer f9-other"
          ? { user: otherUser, subscriber: otherSubscriber }
          : null;
      if (!identity) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      req.localUser = identity.user!;
      req.subscriber = identity.subscriber!;
      req.effectiveTier = "ARCHITECT";
      next();
    });
    server = await startApp();
  });

  afterAll(async () => {
    await server?.close();
    if (sessionId) {
      await db.delete(f9MechaRunsTable).where(eq(f9MechaRunsTable.sessionId, sessionId));
      await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId));
      await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    }
    if (otherSessionId) {
      await db.delete(f9MechaRunsTable).where(eq(f9MechaRunsTable.sessionId, otherSessionId));
      await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, otherSessionId));
      await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, otherSessionId));
    }
    if (userId) {
      await db.delete(commandCentreSubscribersTable).where(eq(commandCentreSubscribersTable.userId, userId));
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
    if (otherUserId) {
      await db.delete(commandCentreSubscribersTable).where(eq(commandCentreSubscribersTable.userId, otherUserId));
      await db.delete(usersTable).where(eq(usersTable.id, otherUserId));
    }
  });

  const request = (path: string, init: RequestInit = {}, token = "f9-integration") => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(`${server.url}${path}`, { ...init, headers });
  };

    const create = (
      requestedSessionId: string,
      requestedSourceArtifactId: string,
      token = "f9-integration",
    ) => request("/api/harness/f9", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: requestedSessionId,
        sourceArtifactId: requestedSourceArtifactId,
        deviceClass: `ownership-boundary-${randomUUID()}`,
        hardwareConfigId: "INDUSTRIAL_MCU",
        artifactVersion: "9.9.9",
        phases: passingPhases,
      }),
    }, token);

  it("returns a clean client error when the runs sessionId is missing or malformed", async () => {
    const missingResponse = await request("/api/harness/f9/runs");
    expect(missingResponse.status).toBe(400);
    await expect(missingResponse.json()).resolves.toEqual({
      error: "sessionId query param required",
    });

    const malformedResponse = await request("/api/harness/f9/runs?sessionId=not-a-uuid");
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({
      error: "sessionId query param must be a valid UUID",
    });
  });

  it("persists a cited refusal and one signed artifact, then reloads both through the runs endpoint", async () => {
    const refusedPhases = passingPhases.map((phase) => ({
      ...phase,
      evidence: { ...phase.evidence },
    }));
    refusedPhases[2]!.evidence = { hazard_class: "SAFETY_RELATED", lane: "SYSTEM" };
    const base = {
      sessionId,
      sourceArtifactId,
      deviceClass: "cold-chain compressor controller",
      hardwareConfigId: "INDUSTRIAL_MCU",
      artifactVersion: "1.0.0",
    };

    const refusedResponse = await request("/api/harness/f9", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...base, phases: refusedPhases }),
    });
    const refusal = (await refusedResponse.json()) as Record<string, unknown>;
    expect(refusedResponse.status, JSON.stringify(refusal)).toBe(422);
    expect(refusal).toMatchObject({
      verdict: "REFUSED",
      phase_halted: 3,
      constraint_cited: "C-MECHA-02",
      invariant_cited: "SPARTAN #21",
    });

    const emittedResponse = await request("/api/harness/f9", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...base, phases: passingPhases }),
    });
    const artifact = (await emittedResponse.json()) as Record<string, unknown>;
    expect(emittedResponse.status, JSON.stringify(artifact)).toBe(201);
    expect(artifact).toMatchObject({
      mecha_run_id: expect.stringMatching(/^MECHA-F9-/),
      machine_artifact_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      ),
      payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      artifact_signature: expect.any(String),
      osiris_custody: true,
      ucg_certificate: expect.objectContaining({
        verdict: "THRESHOLD_PASS",
        threshold: 38,
      }),
    });

    const reloadResponse = await request(`/api/harness/f9/runs?sessionId=${sessionId}`);
    const reloaded = (await reloadResponse.json()) as Array<Record<string, unknown>>;
    expect(reloadResponse.status).toBe(200);
    expect(reloaded).toHaveLength(2);
    expect(reloaded.find((run) => run.status === "EMITTED")).toMatchObject({
      mechaRunId: artifact.mecha_run_id,
      phase: 7,
      payloadHash: artifact.payload_hash,
      artifactSignature: artifact.artifact_signature,
      artifactContent: artifact,
      osirisCustody: true,
    });
    expect(reloaded.find((run) => run.status === "REFUSED")).toMatchObject({
      mechaRunId: refusal.mecha_run_id,
      phase: 3,
      refusal: {
        constraint_cited: "C-MECHA-02",
        invariant_cited: "SPARTAN #21",
      },
    });
  });

  it("returns only the signed artifacts and refusal evidence owned by the authenticated operator", async () => {
    const ownRunId = `MECHA-F9-${randomUUID()}`;
    const otherRunId = `MECHA-F9-${randomUUID()}`;
    await db.insert(f9MechaRunsTable).values([
      {
        mechaRunId: ownRunId,
        sessionId,
        userId,
        sourceArtifactId,
        status: "REFUSED",
        deviceClass: "operator-one-device",
        phase: 3,
        refusal: { constraint_cited: "C-MECHA-02", privateEvidence: "operator-one" },
      },
      {
        mechaRunId: otherRunId,
        sessionId: otherSessionId,
        userId: otherUserId,
        sourceArtifactId: otherSourceArtifactId,
        status: "EMITTED",
        deviceClass: "operator-two-device",
        phase: 7,
        artifactContent: { machine_artifact_id: "MA-private-operator-two" },
        artifactSignature: "private-signature",
        osirisCustody: true,
      },
    ]);

    const ownResponse = await request(`/api/harness/f9/runs?sessionId=${sessionId}`);

    const ownRuns = (await ownResponse.json()) as Array<{ mechaRunId: string }>;
    expect(ownResponse.status).toBe(200);
    expect(ownRuns.some((run) => run.mechaRunId === ownRunId)).toBe(true);
    expect(ownRuns.some((run) => run.mechaRunId === otherRunId)).toBe(false);

    const otherResponse = await request(
      `/api/harness/f9/runs?sessionId=${otherSessionId}`,
      {},
      "f9-other",
    );
    const otherRuns = (await otherResponse.json()) as Array<{ mechaRunId: string }>;
    expect(otherResponse.status).toBe(200);
    expect(otherRuns.map((run) => run.mechaRunId)).toEqual([otherRunId]);

    const crossUserResponse = await request(
      `/api/harness/f9/runs?sessionId=${otherSessionId}`,
    );
    expect(crossUserResponse.status).toBe(404);
    await expect(crossUserResponse.json()).resolves.toEqual({ error: "Session not found" });

    const reverseCrossUserResponse = await request(
      `/api/harness/f9/runs?sessionId=${sessionId}`,
      {},
      "f9-other",
    );
    expect(reverseCrossUserResponse.status).toBe(404);
    await expect(reverseCrossUserResponse.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("rejects an owned F8 bundle whose MVP PDD lineage belongs to another operator without creating a run", async () => {
    const ownResponse = await create(sessionId, sourceArtifactId);
    const ownRun = (await ownResponse.json()) as { mecha_run_id?: string };
    expect(ownResponse.status, JSON.stringify(ownRun)).toBe(201);
    expect(ownRun.mecha_run_id).toMatch(/^MECHA-F9-/);

    const otherOwnResponse = await create(
      otherSessionId,
      otherSourceArtifactId,
      "f9-other",
    );
    const otherOwnRun = (await otherOwnResponse.json()) as { mecha_run_id?: string };
    expect(otherOwnResponse.status, JSON.stringify(otherOwnRun)).toBe(201);
    expect(otherOwnRun.mecha_run_id).toMatch(/^MECHA-F9-/);

    const [crossOwnerBundle] = await db.insert(harnessArtifactsTable).values({
      sessionId,
      userId,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { sourceMvpPddArtifactId: otherMvpArtifactId },
    }).returning();

    const rowsBeforeRejectedRequest = await db
      .select()
      .from(f9MechaRunsTable)
      .where(inArray(f9MechaRunsTable.userId, [userId, otherUserId]));

    const crossOwnerLineageResponse = await create(sessionId, crossOwnerBundle!.id);
    expect(crossOwnerLineageResponse.status).toBe(409);
    await expect(crossOwnerLineageResponse.json()).resolves.toEqual({
      error: "Upstream MVP PDD is not SPARTAN-certified",
    });

    const rowsAfterRejectedRequest = await db
      .select()
      .from(f9MechaRunsTable)
      .where(inArray(f9MechaRunsTable.userId, [userId, otherUserId]));
    expect(rowsAfterRejectedRequest.map((row) => row.id).sort())
      .toEqual(rowsBeforeRejectedRequest.map((row) => row.id).sort());
  });
});
