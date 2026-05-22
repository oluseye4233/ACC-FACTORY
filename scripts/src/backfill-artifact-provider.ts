import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    const before = await client.query<{ total: string; missing: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE provider IS NULL OR model_id IS NULL)::text AS missing
         FROM harness_artifacts`,
    );
    const totalRow = before.rows[0];
    console.log(
      `[backfill] harness_artifacts: total=${totalRow.total} missing_provider_or_model=${totalRow.missing}`,
    );

    const result = await client.query<{
      id: string;
      session_id: string;
      feature_id: number;
      provider: string;
      model_id: string;
    }>(
      `WITH candidates AS (
         SELECT a.id AS artifact_id,
                a.session_id,
                a.feature_id,
                r.provider,
                r.model_id
           FROM harness_artifacts a
           JOIN LATERAL (
             SELECT provider, model_id
               FROM harness_engine_runs r
              WHERE r.session_id = a.session_id
                AND r.engine_id = a.feature_id
                AND r.created_at <= a.created_at
              ORDER BY r.created_at DESC
              LIMIT 1
           ) r ON TRUE
          WHERE a.provider IS NULL OR a.model_id IS NULL
       )
       UPDATE harness_artifacts a
          SET provider = COALESCE(a.provider, c.provider),
              model_id = COALESCE(a.model_id, c.model_id)
         FROM candidates c
        WHERE a.id = c.artifact_id
          AND (a.provider IS NULL OR a.model_id IS NULL)
        RETURNING a.id, a.session_id, a.feature_id, a.provider, a.model_id`,
    );

    console.log(`[backfill] updated ${result.rowCount ?? 0} artifact row(s)`);
    for (const row of result.rows) {
      console.log(
        `[backfill]   artifact=${row.id} session=${row.session_id} feature=${row.feature_id} provider=${row.provider} model=${row.model_id}`,
      );
    }

    const after = await client.query<{ missing: string }>(
      `SELECT COUNT(*) FILTER (WHERE provider IS NULL OR model_id IS NULL)::text AS missing
         FROM harness_artifacts`,
    );
    console.log(
      `[backfill] remaining missing after run: ${after.rows[0].missing}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[backfill] failed", err);
  process.exitCode = 1;
  void pool.end();
});
