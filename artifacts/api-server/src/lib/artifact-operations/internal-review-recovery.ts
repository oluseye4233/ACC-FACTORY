import type { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, internalReviewStepsTable } from "@workspace/db";
import { callLlmJson, type RunContext } from "../../engines/shared";
import { CostBudgetExceededError } from "../cost-budget";
import { lockModelAttempt } from "../model-attempt-lock";
import { boomerangHash } from "../boomerang";
import { OperationsError } from "./context";

/** The exact prompt, provider and verified owner define a billable step.
 * Completed steps are replayed; uncertain dispatches are never repeated.
 */
export async function recoverableInternalReview<T>(
  provider: "claude" | "openai" | "gemini", system: string, prompt: string,
  schema: z.ZodType<T>, context: RunContext,
): Promise<T> {
  const inputHash = boomerangHash({ provider, system, prompt, sessionId: context.sessionId, engineId: context.engineId });
  const id = boomerangHash({ purpose: "IMPRIMA_INTERNAL_REVIEW", userId: context.userId, inputHash });
  const unlock = await lockModelAttempt(`internal-review:${id}`);
  if (!unlock) throw new OperationsError(409, "This internal review step is still running. Wait, then retry the same saved source and options.", "INTERNAL_REVIEW_BUSY");
  try {
    await db.insert(internalReviewStepsTable).values({ id, userId: context.userId, inputHash }).onConflictDoNothing();
    const ownerFilter = and(eq(internalReviewStepsTable.id, id), eq(internalReviewStepsTable.userId, context.userId));
    const [row] = await db.select().from(internalReviewStepsTable).where(ownerFilter);
    if (!row || row.inputHash !== inputHash) throw new OperationsError(409, "Internal review checkpoint does not match its source.");
    if (row.phase === "COMPLETE") return schema.parse(row.result);
    if (row.phase !== "READY") throw new OperationsError(409,
      "An earlier internal review dispatch has an unknown outcome. No model call was repeated. Review the model run ledger before authorizing a new assessment from a corrected saved source.",
      "INTERNAL_REVIEW_OUTCOME_UNKNOWN");
    await db.update(internalReviewStepsTable).set({ phase: "STARTED", updatedAt: new Date() }).where(ownerFilter);
    let result: T;
    try { result = schema.parse(await callLlmJson(provider, system, prompt, schema, context)); }
    catch (err) {
      if (err instanceof CostBudgetExceededError) {
        await db.update(internalReviewStepsTable).set({ phase: "READY", updatedAt: new Date() }).where(ownerFilter);
      }
      throw err;
    }
    await db.update(internalReviewStepsTable).set({ phase: "COMPLETE", result, updatedAt: new Date() }).where(ownerFilter);
    return result;
  } finally { await unlock(); }
}
