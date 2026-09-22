import { createHash, randomUUID } from "node:crypto";

export const COLONIZATION_TARGET_CLASSES = ["SOFTWARE_PLATFORM", "AGENT_GATEWAY", "FIRMWARE", "ROBOTICS", "APPLIANCE_IOT"] as const;
export const UCG_COL_APPROVED_THRESHOLD = 0.9;
export const COLONIZATION_CONSENT_PURPOSES = ["STAGE", "PROMOTION"] as const;
export type ColonizationTargetClass = typeof COLONIZATION_TARGET_CLASSES[number];
export const COLONIZATION_PHASES = ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const;
export type ColonizationPhase = typeof COLONIZATION_PHASES[number];
export type UcgColCertificate = {
  certificateRef: string;
  artifactHash: string;
  deploymentSubject: string;
  score: number;
  threshold: number;
  verdict: "PASS";
  expiresAt: string;
};
export type ColonizationConsent = {
  consentId: string;
  purpose: typeof COLONIZATION_CONSENT_PURPOSES[number];
  deploymentSubject: string;
  exactWriteHash: string;
};
export type VaultHandle = {
  handle: string;
  scope: "F10_STAGE" | "F10_PROMOTION";
  deploymentSubject: string;
  expiresAt: string;
};
export type ColonizationInput = {
  requestClass: "RUN" | "SENSE_ONLY" | "RE_VERIFY" | "ROLLBACK";
  artifactRef: string; artifactHash: string; artifactClass: "SPC" | "MA" | "PDD" | "MPDD";
  ucgCertificateRef: string; target: string; targetClass: ColonizationTargetClass;
  connectorAdapter: string; customizationSet?: { packaging_fields_only?: Record<string, string> };
  f9AttestationRef?: string | null; consentChannel: string;
  f9AttestationValidated?: boolean;
  deploymentSubject?: string;
  ucgColCertificate?: UcgColCertificate;
  stageConsent?: ColonizationConsent;
  promotionConsent?: ColonizationConsent;
  vaultHandle?: VaultHandle;
};
export type Refusal = {
  phaseHalted: number; constraintCited: string; invariantCited: string;
  cause: string; requiredToProceed: string; groMode: "SAFE_LIFE" | "HUMAN_IN_LOOP" | "CONTAINMENT" | "KILLZONE";
};
export type PhaseStatuses = Record<ColonizationPhase, "PENDING" | "ACTIVE" | "REFUSED" | "COMPLETE">;
export type AdapterReadiness = { savant: "UNWIRED"; connector: "UNWIRED"; analyzer: "UNWIRED"; vault: "UNWIRED"; consentGate: "UNWIRED"; ucgCol: "UNWIRED" };
export type ColonizationEvaluation = { runId: string; state: "REFUSED"; phase: ColonizationPhase; maxReachablePhase: "C4" | "C8"; groMode: "SAFE_LIFE"; phaseStatuses: PhaseStatuses; adapterReadiness: AdapterReadiness; refusal: Refusal };
export type PromotionGateResult =
  | { ok: true }
  | { ok: false; code: "MISSING_THRESHOLD" | "UCG_COL_UNAVAILABLE" | "INVALID_CERTIFICATE" | "WRONG_DEPLOYMENT_SUBJECT" | "CONSENT_REPLAY" | "INVALID_CONSENT" | "VAULT_UNAVAILABLE" | "INVALID_VAULT_HANDLE"; reason: string };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function colonizationWriteHash(purpose: "STAGE" | "PROMOTION", deploymentSubject: string, artifactHash: string): string {
  return `sha256:${createHash("sha256").update(canonicalJson({ artifactHash, deploymentSubject, purpose })).digest("hex")}`;
}

export function evaluatePromotionGate(input: {
  artifactHash: string;
  deploymentSubject: string;
  certificate?: UcgColCertificate;
  certificateAuthorityAvailable: boolean;
  consent?: ColonizationConsent;
  consumedConsentIds?: ReadonlySet<string>;
  vaultAvailable: boolean;
  vaultHandle?: VaultHandle;
  now?: Date;
}): PromotionGateResult {
  const { artifactHash, deploymentSubject, certificate, consent, vaultHandle } = input;
  const now = input.now ?? new Date();
  if (!certificate || !Number.isFinite(certificate.threshold)) return { ok: false, code: "MISSING_THRESHOLD", reason: "UCG-COL certificate does not carry the approved threshold" };
  if (!input.certificateAuthorityAvailable) return { ok: false, code: "UCG_COL_UNAVAILABLE", reason: "UCG-COL certificate authority is unavailable; promotion fails closed" };
  if (certificate.threshold !== UCG_COL_APPROVED_THRESHOLD || certificate.score < certificate.threshold || certificate.verdict !== "PASS" || certificate.artifactHash !== artifactHash || new Date(certificate.expiresAt) <= now) {
    return { ok: false, code: "INVALID_CERTIFICATE", reason: "UCG-COL certificate is invalid, expired, below threshold, or for a different artifact" };
  }
  if (certificate.deploymentSubject !== deploymentSubject) return { ok: false, code: "WRONG_DEPLOYMENT_SUBJECT", reason: "UCG-COL certificate is bound to a different deployment subject" };
  if (!consent || consent.purpose !== "PROMOTION" || consent.deploymentSubject !== deploymentSubject || consent.exactWriteHash !== colonizationWriteHash("PROMOTION", deploymentSubject, artifactHash)) {
    return { ok: false, code: "INVALID_CONSENT", reason: "promotion consent is not bound to this exact write and deployment subject" };
  }
  if (input.consumedConsentIds?.has(consent.consentId)) return { ok: false, code: "CONSENT_REPLAY", reason: "promotion consent has already been consumed" };
  if (!input.vaultAvailable) return { ok: false, code: "VAULT_UNAVAILABLE", reason: "Vault is unavailable; promotion fails closed" };
  if (!vaultHandle || !/^vault-handle:[A-Za-z0-9_-]{16,200}$/u.test(vaultHandle.handle) || vaultHandle.scope !== "F10_PROMOTION" || vaultHandle.deploymentSubject !== deploymentSubject || new Date(vaultHandle.expiresAt) <= now) {
    return { ok: false, code: "INVALID_VAULT_HANDLE", reason: "Vault did not return a valid opaque handle scoped to this promotion" };
  }
  return { ok: true };
}

const physical: readonly ColonizationTargetClass[] = ["FIRMWARE", "ROBOTICS", "APPLIANCE_IOT"];
export function evaluateColonization(input: ColonizationInput): ColonizationEvaluation {
  const runId = `F10-RUN-${randomUUID()}`;
  const phaseStatuses = Object.fromEntries(COLONIZATION_PHASES.map(phase => [phase, "PENDING"])) as PhaseStatuses;
  phaseStatuses.C0 = "ACTIVE";
  const maxReachablePhase = input.targetClass === "AGENT_GATEWAY" ? "C4" : "C8";
  const refusal = (phaseHalted: number, phase: ColonizationPhase, constraintCited: string, invariantCited: string, cause: string, requiredToProceed: string): ColonizationEvaluation => {
    phaseStatuses[phase] = "REFUSED";
    return { runId, state: "REFUSED", phase, maxReachablePhase, groMode: "SAFE_LIFE", phaseStatuses, adapterReadiness: { savant: "UNWIRED", connector: "UNWIRED", analyzer: "UNWIRED", vault: "UNWIRED", consentGate: "UNWIRED", ucgCol: "UNWIRED" }, refusal: { phaseHalted, constraintCited, invariantCited, cause, requiredToProceed, groMode: "SAFE_LIFE" } };
  };
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.artifactHash)) return refusal(0, "C0", "C-SAVCON-06", "SPARTAN #22", "artifact_hash is not a valid sha256 digest", "Provide the certified artifact's sha256:<64 lowercase hex> hash");
  if (!input.ucgCertificateRef.trim()) return refusal(0, "C0", "C-SAVCON-10", "SPARTAN #22", "UCG certificate record is missing", "Provide a valid UCG certificate reference for this artifact");
  if (physical.includes(input.targetClass) && (!input.f9AttestationRef?.trim() || input.f9AttestationValidated === false)) return refusal(0, "C0", "C-SAVCON-10", "SPARTAN #25", input.f9AttestationRef ? "F9 attestation is not a valid owned emitted artifact with active OSIRIS custody and required verdicts" : "physical target has no F9 attestation", "Provide a validated F9 attestation with active OSIRIS custody, Machine Artifact UCG PASS, SAVANT FIT and MM MATH_VERIFIED");
  phaseStatuses.C0 = "COMPLETE"; phaseStatuses.C1 = "ACTIVE";
  return refusal(1, "C1", "C-SAVCON-12", "OI-12", "connector analyzer and SAVANT engine adapters are not wired; no SenseRecord can be emitted", "Wire qualified connector analyzer and SAVANT adapters, then start a new f10_run_id");
}

export function artifactHashFromBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}