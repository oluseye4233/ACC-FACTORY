import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  codeBundleVerificationEvidenceTable,
  db,
  harnessArtifactsTable,
  harnessSessionsTable,
  usersTable,
} from "@workspace/db";

const requireAuthMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: requireAuthMock };
});

import f8VerificationRoutes from "../src/routes/f8-verification";

describe("F8 code bundle verification", () => {
  let owner: typeof usersTable.$inferSelect | null = null;
  let otherUser: typeof usersTable.$inferSelect | null = null;
  let server: ReturnType<typeof express.prototype.listen> | undefined;

  beforeAll(async () => {
    const [ownerRow] = await db.insert(usersTable).values({
      clerkUserId: `f8-verification-owner-${randomUUID()}`,
      email: `f8-verification-${randomUUID()}@example.test`,
    }).returning();
    const [otherRow] = await db.insert(usersTable).values({
      clerkUserId: `f8-verification-other-${randomUUID()}`,
      email: `f8-verification-other-${randomUUID()}@example.test`,
    }).returning();
    owner = ownerRow!;
    otherUser = otherRow!;

    requireAuthMock.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      const authenticated =
        req.headers.authorization === "Bearer other" ? otherUser : owner;
      if (!authenticated) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      req.localUser = authenticated;
      next();
    });

    const app = express();
    app.use(express.json());
    app.use("/api", f8VerificationRoutes);
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    const userIds = [owner?.id, otherUser?.id].filter((id): id is string => Boolean(id));
    if (userIds.length > 0) {
      await db.delete(codeBundleVerificationEvidenceTable)
        .where(inArray(codeBundleVerificationEvidenceTable.userId, userIds));
      await db.delete(harnessArtifactsTable)
        .where(inArray(harnessArtifactsTable.userId, userIds));
      await db.delete(harnessSessionsTable)
        .where(inArray(harnessSessionsTable.userId, userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
  });

  async function createBundle() {
    const [session] = await db.insert(harnessSessionsTable).values({
      userId: owner!.id,
      sessionName: `F8 verification ${randomUUID()}`,
    }).returning();
    const [bundle] = await db.insert(harnessArtifactsTable).values({
      sessionId: session!.id,
      userId: owner!.id,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      name: "Unverified test scaffold",
      artifactContent: { files: [{ path: "src/index.ts", content: "export {};" }] },
    }).returning();
    return bundle!;
  }

  function baseUrl() {
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("Test server is not listening");
    return `http://127.0.0.1:${address.port}/api`;
  }

  async function request(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    authorization = "Bearer owner",
  ) {
    return fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        authorization,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it("requires passing evidence and creates one immutable verified child", async () => {
    const bundle = await createBundle();
    const evidencePath = `/harness/f8/${bundle.id}/verification-evidence`;

    const noEvidence = await request(`/harness/f8/${bundle.id}/verify`, "POST", {});
    expect(noEvidence.status).toBe(409);
    await expect(noEvidence.json()).resolves.toMatchObject({
      code: "CODE_BUNDLE_EVIDENCE_REQUIRED",
    });

    const rejectedEvidence = await request(evidencePath, "POST", {
      evidenceKind: "CI",
      passed: false,
      runReference: "https://ci.example.test/run/1",
      command: "pnpm test",
      summary: "Failed test run",
    });
    expect(rejectedEvidence.status).toBe(400);

    const recorded = await request(evidencePath, "POST", {
      evidenceKind: "CI",
      passed: true,
      runReference: "https://ci.example.test/run/2",
      command: "pnpm test",
      summary: "All required checks passed.",
    });
    expect(recorded.status).toBe(201);
    const evidence = await recorded.json() as { id: string; evidenceHash: string };
    expect(evidence.evidenceHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const finalized = await request(`/harness/f8/${bundle.id}/verify`, "POST", {});
    expect(finalized.status).toBe(200);
    const result = await finalized.json() as {
      sourceArtifactId: string;
      verifiedArtifactId: string;
      status: string;
      contentHash: string;
      evidenceHash: string;
      evidence: Array<{ id: string }>;
    };
    expect(result).toMatchObject({
      sourceArtifactId: bundle.id,
      status: "VERIFIED",
      evidence: [{ id: evidence.id }],
    });
    expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.evidenceHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const [unchangedSource] = await db.select().from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.id, bundle.id)).limit(1);
    const [verifiedChild] = await db.select().from(harnessArtifactsTable)
      .where(and(
        eq(harnessArtifactsTable.id, result.verifiedArtifactId),
        eq(harnessArtifactsTable.parentArtifactId, bundle.id),
      )).limit(1);
    expect(unchangedSource).toMatchObject({
      artifactType: "CODEBASE_BUNDLE",
      verificationStatus: "UNVERIFIED",
      parentArtifactId: null,
    });
    expect(verifiedChild).toMatchObject({
      artifactType: "VERIFIED_CODEBASE_BUNDLE",
      verificationStatus: "VERIFIED",
      contentHash: result.contentHash,
      verificationEvidenceHash: result.evidenceHash,
    });

    const repeated = await request(`/harness/f8/${bundle.id}/verify`, "POST", {});
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({
      verifiedArtifactId: result.verifiedArtifactId,
    });
    const children = await db.select().from(harnessArtifactsTable)
      .where(eq(harnessArtifactsTable.parentArtifactId, bundle.id));
    expect(children).toHaveLength(1);
  });

  it("keeps evidence private to the source owner and accepts only F8 code bundles", async () => {
    const bundle = await createBundle();
    const privateRead = await request(
      `/harness/f8/${bundle.id}/verification-evidence`,
      "GET",
      undefined,
      "Bearer other",
    );
    expect(privateRead.status).toBe(404);

    const privateWrite = await request(
      `/harness/f8/${bundle.id}/verification-evidence`,
      "POST",
      {
        evidenceKind: "IDE_TEST",
        passed: true,
        runReference: "workspace-123",
        command: "npm test",
        summary: "All tests passed.",
      },
      "Bearer other",
    );
    expect(privateWrite.status).toBe(404);

    const [session] = await db.insert(harnessSessionsTable).values({
      userId: owner!.id,
      sessionName: `F8 non-code artifact ${randomUUID()}`,
    }).returning();
    const [spc] = await db.insert(harnessArtifactsTable).values({
      sessionId: session!.id,
      userId: owner!.id,
      featureId: 5,
      artifactType: "SPC",
      artifactContent: {},
    }).returning();
    const wrongType = await request(
      `/harness/f8/${spc!.id}/verification-evidence`,
      "GET",
    );
    expect(wrongType.status).toBe(404);
  });
});