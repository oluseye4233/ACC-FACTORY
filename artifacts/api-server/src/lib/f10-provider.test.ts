import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertQueuedBundleHash,
  authorizationKeyringFromEnv,
  createProviderAdapter,
  normalizeProviderExecutionStatus,
  openAuthorizationRef,
  providerBrokerStatusTransport,
  sealAuthorizationRef,
  shouldApplyProviderExecutionStatus,
  shouldRefreshProviderExecutionTimestamp,
  targetConfigError,
  trustedProviderTargetConfig,
} from "./f10-provider";

const secret = (fill: number) => Buffer.alloc(32, fill).toString("base64url");
const legacySeal = (value: string, sessionSecret: string) => {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(`f10-provider-authorization:${sessionSecret}`).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native F10 provider lane", () => {
  it("rejects provider-specific target/config mismatches", () => {
    expect(targetConfigError({ provider: "AWS", target: "AWS_LAMBDA" })).toContain("region");
    expect(targetConfigError({ provider: "AWS", target: "AWS_LAMBDA", region: "us-east-1", resourceName: "worker" })).toBeUndefined();
    expect(targetConfigError({ provider: "AZURE", target: "AZURE_FUNCTIONS", subscriptionId: "s" })).toContain("resourceGroup");
    expect(targetConfigError({ provider: "AWS", target: "AWS_LAMBDA", region: "us-east-1", resourceName: "worker", model: "not-allowed" })).toContain("unsupported");
  });

  it("does not allow target config to override the authorized destination", () => {
    expect(() => trustedProviderTargetConfig("AWS", "AWS_LAMBDA", { provider: "AZURE", region: "us-east-1", resourceName: "worker" })).toThrow(/cannot override/);
    expect(() => trustedProviderTargetConfig("AWS", "AWS_LAMBDA", { target: "AWS_S3", region: "us-east-1", resourceName: "worker" })).toThrow(/cannot override/);
    expect(trustedProviderTargetConfig("AWS", "AWS_LAMBDA", { region: "us-east-1", resourceName: "worker" })).toMatchObject({ provider: "AWS", target: "AWS_LAMBDA" });
  });

  it("fails closed when queued bundle bytes no longer match the authorized hash", () => {
    const original = { bundle: Buffer.from("original"), manifest: {}, files: [] } as any;
    const expected = "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5";
    expect(() => assertQueuedBundleHash(original, expected)).not.toThrow();
    expect(() => assertQueuedBundleHash({ ...original, bundle: Buffer.from("changed") }, expected)).toThrow(/authorized hash/);
  });

  it("only signs a receipt reflecting transport acceptance", async () => {
    const adapter = createProviderAdapter(async () => ({ accepted: false }), "test-secret");
    const receipt = await adapter.deliver(
      { provider: "OPENAI_AGENTS", target: "OPENAI_AGENTS_SDK" },
      "AUTHREF_TEST",
      { bundle: Buffer.from("x"), manifest: {} as any, files: [] },
      "idem",
      new Date(Date.now() + 1_000),
    );
    expect(receipt.accepted).toBe(false);
    expect(receipt.status).toBe("rejected");
    expect(receipt.execution).toBe("NOT_CONFIRMED");
    expect(receipt.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("encrypts opaque provider authorization references at rest", () => {
    const keys = { current: { version: "2026-09", secret: secret(1) } };
    const sealed = sealAuthorizationRef("broker-owned-reference", keys);
    expect(sealed).not.toContain("broker-owned-reference");
    expect(openAuthorizationRef(sealed, keys)).toMatchObject({ value: "broker-owned-reference", keyVersion: "2026-09", needsReencryption: false });
    expect(() => openAuthorizationRef(sealed, { current: { version: "other", secret: secret(2) } })).toThrow(/reconnect/);
  });

  it("decrypts the previous key only during rotation and marks it for re-encryption", () => {
    const oldKeys = { current: { version: "2026-08", secret: secret(3) } };
    const sealed = sealAuthorizationRef("broker-owned-reference", oldKeys);
    const rotatingKeys = { current: { version: "2026-09", secret: secret(4) }, previous: oldKeys.current };
    expect(openAuthorizationRef(sealed, rotatingKeys)).toMatchObject({ value: "broker-owned-reference", keyVersion: "2026-08", needsReencryption: true });
  });

  it("opens legacy references for one-time re-encryption and fails closed after a session-secret rotation", () => {
    const sealed = legacySeal("legacy-reference", "original-session-secret");
    const keys = { current: { version: "2026-09", secret: secret(5) } };
    expect(openAuthorizationRef(sealed, keys, "original-session-secret")).toMatchObject({ value: "legacy-reference", needsReencryption: true });
    expect(() => openAuthorizationRef(sealed, keys, "rotated-session-secret")).toThrow(/reconnect/);
  });

  it("normalizes wrong current and previous secrets to reconnect-required errors", () => {
    const currentSealed = sealAuthorizationRef("current", { current: { version: "current", secret: secret(6) } });
    expect(() => openAuthorizationRef(currentSealed, { current: { version: "current", secret: secret(7) } })).toThrow(/reconnect/);
    const previousSealed = sealAuthorizationRef("previous", { current: { version: "previous", secret: secret(8) } });
    expect(() => openAuthorizationRef(previousSealed, {
      current: { version: "current", secret: secret(9) },
      previous: { version: "previous", secret: secret(10) },
    })).toThrow(/reconnect/);
  });

  it("requires a complete bounded keyring configuration", () => {
    expect(authorizationKeyringFromEnv({ F10_PROVIDER_AUTHORIZATION_KEY_VERSION: "v2", F10_PROVIDER_AUTHORIZATION_KEY: secret(11) } as NodeJS.ProcessEnv).previous).toBeUndefined();
    expect(() => authorizationKeyringFromEnv({ F10_PROVIDER_AUTHORIZATION_KEY_VERSION: "v2", F10_PROVIDER_AUTHORIZATION_KEY: secret(11), F10_PROVIDER_AUTHORIZATION_PREVIOUS_KEY_VERSION: "v1" } as NodeJS.ProcessEnv)).toThrow(/incomplete/);
    expect(() => authorizationKeyringFromEnv({ F10_PROVIDER_AUTHORIZATION_KEY_VERSION: "v2", F10_PROVIDER_AUTHORIZATION_KEY: "weak" } as NodeJS.ProcessEnv)).toThrow(/not configured/);
  });

  it.each([
    ["AWS", "AWS_LAMBDA", ["Pending", "InProgress", "Successful", "Failed"]],
    ["AWS", "AWS_ECS_FARGATE", ["SUBMITTED", "IN_PROGRESS", "COMPLETED", "FAILED"]],
    ["AWS", "AWS_S3", ["QUEUED", "IN_PROGRESS", "SUCCEEDED", "ERROR"]],
    ["AZURE", "AZURE_FUNCTIONS", ["Accepted", "Running", "Succeeded", "Failed"]],
    ["AZURE", "AZURE_CONTAINER_APPS", ["Submitted", "In_Progress", "Success", "Canceled"]],
    ["AZURE", "AZURE_BLOB_STORAGE", ["Pending", "Running", "Completed", "Error"]],
    ["OPENAI_AGENTS", "OPENAI_AGENTS_SDK", ["queued", "in_progress", "completed", "expired"]],
    ["GEMINI_AGENTS", "GEMINI_ADK", ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]],
    ["GEMINI_AGENTS", "GEMINI_VERTEX_AGENT_ENGINE", ["PENDING", "PROCESSING", "DONE", "ERROR"]],
  ] as const)("maps %s broker states onto the F10 execution contract", async (provider, target, states) => {
    const responses = [...states];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      expect(body).toMatchObject({
        provider,
        target,
        authorization_ref: "sandbox-authorization",
        operation_id: "sandbox-operation",
      });
      return new Response(JSON.stringify({
        status: responses.shift(),
        updated_at: "2026-09-20T12:00:00.000Z",
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const check = providerBrokerStatusTransport("https://broker.example", "broker-token");
    const normalized = [];
    for (const _state of states) {
      normalized.push((await check({
        provider,
        target,
        authorizationRef: "sandbox-authorization",
        operationId: "sandbox-operation",
        deadline: new Date(Date.now() + 1_000),
      })).status);
    }
    expect(normalized).toEqual(["ACCEPTED", "RUNNING", "COMPLETED", "FAILED"]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps provider-specific status names scoped to their provider", () => {
    expect(normalizeProviderExecutionStatus("AWS", "AWS_LAMBDA", "Successful")).toBe("COMPLETED");
    expect(() => normalizeProviderExecutionStatus("AWS", "AWS_S3", "Successful")).toThrow(/unsupported/);
    expect(normalizeProviderExecutionStatus("GEMINI_AGENTS", "GEMINI_ADK", "DONE")).toBe("COMPLETED");
    expect(() => normalizeProviderExecutionStatus("OPENAI_AGENTS", "OPENAI_AGENTS_SDK", "DONE")).toThrow(/unsupported/);
    expect(() => normalizeProviderExecutionStatus("AZURE", "AWS_LAMBDA", "Running")).toThrow(/unsupported/);
  });

  it("keeps execution reconciliation forward-only and idempotent", () => {
    expect(shouldApplyProviderExecutionStatus("NOT_CONFIRMED", null, "ACCEPTED", null)).toBe(true);
    expect(shouldApplyProviderExecutionStatus("ACCEPTED", null, "ACCEPTED", null)).toBe(false);
    expect(shouldApplyProviderExecutionStatus("RUNNING", null, "ACCEPTED", null)).toBe(false);
    expect(shouldApplyProviderExecutionStatus("RUNNING", null, "COMPLETED", null)).toBe(true);
    expect(shouldApplyProviderExecutionStatus("COMPLETED", null, "RUNNING", null)).toBe(false);
    expect(shouldApplyProviderExecutionStatus("FAILED", null, "COMPLETED", null)).toBe(false);
  });

  it("does not create duplicate transitions when a broker repeats a state", () => {
    const observations = ["ACCEPTED", "ACCEPTED", "RUNNING", "RUNNING", "COMPLETED", "COMPLETED"] as const;
    let current: "NOT_CONFIRMED" | typeof observations[number] = "NOT_CONFIRMED";
    const transitions: string[] = [];
    for (const observation of observations) {
      if (shouldApplyProviderExecutionStatus(current, null, observation, null)) {
        transitions.push(`${current}->${observation}`);
        current = observation;
      }
    }
    expect(transitions).toEqual([
      "NOT_CONFIRMED->ACCEPTED",
      "ACCEPTED->RUNNING",
      "RUNNING->COMPLETED",
    ]);
  });

  it("leaves a signed receipt unchanged when reconciliation is unavailable after revocation", async () => {
    const receipt = await createProviderAdapter(
      async () => ({ accepted: true, receiptId: "sandbox-operation" }),
      "test-secret",
    ).deliver(
      { provider: "AWS", target: "AWS_LAMBDA" },
      "sandbox-authorization",
      { bundle: Buffer.from("x"), manifest: {} as any, files: [] },
      "idem",
      new Date(Date.now() + 1_000),
    );
    const signedReceipt = structuredClone(receipt);
    const reconcileResponse = { executionStatus: "UNAVAILABLE", reason: "provider connection is missing or revoked", receipt };
    expect(reconcileResponse.receipt).toEqual(signedReceipt);
    expect(reconcileResponse.receipt.signature).toBe(signedReceipt.signature);
  });

  it("rejects out-of-order provider observations", () => {
    const current = new Date("2026-09-20T12:00:00.000Z");
    expect(shouldApplyProviderExecutionStatus("ACCEPTED", current, "RUNNING", new Date("2026-09-20T11:59:59.000Z"))).toBe(false);
    expect(shouldApplyProviderExecutionStatus("ACCEPTED", current, "RUNNING", new Date("2026-09-20T12:00:01.000Z"))).toBe(true);
    expect(shouldApplyProviderExecutionStatus("RUNNING", current, "FAILED", new Date("2026-09-20T12:00:01.000Z"))).toBe(true);
    expect(shouldRefreshProviderExecutionTimestamp("RUNNING", current, "RUNNING", new Date("2026-09-20T12:00:01.000Z"))).toBe(true);
    expect(shouldRefreshProviderExecutionTimestamp("RUNNING", current, "RUNNING", new Date("2026-09-20T11:59:59.000Z"))).toBe(false);
    expect(shouldRefreshProviderExecutionTimestamp("RUNNING", current, "COMPLETED", new Date("2026-09-20T12:00:01.000Z"))).toBe(false);
  });
});