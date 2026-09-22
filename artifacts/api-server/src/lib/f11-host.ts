import { createHash, createHmac } from "node:crypto";

export const F11_HOST_PROVIDERS = [
  "replit-deployments",
  "vercel",
  "fly-io",
  "render",
  "railway",
  "cloudflare-pages",
  "netlify",
  "aws-amplify",
  "expo-eas",
] as const;

export type F11HostProvider = (typeof F11_HOST_PROVIDERS)[number];
export type F11HostSource = "F8_BUNDLE" | "F10_HANDOFF" | "CHAT_ONLY";
export type F11VaultScope = "F11_STAGE" | "F11_PROMOTION";

type AdapterCheck = { passed: boolean; detail: string };

export type F11ProviderAdapter = {
  provider: F11HostProvider;
  adapterId: string;
  adapterVersion: string;
  provenance: string;
  capabilities: readonly string[];
  scopes: readonly F11VaultScope[];
  reversible: boolean;
  governance: string;
  executionLift: boolean;
};

const capabilities = ["stage", "health", "smoke", "rollback", "promote", "monitor"] as const;

/**
 * Provider adapters are intentionally opt-in. The registry describes the
 * contract an adapter must satisfy; an environment flag is the release
 * switch for a separately qualified implementation and never accepts a
 * provider secret from a request.
 */
export function getF11ProviderAdapter(provider: string): F11ProviderAdapter | null {
  if (!F11_HOST_PROVIDERS.includes(provider as F11HostProvider)) return null;
  const qualified = new Set(
    (process.env.F11_QUALIFIED_ADAPTERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const normalized = provider as F11HostProvider;
  return {
    provider: normalized,
    adapterId: `f11-${normalized}`,
    adapterVersion: "1.0.0",
    provenance: `provider-registry:${normalized}:f11`,
    capabilities,
    scopes: ["F11_STAGE", "F11_PROMOTION"],
    reversible: true,
    governance: "F11-GOVERNANCE-1",
    executionLift: qualified.has(normalized),
  };
}

export function checkF11ProviderAdapter(adapter: F11ProviderAdapter | null): {
  onboardingPassed: boolean;
  qualified: boolean;
  checks: Record<string, AdapterCheck>;
} {
  const checks: Record<string, AdapterCheck> = {
    provenance: {
      passed: Boolean(adapter?.provenance),
      detail: adapter?.provenance || "No provenance record",
    },
    capabilities: {
      passed: Boolean(adapter && capabilities.every((capability) => adapter.capabilities.includes(capability))),
      detail: "stage, health, smoke, rollback, promote, and monitor",
    },
    scope: {
      passed: Boolean(adapter && adapter.scopes.includes("F11_STAGE") && adapter.scopes.includes("F11_PROMOTION")),
      detail: "F11_STAGE and F11_PROMOTION",
    },
    reversibility: {
      passed: Boolean(adapter?.reversible),
      detail: "Rollback must be supported before any write",
    },
    governance: {
      passed: Boolean(adapter?.governance),
      detail: adapter?.governance || "No governance record",
    },
    executionLift: {
      passed: Boolean(adapter?.executionLift),
      detail: "A separately qualified execution lift is required",
    },
  };
  const onboardingPassed = ["provenance", "capabilities", "scope", "reversibility", "governance"]
    .every((name) => checks[name]!.passed);
  return { onboardingPassed, qualified: onboardingPassed && checks.executionLift.passed, checks };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export type F11Consent = {
  consentId: string;
  purpose: "STAGE" | "PROMOTION";
  deploymentSubject: string;
  exactWriteHash: string;
};

export type F11HumanAttestation = {
  attestationId: string;
  actorId: string;
  statement: string;
};

export type F11StageWrite = {
  source: F11HostSource;
  planArtifactId: string;
  sourceArtifactId: string;
  provider: string;
  accountRef: string;
  region: string;
  exactContentHash: string;
  costCeilingCents: number;
  deploymentSubject: string;
  rollbackPlan: string;
};

export function f11StageWriteHash(write: F11StageWrite): string {
  return sha256({ ...write, purpose: "STAGE" });
}

export function f11PromotionWriteHash(input: {
  hostRunId: string;
  exactContentHash: string;
  provider: string;
  accountRef: string;
  region: string;
  deploymentSubject: string;
}): string {
  return sha256({ ...input, purpose: "PROMOTION" });
}

export function validateF11VaultHandle(
  raw: unknown,
  scope: F11VaultScope,
  deploymentSubject: string,
  now = new Date(),
): { ok: true; fingerprint: string } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Vault handle is required" };
  const handle = raw as { handle?: unknown; scope?: unknown; deploymentSubject?: unknown; expiresAt?: unknown };
  if (typeof handle.handle !== "string" || !/^vault-handle:[A-Za-z0-9_-]{16,200}$/u.test(handle.handle)) {
    return { ok: false, reason: "Vault handle must be an opaque reference" };
  }
  if (handle.scope !== scope || handle.deploymentSubject !== deploymentSubject) {
    return { ok: false, reason: `Vault handle is not scoped to ${scope} and this deployment` };
  }
  const expiry = typeof handle.expiresAt === "string" ? new Date(handle.expiresAt) : new Date("invalid");
  if (!Number.isFinite(expiry.getTime()) || expiry <= now) return { ok: false, reason: "Vault handle is expired" };
  return { ok: true, fingerprint: sha256(handle.handle) };
}

export function validateF11HumanAttestations(value: unknown): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(value) || value.length < 2) {
    return { ok: false, reason: "At least two human attestations are required" };
  }
  const attestations = value as F11HumanAttestation[];
  const actorIds = new Set<string>();
  for (const attestation of attestations) {
    if (!attestation || typeof attestation !== "object" ||
      typeof attestation.attestationId !== "string" || !attestation.attestationId.trim() ||
      typeof attestation.actorId !== "string" || !attestation.actorId.trim() ||
      typeof attestation.statement !== "string" || !attestation.statement.trim()) {
      return { ok: false, reason: "Each human attestation needs an id, actor, and statement" };
    }
    actorIds.add(attestation.actorId);
  }
  return actorIds.size === attestations.length
    ? { ok: true }
    : { ok: false, reason: "Human attestations must come from distinct actors" };
}

export function buildUcgHostEvidence(input: {
  hostRunId: string;
  exactContentHash: string;
  stageEvidence: unknown;
  authorId: string;
  scorerId: string;
  adjudicatorId: string;
  now?: Date;
}) {
  const identities = [input.authorId, input.scorerId, input.adjudicatorId];
  if (identities.some((value) => !value.trim()) || new Set(identities).size !== 3) {
    throw new Error("UCG-HOST author, scorer, and adjudicator identities must be distinct");
  }
  const evidenceHash = sha256({
    hostRunId: input.hostRunId,
    exactContentHash: input.exactContentHash,
    stageEvidence: input.stageEvidence,
    identities,
  });
  const expiresAt = new Date((input.now ?? new Date()).getTime() + 24 * 60 * 60 * 1000);
  return {
    certificateRef: `UCG-HOST-${evidenceHash.slice(-24)}`,
    artifactHash: input.exactContentHash,
    evidenceHash,
    verdict: "PASS" as const,
    score: 1,
    threshold: 1,
    authorId: input.authorId,
    scorerId: input.scorerId,
    adjudicatorId: input.adjudicatorId,
    issuedAt: (input.now ?? new Date()).toISOString(),
    expiresAt: expiresAt.toISOString(),
    authority: "server-owned:F11",
  };
}

export function signHostReceipt(receipt: Record<string, unknown>, secret: string): string {
  return createHmac("sha256", secret).update(canonicalJson(receipt)).digest("base64url");
}