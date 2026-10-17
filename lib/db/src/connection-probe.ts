import pg from "pg";

// Separate from application transactions. Bound acquisition and query time so
// a frozen/unreachable database cannot exhaust the request pool via health checks.
const probePool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 1500,
  query_timeout: 2000,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: true,
});
probePool.on("error", () => {
  // The next probe reports unavailable; never expose provider credentials.
});
export async function probeDatabaseConnection() {
  return probePool.query("SELECT 1");
}
