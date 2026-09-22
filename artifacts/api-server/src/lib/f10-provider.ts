import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Family, ExportResult } from "./f10-export";

export type ProviderTargetConfig = {
  provider: Family; target: string; region?: string; accountId?: string; roleArn?: string; resourceName?: string;
  subscriptionId?: string; tenantId?: string; resourceGroup?: string; location?: string;
  projectId?: string; agentId?: string; displayName?: string; model?: string; environment?: string; useVertex?: string;
};
export type ProviderTransport = (input: { provider: Family; target: string; targetConfig?: Record<string, string>; authorizationRef: string; bundle: Uint8Array; idempotencyKey: string; deadline: Date }) => Promise<{ accepted: boolean; receiptId?: string }>;
export type ProviderExecutionStatus = "ACCEPTED" | "RUNNING" | "COMPLETED" | "FAILED";
export type StoredExecutionStatus = "NOT_CONFIRMED" | ProviderExecutionStatus;
export type ProviderStatusTransport = (input: { provider: Family; target: string; authorizationRef: string; operationId: string; deadline: Date }) => Promise<{ status: ProviderExecutionStatus; updatedAt?: string }>;
export type ProviderReceipt = { receipt_id: string; provider: Family; target: string; bundle_sha256: string; accepted: boolean; provider_receipt_id: string | null; status: "accepted" | "rejected"; execution: "NOT_CONFIRMED"; timestamp: string; signature: string };

export type AuthorizationKey = { version: string; secret: string };
export function trustedProviderTargetConfig(provider: Family, target: string, targetConfig: Record<string, string>): ProviderTargetConfig {
  if (Object.hasOwn(targetConfig, "provider") || Object.hasOwn(targetConfig, "target")) {
    throw new Error("targetConfig cannot override provider or target");
  }
  return { ...targetConfig, provider, target };
}

export function assertQueuedBundleHash(exportResult: ExportResult, expectedHash: string): void {
  const actualHash = createHash("sha256").update(exportResult.bundle).digest("hex");
  if (actualHash !== expectedHash) throw new Error("queued bundle no longer matches its authorized hash");
}

export const targetConfigError = (c: ProviderTargetConfig): string | undefined => {
  const required = (field: keyof ProviderTargetConfig) => typeof c[field] === "string" && String(c[field]).length > 0;
  const allowed: Record<string, string[]> = {
    AWS: ["provider", "target", "region", "accountId", "roleArn", "resourceName"],
    AZURE: ["provider", "target", "subscriptionId", "tenantId", "resourceGroup", "location", "resourceName"],
    OPENAI_AGENTS: ["provider", "target", "projectId", "agentId", "model", "environment"],
    GEMINI_AGENTS: ["provider", "target", "projectId", "location", "agentId", "displayName", "model", "environment", "useVertex"],
  };
  if (!["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"].includes(c.provider)) return "unsupported provider";
  const unknown = Object.keys(c).find(key => !allowed[c.provider]?.includes(key));
  if (unknown) return `unsupported ${c.provider} target field: ${unknown}`;
  if (!required("target")) return "target is required";
  if (c.provider === "AWS" && !["AWS_LAMBDA", "AWS_ECS_FARGATE", "AWS_S3"].includes(c.target)) return "invalid AWS target";
  if (c.provider === "AZURE" && !["AZURE_FUNCTIONS", "AZURE_CONTAINER_APPS", "AZURE_BLOB_STORAGE"].includes(c.target)) return "invalid Azure target";
  if (c.provider === "OPENAI_AGENTS" && c.target !== "OPENAI_AGENTS_SDK") return "invalid OpenAI Agents target";
  if (c.provider === "GEMINI_AGENTS" && !["GEMINI_ADK", "GEMINI_VERTEX_AGENT_ENGINE"].includes(c.target)) return "invalid Gemini target";
  if (c.provider === "AWS" && (!required("region") || !required("resourceName"))) return "AWS region and resourceName are required";
  if (c.provider === "AZURE" && (!required("subscriptionId") || !required("resourceGroup") || !required("location") || !required("resourceName"))) return "Azure subscriptionId, resourceGroup, location and resourceName are required";
  if (c.provider === "OPENAI_AGENTS" && (!required("model") || !required("environment"))) return "OpenAI model and environment are required";
  if (c.provider === "GEMINI_AGENTS" && (!required("projectId") || !required("location") || !required("model") || !required("environment"))) return "Gemini projectId, location, model and environment are required";
  return undefined;
};

export function createProviderAdapter(transport: ProviderTransport, signingSecret: string) {
  return {
    async deliver(config: ProviderTargetConfig, authorizationRef: string, exportResult: ExportResult, key: string, deadline: Date): Promise<ProviderReceipt> {
      const hash = createHash("sha256").update(exportResult.bundle).digest("hex");
      const { provider: _provider, target: _target, ...targetConfig } = config;
      const result = await transport({ provider: config.provider, target: config.target, targetConfig, authorizationRef, bundle: exportResult.bundle, idempotencyKey: key, deadline });
      const base = { receipt_id: `F10-BUNDLE-${randomUUID()}`, provider: config.provider, target: config.target, bundle_sha256: hash, accepted: result.accepted, provider_receipt_id: result.receiptId ?? null, status: result.accepted ? "accepted" as const : "rejected" as const, execution: "NOT_CONFIRMED" as const, timestamp: new Date().toISOString() };
      return { ...base, signature: createHmac("sha256", signingSecret).update(JSON.stringify(base)).digest("hex") };
    },
  };
}

function authorizationKey(secret: string): Buffer {
  return createHash("sha256").update(`f10-provider-authorization:${secret}`).digest();
}

function validAuthorizationKey(key: AuthorizationKey | undefined): key is AuthorizationKey {
  if (!key?.secret || !/^[A-Za-z0-9_-]{1,32}$/u.test(key.version) || !/^[A-Za-z0-9_-]+$/u.test(key.secret)) return false;
  return Buffer.from(key.secret, "base64url").length >= 32;
}
export function sealAuthorizationRef(value: string, keyring: AuthorizationKeyring): string {
  if (!validAuthorizationKey(keyring.current)) throw new Error("authorization encryption is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", authorizationKey(keyring.current.secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v2.${keyring.current.version}.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptAuthorizationRef(iv: string, tag: string, ciphertext: string, secret: string): string {
  const decipher = createDecipheriv("aes-256-gcm", authorizationKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
export function openAuthorizationRef(value: string, keyring: AuthorizationKeyring, legacySessionSecret?: string): OpenedAuthorizationRef {
  const parts = value.split(".");
  if (parts[0] === "v1") {
    const [, iv, tag, ciphertext] = parts;
    if (!iv || !tag || !ciphertext || !legacySessionSecret) throw new AuthorizationKeyUnavailableError("legacy-session-v1");
    try {
      return { value: decryptAuthorizationRef(iv, tag, ciphertext, legacySessionSecret), keyVersion: "legacy-session-v1", needsReencryption: true };
    } catch {
      throw new AuthorizationKeyUnavailableError("legacy-session-v1");
    }
  }
  const [format, keyVersion, iv, tag, ciphertext] = parts;
  if (format !== "v2" || !keyVersion || !iv || !tag || !ciphertext) throw new Error("invalid authorization reference");
  const key = [keyring.current, keyring.previous].find(candidate => candidate?.version === keyVersion);
  if (!key) throw new AuthorizationKeyUnavailableError(keyVersion);
  try {
    return { value: decryptAuthorizationRef(iv, tag, ciphertext, key.secret), keyVersion, needsReencryption: key.version !== keyring.current.version };
  } catch {
    throw new AuthorizationKeyUnavailableError(keyVersion);
  }
}

export function providerBrokerTransport(baseUrl = process.env.F10_PROVIDER_BROKER_URL, bearer = process.env.F10_PROVIDER_BROKER_TOKEN): ProviderTransport {
  return async input => {
    if (!baseUrl || !bearer) throw Object.assign(new Error("provider broker is not configured"), { code: "UNCONFIGURED" });
    const remaining = Math.max(1, input.deadline.getTime() - Date.now());
    const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}/v1/bundle-deployments`, {
      method: "POST", signal: AbortSignal.timeout(remaining), headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json", "idempotency-key": input.idempotencyKey },
      body: JSON.stringify({ provider: input.provider, target: input.target, authorization_ref: input.authorizationRef, target_config: input.targetConfig ?? {}, bundle_base64: Buffer.from(input.bundle).toString("base64") }),
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error(`provider broker HTTP ${response.status}`), { status: response.status, body: text.slice(0, 256) });
    let parsed: { accepted?: boolean; receipt_id?: string } = {};
    try { parsed = JSON.parse(text) as typeof parsed; } catch { /* normalized below */ }
    return { accepted: parsed.accepted === true, receiptId: parsed.receipt_id };
  };
}

const providerExecutionStatuses: Record<string, Record<ProviderExecutionStatus, readonly string[]>> = {
  AWS_LAMBDA: {
    ACCEPTED: ["ACCEPTED", "PENDING"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCESSFUL"],
    FAILED: ["FAILED"],
  },
  AWS_ECS_FARGATE: {
    ACCEPTED: ["ACCEPTED", "PENDING", "SUBMITTED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCESSFUL"],
    FAILED: ["FAILED"],
  },
  AWS_S3: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING", "SUBMITTED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "SUCCESS"],
    FAILED: ["FAILED", "ERROR"],
  },
  AZURE_FUNCTIONS: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING", "SUBMITTED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "SUCCESS"],
    FAILED: ["FAILED", "ERROR", "CANCELLED", "CANCELED"],
  },
  AZURE_CONTAINER_APPS: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING", "SUBMITTED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "SUCCESS"],
    FAILED: ["FAILED", "ERROR", "CANCELLED", "CANCELED"],
  },
  AZURE_BLOB_STORAGE: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING", "SUBMITTED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "SUCCESS"],
    FAILED: ["FAILED", "ERROR", "CANCELLED", "CANCELED"],
  },
  OPENAI_AGENTS_SDK: {
    ACCEPTED: ["ACCEPTED", "QUEUED"],
    RUNNING: ["RUNNING", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED"],
    FAILED: ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "INCOMPLETE"],
  },
  GEMINI_ADK: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING"],
    RUNNING: ["RUNNING", "PROCESSING"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "DONE"],
    FAILED: ["FAILED", "ERROR", "CANCELLED", "CANCELED"],
  },
  GEMINI_VERTEX_AGENT_ENGINE: {
    ACCEPTED: ["ACCEPTED", "QUEUED", "PENDING"],
    RUNNING: ["RUNNING", "PROCESSING"],
    COMPLETED: ["COMPLETED", "SUCCEEDED", "DONE"],
    FAILED: ["FAILED", "ERROR", "CANCELLED", "CANCELED"],
  },
};

export function normalizeProviderExecutionStatus(provider: Family, target: string, value: string): ProviderExecutionStatus {
  const normalized = value.trim()
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[\s-]+/gu, "_")
    .toUpperCase();
  const targetBelongsToProvider =
    (provider === "AWS" && target.startsWith("AWS_")) ||
    (provider === "AZURE" && target.startsWith("AZURE_")) ||
    (provider === "OPENAI_AGENTS" && target === "OPENAI_AGENTS_SDK") ||
    (provider === "GEMINI_AGENTS" && target.startsWith("GEMINI_"));
  const aliases = targetBelongsToProvider ? providerExecutionStatuses[target] : undefined;
  if (aliases) {
    for (const status of ["ACCEPTED", "RUNNING", "COMPLETED", "FAILED"] as const) {
      if (aliases[status].includes(normalized)) return status;
    }
  }
  throw Object.assign(new Error("provider returned an unsupported execution status"), { status: 502 });
}

export function shouldApplyProviderExecutionStatus(
  currentStatus: StoredExecutionStatus,
  currentProviderUpdatedAt: Date | null,
  nextStatus: ProviderExecutionStatus,
  nextProviderUpdatedAt: Date | null,
): boolean {
  if (currentStatus === nextStatus) return false;
  if (currentProviderUpdatedAt && nextProviderUpdatedAt && nextProviderUpdatedAt <= currentProviderUpdatedAt) return false;
  if (currentStatus === "COMPLETED" || currentStatus === "FAILED") return false;
  const rank: Record<StoredExecutionStatus, number> = { NOT_CONFIRMED: 0, ACCEPTED: 1, RUNNING: 2, COMPLETED: 3, FAILED: 3 };
  return rank[nextStatus] > rank[currentStatus];
}

export function shouldRefreshProviderExecutionTimestamp(
  currentStatus: StoredExecutionStatus,
  currentProviderUpdatedAt: Date | null,
  nextStatus: ProviderExecutionStatus,
  nextProviderUpdatedAt: Date | null,
): boolean {
  return currentStatus === nextStatus && Boolean(nextProviderUpdatedAt) &&
    (!currentProviderUpdatedAt || nextProviderUpdatedAt! > currentProviderUpdatedAt);
}

export function providerBrokerStatusTransport(baseUrl = process.env.F10_PROVIDER_BROKER_URL, bearer = process.env.F10_PROVIDER_BROKER_TOKEN): ProviderStatusTransport {
  return async input => {
    if (!baseUrl || !bearer) throw Object.assign(new Error("provider broker is not configured"), { code: "UNCONFIGURED" });
    const remaining = Math.max(1, input.deadline.getTime() - Date.now());
    const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}/v1/bundle-deployments/status`, {
      method: "POST", signal: AbortSignal.timeout(remaining), headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify({ provider: input.provider, target: input.target, authorization_ref: input.authorizationRef, operation_id: input.operationId }),
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error(`provider broker HTTP ${response.status}`), { status: response.status, body: text.slice(0, 256) });
    let parsed: { status?: string; updated_at?: string } = {};
    try { parsed = JSON.parse(text) as typeof parsed; } catch { /* normalized below */ }
    if (!parsed.status) throw Object.assign(new Error("provider broker returned no execution status"), { status: 502 });
    return { status: normalizeProviderExecutionStatus(input.provider, input.target, parsed.status), updatedAt: parsed.updated_at };
  };
}

export class AuthorizationKeyUnavailableError extends Error {
  readonly code = "AUTHORIZATION_KEY_UNAVAILABLE";
  constructor(readonly keyVersion: string) {
    super(`provider authorization key version "${keyVersion}" is unavailable; reconnect the provider account`);
  }
}

export type AuthorizationKeyring = { current: AuthorizationKey; previous?: AuthorizationKey };

export type OpenedAuthorizationRef = { value: string; keyVersion: string; needsReencryption: boolean };

export function authorizationKeyringFromEnv(env: NodeJS.ProcessEnv = process.env): AuthorizationKeyring {
  const current = { version: env.F10_PROVIDER_AUTHORIZATION_KEY_VERSION ?? "", secret: env.F10_PROVIDER_AUTHORIZATION_KEY ?? "" };
  if (!validAuthorizationKey(current)) throw new Error("provider authorization encryption is not configured");
  const previousVersion = env.F10_PROVIDER_AUTHORIZATION_PREVIOUS_KEY_VERSION;
  const previousSecret = env.F10_PROVIDER_AUTHORIZATION_PREVIOUS_KEY;
  if (Boolean(previousVersion) !== Boolean(previousSecret)) throw new Error("previous provider authorization key configuration is incomplete");
  const previous = previousVersion && previousSecret ? { version: previousVersion, secret: previousSecret } : undefined;
  if (previous && (!validAuthorizationKey(previous) || previous.version === current.version)) throw new Error("previous provider authorization key configuration is invalid");
  return { current, previous };
}
