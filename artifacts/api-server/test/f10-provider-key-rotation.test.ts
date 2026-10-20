import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  db,
  f10BundleDeploymentAttemptsTable,
  f10BundleDeploymentAuditTable,
  f10BundleDeploymentReceiptsTable,
  f10BundleDeploymentsTable,
  f10ProviderConnectionsTable,
  harnessArtifactsTable,
  harnessSessionsTable,
  usersTable,
} from "@workspace/db";
import { buildExport } from "../src/lib/f10-export";
import { openAuthorizationRef, sealAuthorizationRef } from "../src/lib/f10-provider";

const requireAuthMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireAuth: requireAuthMock };
});

const key = (fill: number) => Buffer.alloc(32, fill).toString("base64url");
const currentKey = { version: "rotation-current", secret: key(21) };
const previousKey = { version: "rotation-previous", secret: key(22) };
process.env.F10_PROVIDER_AUTHORIZATION_KEY_VERSION = currentKey.version;
process.env.F10_PROVIDER_AUTHORIZATION_KEY = currentKey.secret;
process.env.F10_PROVIDER_AUTHORIZATION_PREVIOUS_KEY_VERSION = previousKey.version;
process.env.F10_PROVIDER_AUTHORIZATION_PREVIOUS_KEY = previousKey.secret;
process.env.F10_PROVIDER_BROKER_TOKEN = "test-broker-token";
process.env.F10_RECEIPT_SIGNING_SECRET = key(23);

describe("F10 provider authorization key rotation route", () => {
  let apiServer: ReturnType<typeof express.prototype.listen>;
  let brokerServer: ReturnType<typeof express.prototype.listen>;
  let apiUrl = "";
  let tenantId = "";
  let sessionId = "";
  let source: typeof harnessArtifactsTable.$inferSelect;

  beforeAll(async () => {
    const broker = express();
    broker.use(express.json({ limit: "30mb" }));
    broker.post("/v1/bundle-deployments", (_req, res) => res.json({ accepted: true, receipt_id: "rotation-receipt" }));
    brokerServer = broker.listen(0);
    await new Promise<void>((resolve) => brokerServer.once("listening", resolve));
    const brokerAddress = brokerServer.address();
    if (!brokerAddress || typeof brokerAddress === "string") throw new Error("broker unavailable");
    process.env.F10_PROVIDER_BROKER_URL = `http://127.0.0.1:${brokerAddress.port}`;

    const [user] = await db.insert(usersTable).values({
      clerkUserId: `f10-key-rotation-${randomUUID()}`,
      email: `f10-key-rotation-${randomUUID()}@test.invalid`,
    }).returning();
    tenantId = user!.id;
    const [session] = await db.insert(harnessSessionsTable).values({ userId: tenantId, sessionName: "F10 key rotation" }).returning();
    sessionId = session!.id;
    [source] = await db.insert(harnessArtifactsTable).values({
      sessionId,
      userId: tenantId,
      featureId: 6,
      artifactType: "MVP_PDD",
      name: "Rotation source",
      artifactContent: { product: "rotation-test" },
    }).returning();
    requireAuthMock.mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      req.localUser = user!;
      next();
    });

    const app = express();
    app.use(express.json());
    app.use("/api", (await import("../src/routes/f10")).default);
    apiServer = app.listen(0);
    await new Promise<void>((resolve) => apiServer.once("listening", resolve));
    const apiAddress = apiServer.address();
    if (!apiAddress || typeof apiAddress === "string") throw new Error("API unavailable");
    apiUrl = `http://127.0.0.1:${apiAddress.port}`;
  });

  afterAll(async () => {
    if (apiServer) await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    if (brokerServer) await new Promise<void>((resolve) => brokerServer.close(() => resolve()));
    const deployments = await db.select({ id: f10BundleDeploymentsTable.id }).from(f10BundleDeploymentsTable).where(eq(f10BundleDeploymentsTable.tenantId, tenantId));
    for (const deployment of deployments) {
      await db.delete(f10BundleDeploymentReceiptsTable).where(eq(f10BundleDeploymentReceiptsTable.deploymentId, deployment.id));
      await db.delete(f10BundleDeploymentAttemptsTable).where(eq(f10BundleDeploymentAttemptsTable.deploymentId, deployment.id));
      await db.delete(f10BundleDeploymentAuditTable).where(eq(f10BundleDeploymentAuditTable.deploymentId, deployment.id));
    }
    await db.delete(f10BundleDeploymentsTable).where(eq(f10BundleDeploymentsTable.tenantId, tenantId));
    await db.delete(f10ProviderConnectionsTable).where(eq(f10ProviderConnectionsTable.tenantId, tenantId));
    await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.sessionId, sessionId));
    await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.id, sessionId));
    await db.delete(usersTable).where(eq(usersTable.id, tenantId));
  });

  async function createDeployment(authorizationRef: string, authorizationKeyVersion: string) {
    const [connection] = await db.insert(f10ProviderConnectionsTable).values({
      tenantId,
      provider: "OPENAI_AGENTS",
      name: `rotation-${randomUUID()}`,
      authorizationRef,
      authorizationKeyVersion,
      scopes: [],
    }).returning();
    const exported = buildExport({
      id: source.id,
      type: "MVP_PDD",
      name: source.name,
      content: source.artifactContent,
      createdAt: source.createdAt,
    }, { outputKind: "PDD", family: "OPENAI_AGENTS", target: "OPENAI_AGENTS_SDK", deliveryMode: "EXPORT" });
    const [deployment] = await db.insert(f10BundleDeploymentsTable).values({
      tenantId,
      actorId: tenantId,
      sourceArtifactId: source.id,
      provider: "OPENAI_AGENTS",
      target: "OPENAI_AGENTS_SDK",
      connectionRef: connection!.id,
      outputKind: "PDD",
      bundleHash: String(exported.manifest.bundleSha256),
      idempotencyKey: randomUUID(),
      policySnapshot: { schemaVersion: "f10-native-v1", targetConfig: { model: "gpt-test", environment: "sandbox" } },
      state: "QUEUED",
    }).returning();
    return { connection: connection!, deployment: deployment! };
  }

  const processDeployment = (id: string) => fetch(`${apiUrl}/api/f10/deployments/${id}/process`, { method: "POST" });

  it.each([
    { provider: "SLACK" as const, target: "SLACK_NOTIFICATIONS", targetConfig: { workspaceId: "T123", channelId: "C123" } },
    { provider: "SLACK" as const, target: "SLACK_AGENT", targetConfig: { workspaceId: "T123", channelId: "C123", agentEndpoint: "https://agent.example.com/invoke" } },
    { provider: "LANGCHAIN" as const, target: "LANGCHAIN_APP", targetConfig: { runtimeEndpoint: "https://runtime.example.com/import", deploymentName: "reviewed" } },
    { provider: "LANGSMITH" as const, target: "LANGSMITH_DATASET", targetConfig: { workspaceId: "workspace-1", datasetName: "Reviewed artifacts" } },
  ])("queues and delivers $provider / $target only with its active user connection", async ({ provider, target, targetConfig }) => {
    const [connection] = await db.insert(f10ProviderConnectionsTable).values({
      tenantId, provider, name: `collaboration-${randomUUID()}`,
      authorizationRef: sealAuthorizationRef(`opaque-${randomUUID()}`, { current: currentKey }),
      authorizationKeyVersion: currentKey.version, scopes: [],
    }).returning();
    const payload = { sourceArtifactId: source.id, provider, target, connectionRef: connection!.id, outputKind: "PDD", targetConfig, releaseIntent: `release-${randomUUID()}` };
    const request = (body: unknown) => fetch(`${apiUrl}/api/f10/deployments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const queued = await request(payload);
    expect(queued.status).toBe(201);
    const deployment = await queued.json();
    expect(deployment.state).toBe("QUEUED");
    const delivered = await processDeployment(deployment.id);
    expect(delivered.status).toBe(200);
    const [stored] = await db.select().from(f10BundleDeploymentsTable).where(eq(f10BundleDeploymentsTable.id, deployment.id));
    expect(stored).toMatchObject({ state: "ACKNOWLEDGED", provider, target, executionStatus: "NOT_CONFIRMED" });
    await db.update(f10ProviderConnectionsTable).set({ active: false }).where(eq(f10ProviderConnectionsTable.id, connection!.id));
    const revoked = await request({ ...payload, releaseIntent: `revoked-${randomUUID()}` });
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toMatchObject({ mode: "EXPORT", deployment: false, reason: "provider connection is unconfigured or revoked" });
  });

  it("enforces verified code and owner-bound source checks on the manual subscription export", async () => {
    const [unverified] = await db.insert(harnessArtifactsTable).values({
      sessionId, userId: tenantId, featureId: 8, artifactType: "VERIFIED_CODEBASE_BUNDLE",
      name: "Unverified fixture", verificationStatus: "UNVERIFIED",
      artifactContent: { files: [{ path: "index.js", content: "export default true;" }] },
    }).returning();
    const request = (sourceArtifactId: string) => fetch(`${apiUrl}/api/f10/exports/download`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceArtifactId, outputKind: "CODE_DJ", family: "PROGRAMMING_ENVIRONMENT", target: "TypeScript/Node", deliveryMode: "EXPORT" }),
    });
    expect((await request(randomUUID())).status).toBe(400);
    expect((await request(unverified!.id)).status).toBe(400);
    await db.update(harnessArtifactsTable).set({
      verificationStatus: "VERIFIED", contentHash: "a".repeat(64), verificationEvidenceHash: "b".repeat(64),
    }).where(eq(harnessArtifactsTable.id, unverified!.id));
    const exported = await request(unverified!.id);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("application/zip");
    const bytes = Buffer.from(await exported.arrayBuffer());
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    const [unchanged] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, unverified!.id));
    expect(unchanged?.artifactType).toBe("VERIFIED_CODEBASE_BUNDLE");
  });

  it("re-encrypts a previous-key grant under the current key before delivery", async () => {
    const plaintext = `previous-provider-reference-${randomUUID()}`;
    const original = sealAuthorizationRef(plaintext, { current: previousKey });
    const { connection, deployment } = await createDeployment(original, previousKey.version);
    const response = await processDeployment(deployment.id);
    expect(response.status).toBe(200);
    expect((await response.json()).state).toBe("ACKNOWLEDGED");

    const [rewrapped] = await db.select().from(f10ProviderConnectionsTable).where(eq(f10ProviderConnectionsTable.id, connection.id));
    expect(rewrapped!.authorizationRef).not.toBe(original);
    expect(rewrapped!.authorizationKeyVersion).toBe(currentKey.version);
    expect(openAuthorizationRef(rewrapped!.authorizationRef, { current: currentKey }).value).toBe(plaintext);
  });

  it("disables and audits a connection whose key version cannot be opened", async () => {
    const plaintext = `unavailable-provider-reference-${randomUUID()}`;
    const retiredKey = { version: "retired-key", secret: key(24) };
    const { connection, deployment } = await createDeployment(sealAuthorizationRef(plaintext, { current: retiredKey }), retiredKey.version);
    const response = await processDeployment(deployment.id);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body).toMatchObject({ state: "FAILED_PERMANENT", reconnectRequired: true });
    expect(JSON.stringify(body)).not.toContain(plaintext);

    const [disabled] = await db.select().from(f10ProviderConnectionsTable).where(eq(f10ProviderConnectionsTable.id, connection.id));
    expect(disabled).toMatchObject({ active: false, authorizationKeyVersion: retiredKey.version });
    expect(disabled!.reconnectRequiredAt).toBeInstanceOf(Date);
    expect(disabled!.reconnectReason).toMatch(/reconnect/);
    expect(disabled!.reconnectReason).not.toContain(plaintext);
    const audit = await db.select().from(f10BundleDeploymentAuditTable).where(eq(f10BundleDeploymentAuditTable.deploymentId, deployment.id));
    expect(audit.some(row => row.toState === "FAILED_PERMANENT" && row.reason.includes("reconnect"))).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(plaintext);
  });
});