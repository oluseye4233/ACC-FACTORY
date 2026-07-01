#!/usr/bin/env tsx
/**
 * Universal SKU Catalog backfill (D24 · SKU-004).
 *
 * Assigns a canonical SKU to every SKU-eligible harness artifact (SPC, MVP_PDD)
 * that predates the catalog and is still missing one. Runs in oldest-first
 * batches of 500 so the assigned sequence numbers follow real publish order,
 * and mints each row through the same sku_sequences upsert the live publish path
 * uses — so backfilled and freshly-minted SKUs share one monotonic counter with
 * no collisions.
 *
 * Idempotent: rows that already have a SKU are skipped. Exits non-zero if any
 * eligible row remains without a SKU after the run so a partial backfill is
 * surfaced rather than silently swallowed.
 *
 * Required env:
 *   - DATABASE_URL
 */
import { createHash } from "node:crypto";
import { pool } from "@workspace/db";

const BATCH_SIZE = 500;
const DEFAULT_SECTOR = "GEN";
const DEFAULT_VERSION = 1;
const SKU_TYPE_BY_ARTIFACT: Record<string, string> = {
  SPC: "SPC",
  MVP_PDD: "PDD",
};
const ELIGIBLE_TYPES = Object.keys(SKU_TYPE_BY_ARTIFACT);

function computeCreatorHash(clerkUserId: string, email: string | null): string {
  return createHash("sha256")
    .update(`${clerkUserId}${email ?? ""}`)
    .digest("hex")
    .slice(0, 6);
}

function formatSku(productType: string, sector: string, creatorHash: string, seq: number): string {
  return `ARK-${productType}-${sector}-${creatorHash}-${String(seq).padStart(4, "0")}-V${DEFAULT_VERSION}`;
}

async function main() {
  const client = await pool.connect();
  const creatorHashCache = new Map<string, string>();

  async function resolveCreatorHash(userId: string): Promise<string> {
    const cached = creatorHashCache.get(userId);
    if (cached) return cached;
    const res = await client.query<{
      creator_hash: string | null;
      clerk_user_id: string;
      email: string | null;
    }>(
      `SELECT creator_hash, clerk_user_id, email FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error(`Cannot backfill SKU: user ${userId} not found`);
    let hash = row.creator_hash;
    if (!hash) {
      hash = computeCreatorHash(row.clerk_user_id, row.email);
      await client.query(`UPDATE users SET creator_hash = $1 WHERE id = $2`, [hash, userId]);
    }
    creatorHashCache.set(userId, hash);
    return hash;
  }

  async function nextSequence(
    creatorHash: string,
    productType: string,
    sector: string,
  ): Promise<number> {
    const res = await client.query<{ seq: number }>(
      `INSERT INTO sku_sequences (creator_hash, product_type, sector, seq)
         VALUES ($1, $2, $3, 1)
       ON CONFLICT (creator_hash, product_type, sector)
         DO UPDATE SET seq = sku_sequences.seq + 1
       RETURNING seq`,
      [creatorHash, productType, sector],
    );
    return res.rows[0].seq;
  }

  try {
    console.log(`[backfill-skus] eligible types: ${ELIGIBLE_TYPES.join(", ")}`);
    let totalUpdated = 0;
    for (;;) {
      const batch = await client.query<{
        id: string;
        user_id: string;
        artifact_type: string;
      }>(
        `SELECT id, user_id, artifact_type
           FROM harness_artifacts
          WHERE sku IS NULL
            AND artifact_type = ANY($1)
          ORDER BY created_at ASC
          LIMIT $2`,
        [ELIGIBLE_TYPES, BATCH_SIZE],
      );

      if (batch.rows.length === 0) break;

      for (const row of batch.rows) {
        const productType = SKU_TYPE_BY_ARTIFACT[row.artifact_type];
        if (!productType) continue;
        const creatorHash = await resolveCreatorHash(row.user_id);
        const seq = await nextSequence(creatorHash, productType, DEFAULT_SECTOR);
        const sku = formatSku(productType, DEFAULT_SECTOR, creatorHash, seq);
        await client.query(`UPDATE harness_artifacts SET sku = $1 WHERE id = $2`, [sku, row.id]);
        totalUpdated += 1;
      }
      console.log(
        `[backfill-skus] processed batch of ${batch.rows.length} (running total ${totalUpdated})`,
      );
      if (batch.rows.length < BATCH_SIZE) break;
    }

    const remaining = await client.query<{ missing: string }>(
      `SELECT COUNT(*)::text AS missing
         FROM harness_artifacts
        WHERE sku IS NULL AND artifact_type = ANY($1)`,
      [ELIGIBLE_TYPES],
    );
    const missing = Number(remaining.rows[0].missing);
    console.log(
      `[backfill-skus] assigned ${totalUpdated} SKU(s); remaining eligible without SKU: ${missing}`,
    );
    if (missing > 0) {
      throw new Error(`${missing} eligible artifact(s) still missing a SKU after backfill`);
    }
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[backfill-skus] failed", err);
    process.exitCode = 1;
    void pool.end();
  });
