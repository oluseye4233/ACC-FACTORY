import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  skuSequencesTable,
  f0ReportCodesTable,
  type ArtifactType,
  type F0ReportCode,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * Universal SKU Catalog (D24).
 *
 * Every published cognitive asset gets one canonical identity — a SKU — so the
 * downstream CAPI pricing, TARANTULA royalty, and BRIJ settlement engines can
 * all key on the same code. SKU format:
 *
 *   ARK-[TYPE:3]-[SECTOR:3]-[CREATORHASH:6]-[SEQ:4]-V[VER]
 *
 * The sequence number is monotonic and unique per (creatorHash, productType,
 * sector) combination; issuance is atomic (see `nextSequence`) so concurrent
 * publishes never collide.
 */

/** Default sector for the MVP. Live CAPI sector indices are deferred (out of scope). */
export const DEFAULT_SECTOR = "GEN";

/** Default SKU version component. Asset versioning is deferred to a later wave. */
export const DEFAULT_SKU_VERSION = 1;

/**
 * SKU-eligible artifact types → their 3-char TYPE code. Only publishable
 * "listing" artifacts carry a SKU: the SPC (F5 / DE) and the certified MVP PDD
 * (F7). Intermediate artifacts (diagnostics, atomic prompts, micro PDDs, etc.)
 * are never catalogued. Extended D24 product types (MCL / SVC / JCC / CMI / ABT)
 * are deferred by SPARTAN to a later wave.
 */
export const SKU_TYPE_BY_ARTIFACT: Partial<Record<ArtifactType, string>> = {
  SPC: "SPC",
  MVP_PDD: "PDD",
};

/** Whether an artifact type should be issued a SKU on publish. */
export function isSkuEligible(artifactType: ArtifactType): boolean {
  return artifactType in SKU_TYPE_BY_ARTIFACT;
}

/**
 * Stable per-creator hash (SKU-001): first 6 hex chars of
 * SHA-256(clerkUserId + email). Pure and deterministic — the same identity
 * always yields the same hash, so it can be regenerated during backfill without
 * a stored value drifting.
 */
export function computeCreatorHash(clerkUserId: string, email: string | null | undefined): string {
  return createHash("sha256")
    .update(`${clerkUserId}${email ?? ""}`)
    .digest("hex")
    .slice(0, 6);
}

/** A stable platform creator hash used for canonical (non-user) catalog entries. */
export const PLATFORM_CREATOR_HASH = computeCreatorHash("ark:platform", null);

export interface FormatSkuInput {
  productType: string;
  sector: string;
  creatorHash: string;
  seq: number;
  version?: number;
}

/** Compose a SKU string from its parts. Pure — no DB access. */
export function formatSku(input: FormatSkuInput): string {
  const seq = String(input.seq).padStart(4, "0");
  const version = input.version ?? DEFAULT_SKU_VERSION;
  return `ARK-${input.productType}-${input.sector}-${input.creatorHash}-${seq}-V${version}`;
}

/**
 * Resolve the creator hash for a user, generating and persisting it on first
 * use if the column is still null (SKU-001). The hash is written once and never
 * rewritten, so it stays stable across every SKU minted for the creator.
 */
export async function getOrCreateCreatorHash(userId: string): Promise<string> {
  const rows = await db
    .select({
      creatorHash: usersTable.creatorHash,
      clerkUserId: usersTable.clerkUserId,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`Cannot issue SKU: user ${userId} not found`);
  if (row.creatorHash) return row.creatorHash;
  const hash = computeCreatorHash(row.clerkUserId, row.email);
  await db.update(usersTable).set({ creatorHash: hash }).where(eq(usersTable.id, userId));
  return hash;
}

/**
 * Atomically claim the next sequence number for a (creatorHash, productType,
 * sector) combination. The upsert increments in a single statement so
 * concurrent publishes each receive a distinct, monotonic number.
 */
export async function nextSequence(
  creatorHash: string,
  productType: string,
  sector: string,
): Promise<number> {
  const rows = await db
    .insert(skuSequencesTable)
    .values({ creatorHash, productType, sector, seq: 1 })
    .onConflictDoUpdate({
      target: [
        skuSequencesTable.creatorHash,
        skuSequencesTable.productType,
        skuSequencesTable.sector,
      ],
      set: { seq: sql`${skuSequencesTable.seq} + 1` },
    })
    .returning({ seq: skuSequencesTable.seq });
  return rows[0]!.seq;
}

export interface IssueSkuOptions {
  sector?: string;
  version?: number;
}

/**
 * Issue a canonical SKU for a user's publishable artifact (SKU-002). Returns
 * null for artifact types that are not SKU-eligible (the caller then persists
 * without a SKU). Collision-safe under concurrent publishes.
 */
export async function issueSku(
  userId: string,
  artifactType: ArtifactType,
  options?: IssueSkuOptions,
): Promise<string | null> {
  const productType = SKU_TYPE_BY_ARTIFACT[artifactType];
  if (!productType) return null;
  const sector = options?.sector ?? DEFAULT_SECTOR;
  const creatorHash = await getOrCreateCreatorHash(userId);
  const seq = await nextSequence(creatorHash, productType, sector);
  return formatSku({ productType, sector, creatorHash, seq, version: options?.version });
}

/**
 * Mint an advisory SKU for an F0 report that has no anchoring artifact SKU
 * (F0-021). The F0 report code must always anchor to a SKU, but boutique
 * engagements can advise on an idea before any SPC / MVP-PDD has been
 * published, so we mint a stable advisory-catalog SKU (product type `F0A`)
 * keyed to the creator. Collision-safe under concurrent report generation.
 */
export async function issueAdvisorySku(userId: string): Promise<string> {
  const productType = "F0A";
  const sector = DEFAULT_SECTOR;
  const creatorHash = await getOrCreateCreatorHash(userId);
  const seq = await nextSequence(creatorHash, productType, sector);
  return formatSku({ productType, sector, creatorHash, seq });
}

/** Compact UTC timestamp (`YYYYMMDDHHmmss`) for the F0 report-code suffix. */
function compactTimestamp(at: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}` +
    `${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}`
  );
}

export interface IssueF0ReportCodeInput {
  userId: string;
  /** The owning SKU the advisory report is anchored to. */
  sku: string;
  /** The short report `[CODE]` component. */
  code: string;
  /** Owning artifact, when the report advises on a specific listing. */
  artifactId?: string | null;
  /** Generation time; defaults to now. */
  at?: Date;
}

/**
 * Assign an F0 advisory report code at report-generation time (F0-021). The
 * reference is formatted `[CODE]-[SKU]-[TIMESTAMP]` and persisted to the
 * registry. Consumed by the F0 Business Intelligence Consulting layer.
 */
export async function issueF0ReportCode(input: IssueF0ReportCodeInput): Promise<F0ReportCode> {
  const at = input.at ?? new Date();
  const reportCode = `${input.code}-${input.sku}-${compactTimestamp(at)}`;
  const rows = await db
    .insert(f0ReportCodesTable)
    .values({
      reportCode,
      code: input.code,
      sku: input.sku,
      artifactId: input.artifactId ?? null,
      userId: input.userId,
      createdAt: at,
    })
    .returning();
  return rows[0]!;
}

/**
 * Best-effort SKU issuance for the persist path: never throws. On failure the
 * artifact is persisted without a SKU (the backfill can repair it later) so a
 * transient catalog error can't lose completed, paid-for engine work.
 */
export async function tryIssueSku(
  userId: string,
  artifactType: ArtifactType,
): Promise<string | null> {
  try {
    return await issueSku(userId, artifactType);
  } catch (err) {
    logger.warn({ err, userId, artifactType }, "SKU issuance failed; persisting artifact without SKU");
    return null;
  }
}
