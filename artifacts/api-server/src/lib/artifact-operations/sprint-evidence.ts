import { createPublicKey, verify } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { sprintVerifierAuthoritiesTable } from "@workspace/db";
import { sprintEligibilityInputSchema } from "../short-sprint-eligibility";
import { OperationsError, type OperationsActor, type OperationsTx } from "./context";
import { hashContent } from "./imprima-model";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const EVIDENCE_SCOPES = ["SOURCE_CERTIFICATION", "E", "R", "J", "S", "C", "H", "P", "F9", "F95", "F10", "F11", "F12"] as const;
export const authoritySchema = z.object({
  name: z.string().trim().min(3).max(120),
  publicKey: z.string().max(2000).regex(/^-----BEGIN PUBLIC KEY-----\s[\s\S]+-----END PUBLIC KEY-----\s*$/),
  mechanism: z.enum(["DETERMINISTIC", "CROSS_MODEL", "HUMAN"]),
  scopes: z.array(z.enum(EVIDENCE_SCOPES)).min(1).max(14),
  governanceNote: z.string().trim().min(40).max(2000),
}).strict();
export const sprintReceiptSchema = z.object({
  payload: z.object({
    protocol: z.literal("ATANDA-SS-1"), authorityId: z.string().uuid(), workflowId: z.string().uuid(),
    sourceHash: sha, scope: z.enum(EVIDENCE_SCOPES), verdict: z.enum(["PASS", "FAIL", "INCONCLUSIVE"]),
    issuedAt: z.string().datetime(), expiresAt: z.string().datetime(), evidenceHash: sha,
    checks: z.array(z.string().max(100)).max(40),
    facts: sprintEligibilityInputSchema.shape.facts.optional(),
    evalsetHash: sha.optional(), registeredAt: z.string().datetime().optional(),
    manifestHash: sha.optional(), packHash: sha.optional(), sealedManifestHash: sha.optional(), caseId: z.string().uuid().optional(), stage: z.enum(["5", "25", "100"]).optional(),
    producerFamily: z.string().max(100).optional(), verifierFamily: z.string().max(100).optional(),
    reviewerName: z.string().max(120).optional(), remediationStage: z.enum(["F2", "F3", "F4", "F5"]).optional(),
    healthUrl: z.string().url().max(1000).optional(), rollbackReference: z.string().max(500).optional(),
  }).strict(),
  signature: z.string().min(80).max(128).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();
export type SprintReceipt = z.infer<typeof sprintReceiptSchema>;
export const signingMessage = (payload: SprintReceipt["payload"]) => Buffer.from(`ATANDA-SHORT-SPRINTS-1\n${hashContent(payload)}`);
function modelFamily(value: string) {
  const v = value.toLowerCase();
  const families: [RegExp, string][] = [[/^(claude|anthropic)(?:[-_/. ]|$)/, "anthropic"], [/^(openai|gpt|o1|o3|o4)(?:[-_/. ]|$)/, "openai"], [/^(gemini|google)(?:[-_/. ]|$)/, "google"], [/^deepseek(?:[-_/. ]|$)/, "deepseek"], [/^(kimi|moonshot)(?:[-_/. ]|$)/, "moonshot"], [/^(qwen|alibaba)(?:[-_/. ]|$)/, "alibaba"], [/^(glm|zhipu)(?:[-_/. ]|$)/, "zhipu"]];
  return families.find(([pattern]) => pattern.test(v))?.[1] ?? null;
}
export async function registerAuthority(tx: OperationsTx, actor: OperationsActor, raw: unknown) {
  if (actor.role !== "ADMIN") throw new OperationsError(403, "Only an administrator may approve a verifier's public key and scopes.");
  const input = authoritySchema.parse(raw);
  const key = createPublicKey(input.publicKey);
  if (key.asymmetricKeyType !== "ed25519") throw new OperationsError(400, "An Ed25519 public key is required. Never submit a private key.");
  const fingerprint = hashContent(key.export({ type: "spki", format: "pem" }));
  const [authority] = await tx.insert(sprintVerifierAuthoritiesTable).values({ ...input, registeredBy: actor.id, fingerprint }).returning();
  return authority;
}
export async function verifiedSprintReceipt(tx: OperationsTx, input: unknown, subject: { id: string; sourceHash: string; sourceCreatedAt: string; producerFamily: string | null }) {
  const receipt = sprintReceiptSchema.parse(input);
  const p = receipt.payload;
  if (p.workflowId !== subject.id || p.sourceHash !== subject.sourceHash) throw new OperationsError(409, "Evidence belongs to another workflow or source version.");
  const now = Date.now(), issued = Date.parse(p.issuedAt), expires = Date.parse(p.expiresAt);
  if (issued > now + 60_000 || expires <= now || expires <= issued || expires - issued > 31 * 86400_000) throw new OperationsError(409, "Evidence is expired or has an invalid validity window.");
  const [authority] = await tx.select().from(sprintVerifierAuthoritiesTable).where(eq(sprintVerifierAuthoritiesTable.id, p.authorityId));
  if (!authority || authority.revokedAt || !authority.scopes.includes(p.scope)) throw new OperationsError(403, "The signing authority is unavailable, revoked or not approved for this scope.");
  if (!verify(null, signingMessage(p), createPublicKey(authority.publicKey), Buffer.from(receipt.signature, "base64"))) throw new OperationsError(403, "Evidence signature verification failed.");
  const independence = authority.mechanism === "DETERMINISTIC" ? 2 : authority.mechanism === "CROSS_MODEL" ? 1 : 3;
   if (independence === 1 && (!subject.producerFamily || p.producerFamily !== subject.producerFamily || !p.verifierFamily || !modelFamily(p.verifierFamily) || !modelFamily(subject.producerFamily) || modelFamily(p.verifierFamily) === modelFamily(subject.producerFamily))) throw new OperationsError(409, "Cross-model evidence must identify a recognized, genuinely different model family from the saved producer.");
  if (authority.mechanism === "HUMAN" && (!p.reviewerName || p.reviewerName !== authority.name)) throw new OperationsError(409, "Human evidence requires the approved named reviewer.");
  if (["R", "S", "C", "F95"].includes(p.scope) && independence < 2) throw new OperationsError(409, "This scope requires a deterministic tool or independent human, not a model score.");
   if (["H", "F11"].includes(p.scope) && authority.mechanism !== "HUMAN") throw new OperationsError(409, "Human review and F11 release sign-off require an approved independent human.");
  if (p.scope === "J" && authority.mechanism !== "CROSS_MODEL") throw new OperationsError(409, "Track J requires a different-model-family judge.");
  if (p.scope === "E" && (!p.evalsetHash || !p.registeredAt || Date.parse(p.registeredAt) > Date.parse(subject.sourceCreatedAt))) throw new OperationsError(409, "Track E needs an evalset registered before the source artifact, not a retrofitted test.");
  if (p.scope === "SOURCE_CERTIFICATION" && (!p.facts || !["FULL_STAGE_BLOCKING_TRACKS", "SOURCE_VERSION_BOUND", "NO_OPEN_CRITICAL"].every(check => p.checks.includes(check)))) throw new OperationsError(409, "Source certification must explicitly cover the complete stage profile and current critical findings.");
   if (p.scope === "F12" && !p.stage) throw new OperationsError(400, "F12 evidence must identify its 5%, 25% or 100% rollout stage.");
  return { ...receipt, independence, verifiedAt: new Date().toISOString(), receiptHash: hashContent(receipt), authorityName: authority.name };
}
