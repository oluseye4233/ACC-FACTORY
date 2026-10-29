/**
 * Explicitly approved, three-call activation check. Uses the real budget gate
 * and spend ledger, not Vitest's budget-isolated/offline SDK mocks.
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod/v4";
import { db, pool, usersTable, commandCentreSubscribersTable } from "@workspace/db";
import { callLlmJson, PROVIDER_MODELS } from "../src/engines/shared";
import { requireCostBudget } from "../src/lib/cost-budget";

async function main() {
  if (process.argv[2] !== "--approved-three") {
    throw new Error("Requires explicit authorization for three paid model checks.");
  }
  const stamp = randomUUID();
  // Do not use @example.test: test janitors must not erase real paid usage.
  const [user] = await db.insert(usersTable).values({
    clerkUserId: `managed_model_check_${stamp}`,
    email: `managed-model-check-${stamp}@example.invalid`,
    displayName: "Managed model activation check",
  }).returning();
  if (!user) throw new Error("Activation check actor could not be created.");
  const [subscriber] = await db.insert(commandCentreSubscribersTable).values({
    userId: user.id, tier: "PRACTITIONER", status: "active",
  }).returning();
  if (!subscriber) throw new Error("Activation check subscriber could not be created.");

  let failed = false;
  for (const provider of ["deepseek", "kimi", "qwen"] as const) {
    let allowed = false;
    let denial = 0;
    await requireCostBudget(
      { localUser: user, subscriber } as Request,
      {
        status(code: number) { denial = code; return this; },
        json() { return this; },
      } as unknown as Response,
      () => { allowed = true; },
    );
    if (!allowed) {
      throw new Error(`Budget gate denied activation checks (HTTP ${denial}). No bypass attempted.`);
    }
    try {
      const output = await callLlmJson(provider,
        'Return only the JSON object {"status":"ok","language":"javascript"}. No commentary.',
        "Confirm this basic structured-output connection check.",
        z.object({ status: z.literal("ok"), language: z.literal("javascript") }),
        { sessionId: null, userId: user.id, engineId: -1 },
      );
      console.log(`${provider}: PASS; model=${PROVIDER_MODELS[provider]}; status=${output.status}; usage recorded`);
    } catch (error) {
      failed = true;
      // Never dump SDK request objects, headers, keys or response bodies.
      const err = error as { name?: string; code?: string; status?: number };
      console.log(`${provider}: FAIL; error=${err.name ?? "Error"}; code=${err.code ?? "none"}; HTTP=${err.status ?? "n/a"}`);
    }
  }
  if (failed) process.exitCode = 1;
}
main().catch(error => {
  // Our own preflight failures have no credential-bearing payload.
  console.error(error instanceof Error ? error.message : "Activation preflight failed.");
  process.exitCode = 1;
}).finally(() => pool.end());
