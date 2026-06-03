import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";

/**
 * Seed the F1000 ("First 1000") soft-launch invite pool: exactly 1000 rows,
 * seq 1..1000, each with an unguessable single-use code of the form
 * `F1000-<seq padded to 4>-<random base32>`. Idempotent: existing seqs are
 * left untouched (ON CONFLICT DO NOTHING), so re-running only fills gaps and
 * never regenerates a code that may already be issued/redeemed.
 */

const TOTAL = 1000;
// Crockford base32 alphabet (no I/L/O/U → unambiguous when printed/scanned).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomToken(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

function makeCode(seq: number): string {
  const seg = (): string => randomToken(5);
  return `F1000-${String(seq).padStart(4, "0")}-${seg()}-${seg()}`;
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const before = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM command_centre_f1000_invites`,
    );
    console.log(`[seed-f1000] existing rows: ${before.rows[0]?.count ?? "0"}`);

    let inserted = 0;
    for (let seq = 1; seq <= TOTAL; seq++) {
      const res = await client.query(
        `INSERT INTO command_centre_f1000_invites (seq, code, status)
         VALUES ($1, $2, 'available')
         ON CONFLICT (seq) DO NOTHING`,
        [seq, makeCode(seq)],
      );
      inserted += res.rowCount ?? 0;
    }

    const after = await client.query<{ count: string; available: string }>(
      `SELECT COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE status = 'available')::text AS available
         FROM command_centre_f1000_invites`,
    );
    console.log(
      `[seed-f1000] inserted ${inserted} new code(s); ` +
        `total=${after.rows[0]?.count} available=${after.rows[0]?.available}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed-f1000] failed:", err);
  process.exit(1);
});
