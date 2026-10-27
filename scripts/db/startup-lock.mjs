import { setTimeout as sleep } from "node:timers/promises";

// Fixed, namespaced two-int key. All cooperating ARK runners for this database
// must use the same key, on the same session that executes the migrations.
const LOCK_KEY = [1095912241, 1];

export async function withStartupLock(
  client,
  work,
  { timeoutMs = 60000, now = () => performance.now(), pause = sleep } = {},
) {
  const deadline = now() + timeoutMs;
  let acquired = false;
  try {
    while (!acquired) {
      const { rows } = await client.query(
        "SELECT pg_try_advisory_lock($1, $2) AS acquired", LOCK_KEY,
      );
      acquired = rows[0]?.acquired === true;
      if (acquired) break;
      const remaining = deadline - now();
      if (remaining <= 0) {
        throw Object.assign(
          new Error("ARK startup lock timed out; no migrations or password update attempted."),
          { code: "ARK_STARTUP_LOCK_TIMEOUT" },
        );
      }
      await pause(Math.min(250, remaining));
    }
    return await work();
  } finally {
    if (acquired) {
      await client.query("SELECT pg_advisory_unlock($1, $2)", LOCK_KEY);
    }
  }
}
