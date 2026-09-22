import express, { type RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
  commandCentreSubscribersTable,
  usersTable,
  type Subscriber,
  type SubscriberTier,
  type User,
} from "@workspace/db";
import { requireTier } from "../src/lib/tier";
import { handlePddView } from "../src/engines/pdd-view";

const mocks = vi.hoisted(() => ({
  callLlmJson: vi.fn(),
}));

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return {
    ...actual,
    callLlmJson: mocks.callLlmJson,
  };
});

const PLAN_OUTPUT = {
  schemaVersion: "atlas-360-plan-v1",
  view: "PLAN",
  title: "Deterministic PLAN fixture",
  parts: Array.from({ length: 12 }, (_, part) => ({
    part,
    title: `Part ${part}`,
    content: `Fixture content ${part}`,
  })),
};

const SCAN_OUTPUT = {
  schemaVersion: "atlas-360-scan-v1",
  view: "SCAN",
  title: "Deterministic SCAN fixture",
  stages: Array.from({ length: 8 }, (_, index) => ({
    stage: index + 1,
    name: index === 0 ? "Freeze-stage Evidence Manifest" : `Stage ${index + 1}`,
    evidence: [`fixture evidence ${index + 1}`],
    assessment: `Fixture assessment ${index + 1}`,
    actions: [`Fixture action ${index + 1}`],
  })),
};

type Fixture = {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
};

function attachContext(user: User, subscriber: Subscriber): RequestHandler {
  return (req, _res, next) => {
    req.localUser = user;
    req.subscriber = subscriber;
    (req as unknown as { effectiveTier?: SubscriberTier }).effectiveTier =
      subscriber.tier;
    const noop = (): void => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      trace: noop,
      fatal: noop,
      child: () => (req as unknown as { log: unknown }).log,
    };
    next();
  };
}

function buildApp(fixture: Fixture): express.Express {
  const app = express();
  app.use(express.json());
  app.use(attachContext(fixture.user, fixture.subscriber));
  app.post(
    "/api/harness/sessions/:id/pdd-view",
    requireTier("PRACTITIONER"),
    handlePddView,
  );
  return app;
}

async function request(
  fixture: Fixture,
  path: string,
): Promise<{ status: number; body: Record<string, any> }> {
  const app = buildApp(fixture);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server failed");
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
      { method: "POST" },
    );
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function seedFixture(
  origin: "manual" | "ingested" | "cartridge",
  tier: SubscriberTier = "PRACTITIONER",
  source = true,
): Promise<Fixture> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `pdd-view-${stamp}`,
      email: `pdd-view-${stamp}@example.test`,
      displayName: "PDD View Test",
    })
    .returning();
  if (!user) throw new Error("failed to seed user");
  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: user.id, tier })
    .returning();
  if (!subscriber) throw new Error("failed to seed subscriber");
  const [session] = await db
    .insert(harnessSessionsTable)
    .values({ userId: user.id, sessionName: "PDD View Fixture", origin })
    .returning();
  if (!session) throw new Error("failed to seed session");
  if (source) {
    await db.insert(harnessArtifactsTable).values({
      sessionId: session.id,
      userId: user.id,
      featureId: origin === "ingested" ? 7 : 6,
      artifactType: origin === "ingested" ? "MVP_PDD" : "ATLAS_PDD",
      artifactContent: { title: "Source fixture", requirements: ["traceable"] },
    });
  }
  return { user, subscriber, sessionId: session.id };
}

beforeAll(() => {
  mocks.callLlmJson.mockImplementation(async (_provider: unknown, system: string) =>
    system.includes("SCAN") ? SCAN_OUTPUT : PLAN_OUTPUT,
  );
});

beforeEach(() => {
  mocks.callLlmJson.mockClear();
});

afterAll(async () => {
  // Test rows are owned by the test users and are removed explicitly so this
  // suite remains safe when replayed against the shared deterministic DB.
  await db
    .delete(usersTable)
    .where(eq(usersTable.email, "pdd-view-cleanup-never-matches@example.test"));
});

describe("ATLAS 360 PLAN/SCAN PDD views", () => {
  test("requires Practitioner tier", async () => {
    const fixture = await seedFixture("manual", "EXPLORER");
    const result = await request(fixture, `/api/harness/sessions/${fixture.sessionId}/pdd-view`);
    expect(result.status).toBe(403);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });

  test("rejects an invalid format before source generation", async () => {
    const fixture = await seedFixture("manual");
    const result = await request(
      fixture,
      `/api/harness/sessions/${fixture.sessionId}/pdd-view?format=invalid`,
    );
    expect(result.status).toBe(400);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });

  test("returns 404 for a malformed session id instead of querying PostgreSQL", async () => {
    const fixture = await seedFixture("manual");
    const result = await request(
      fixture,
      "/api/harness/sessions/not-a-uuid/pdd-view",
    );
    expect(result).toEqual({
      status: 404,
      body: { error: "Session not found" },
    });
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });

  test("uses origin defaults and honors an explicit format override", async () => {
    const manual = await seedFixture("manual");
    const ingested = await seedFixture("ingested");
    const manualDefault = await request(
      manual,
      `/api/harness/sessions/${manual.sessionId}/pdd-view`,
    );
    const ingestedDefault = await request(
      ingested,
      `/api/harness/sessions/${ingested.sessionId}/pdd-view`,
    );
    const overridden = await request(
      manual,
      `/api/harness/sessions/${manual.sessionId}/pdd-view?format=scan`,
    );
    expect(manualDefault.body.view).toBe("PLAN");
    expect(ingestedDefault.body.view).toBe("SCAN");
    expect(overridden.body.view).toBe("SCAN");
  });

  test("returns 404 for missing source and for a session owned by another user", async () => {
    const missing = await seedFixture("manual", "PRACTITIONER", false);
    const missingResult = await request(
      missing,
      `/api/harness/sessions/${missing.sessionId}/pdd-view`,
    );
    expect(missingResult.status).toBe(404);

    const owner = await seedFixture("manual");
    const stranger = await seedFixture("manual");
    const strangerResult = await request(
      { ...stranger, sessionId: owner.sessionId },
      `/api/harness/sessions/${owner.sessionId}/pdd-view`,
    );
    expect(strangerResult.status).toBe(404);
  });

  test("PLAN always discloses certification status and mandatory Parts 10/11", async () => {
    const fixture = await seedFixture("manual");
    const result = await request(
      fixture,
      `/api/harness/sessions/${fixture.sessionId}/pdd-view?format=plan`,
    );
    expect(result.status).toBe(200);
    expect(result.body.disclosure).toContain("WITHHELD/self-declared uncertified");
    expect(result.body.parts).toHaveLength(12);
    expect(result.body.parts[10]).toMatchObject({
      part: 10,
      title: "Security & Governance",
    });
    expect(result.body.parts[11]).toMatchObject({
      part: 11,
      title: "Regulatory Conformity",
    });
    const [saved] = await db
      .select()
      .from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.id, result.body.artifactId))
      .limit(1);
    expect(saved?.artifactType).toBe("ATLAS_360_PLAN_VIEW");
    expect(saved?.artifactContent).toMatchObject({
      sourceArtifactId: result.body.sourceArtifactId,
      sourceArtifactType: "ATLAS_PDD",
      disclosure: result.body.disclosure,
    });
  });

  test("SCAN starts with Freeze evidence, links optional evidence, and persists source linkage", async () => {
    const fixture = await seedFixture("ingested");
    const [bundle] = await db
      .insert(harnessArtifactsTable)
      .values({
        sessionId: fixture.sessionId,
        userId: fixture.user.id,
        featureId: 8,
        artifactType: "CODEBASE_BUNDLE",
        artifactContent: { files: ["README.md"] },
      })
      .returning();
    const [pfp] = await db
      .insert(harnessArtifactsTable)
      .values({
        sessionId: fixture.sessionId,
        userId: fixture.user.id,
        featureId: 8,
        artifactType: "PFP_REPORT",
        artifactContent: { verdict: "pass", findings: [] },
      })
      .returning();
    const result = await request(
      fixture,
      `/api/harness/sessions/${fixture.sessionId}/pdd-view?format=scan`,
    );
    expect(result.status).toBe(200);
    expect(result.body.stages[0]).toMatchObject({
      stage: 1,
      name: "Freeze-stage Evidence Manifest",
    });
    expect(result.body.sourceCodebaseBundleArtifactId).toBe(bundle!.id);
    expect(result.body.sourcePfpReportArtifactId).toBe(pfp!.id);

    const [saved] = await db
      .select()
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.id, result.body.artifactId),
          eq(harnessArtifactsTable.userId, fixture.user.id),
        ),
      )
      .limit(1);
    expect(saved?.artifactType).toBe("ATLAS_360_SCAN_VIEW");
    expect(saved?.artifactContent).toMatchObject({
      sourceArtifactId: result.body.sourceArtifactId,
      sourceCodebaseBundleArtifactId: bundle!.id,
      sourcePfpReportArtifactId: pfp!.id,
    });
  });
});