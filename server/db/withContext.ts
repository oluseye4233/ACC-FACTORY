// =============================================================================
// server/db/withContext.ts — the ONLY way server code may touch the ARK schemas.
// Opens a transaction as ark_app_login, sets the request context from the
// verified Clerk session (transaction-local), then runs the work.
// =============================================================================
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

// APP_DATABASE_URL connects as ark_app_login, never as the database owner.
const pool = new pg.Pool({ connectionString: process.env.APP_DATABASE_URL, max: 10 });
export const appDb = drizzle(pool);

export type ArkContext = {
  orgId: string;          // uuid of the organisation (from Clerk org claim)
  userId: string;         // Clerk user id of the human making the request
  roles: Array<"publisher" | "approver" | "sphinx_approver">;
};

type Tx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

export async function withContext<T>(ctx: ArkContext, work: (tx: Tx) => Promise<T>): Promise<T> {
  if (!ctx.orgId || !ctx.userId) throw new Error("ARK context requires orgId and userId");
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.org_id',     ${ctx.orgId},            true),
             set_config('app.user_id',    ${ctx.userId},           true),
             set_config('app.user_roles', ${ctx.roles.join(",")},  true)`);
    return work(tx);
  });
}

// Express usage (Clerk):
//   app.post("/api/imprima/jobs", requireAuth(), async (req, res) => {
//     const { userId, orgId, sessionClaims } = getAuth(req);
//     const roles = (sessionClaims?.ark_roles as ArkContext["roles"]) ?? [];
//     const job = await withContext({ orgId: orgId!, userId: userId!, roles }, (tx) =>
//       tx.execute(sql`INSERT INTO imprima.publish_jobs (...) VALUES (...) RETURNING job_id`));
//     res.json(job.rows[0]);
//   });
