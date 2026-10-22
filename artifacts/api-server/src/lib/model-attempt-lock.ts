import { pool } from "@workspace/db";

/** Cross-instance, session-owned lock. A slow provider is never replaced by age. */
export async function lockModelAttempt(key: string) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [key],
    );
    if (!rows[0]?.locked) { client.release(); return null; }
    let released = false;
    // A lost lock connection must not crash the API. Durable STARTED intent
    // prevents a new worker from repeating an uncertain provider dispatch.
    let broken = false;
    const lost = () => { broken = true; };
    client.on("error", lost);
    return async () => {
      if (released) return;
      released = true;
      try {
        if (!broken) await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]);
        client.removeListener("error", lost); client.release(broken);
      } catch { client.removeListener("error", lost); client.release(true); }
    };
  } catch (err) { client.release(true); throw err; }
}
