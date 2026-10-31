import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, autoCommandOrdersTable as orders, autoCommandStepsTable as steps } from "@workspace/db";
import { governanceHash } from "../artifact-governance";
import { AUTO_COMMAND_READINESS } from "./catalog";
import { autoCommandPlan, AUTO_COMMAND_PLAN_VERSION } from "./plan";
import { snapshotInput } from "./orders";
import type { AutoCommandInput } from "./intake";

const Evidence = z.object({ artifactIds: z.array(z.uuid()).min(1).max(20) }).strict();
type Evidence = z.infer<typeof Evidence>;
export type AutoCommandStageAdapter = (context: {
  orderId: string; stepKey: string; dispatchKey: string; input: AutoCommandInput;
  previous: { key: string; artifactIds: string[] }[];
}) => Promise<Evidence>;
type Dependencies = {
  /** Trusted server integration only. Must verify a durable paid/free-order grant. */
  authorize: (orderId: string) => Promise<boolean>;
  adapters: Readonly<Record<string, AutoCommandStageAdapter>>;
};

/**
 * Server-only sequential runner. No HTTP dispatch route, timer, payment grant or
 * production adapters are installed yet. The catalog gate stays closed.
 * Unknown outcomes stop for review; neither elapsed time nor a second caller
 * grants permission to redispatch.
 */
export async function runAutoCommandPipeline(orderId: string, dependencies: Dependencies) {
  if (!AUTO_COMMAND_READINESS.automaticProductionEnabled) return "DISABLED" as const;
  for (;;) {
    if (!await dependencies.authorize(orderId)) return "NOT_AUTHORIZED" as const;
    const claim = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`autocommand-run:${orderId}`}, 0))`);
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { stop: "NOT_FOUND" } as const;
      if (order.state === "REVIEW_REQUIRED") return { stop: "REVIEW_REQUIRED" } as const;
      const saved = await tx.select().from(steps).where(eq(steps.orderId, orderId)).orderBy(asc(steps.position));
      const next = saved.find(step => step.state !== "COMPLETE");
      const expected = autoCommandPlan(snapshotInput(order).packageType);
      const planMatches = saved.length === expected.length && saved.every((step, position) =>
        step.position === position && step.key === expected[position]!.key);
      const priorEvidenceValid = saved.filter(step => step.state === "COMPLETE" && step.key !== "F1")
        .every(step => Evidence.safeParse(step.evidence).success);
      if (!planMatches || !priorEvidenceValid || order.planVersion !== AUTO_COMMAND_PLAN_VERSION ||
          governanceHash(order.snapshot) !== order.snapshotHash) {
        await tx.update(orders).set({ state: "REVIEW_REQUIRED" }).where(eq(orders.id, orderId));
        return { stop: "REVIEW_REQUIRED" } as const;
      }
      if (!next) {
        // Generation completion is not publication authorization or email delivery.
        await tx.update(orders).set({ state: "AWAITING_PUBLICATION" }).where(eq(orders.id, orderId));
        return { stop: "AWAITING_PUBLICATION" } as const;
      }
      if (next.state === "DISPATCHING") return { stop: "IN_FLIGHT_OR_UNCERTAIN" } as const;
      if (next.state !== "PENDING") return { stop: "REVIEW_REQUIRED" } as const;
      if (!dependencies.adapters[next.key]) return { stop: "ADAPTER_UNAVAILABLE" } as const;
      const token = randomUUID();
      await tx.update(steps).set({ state: "DISPATCHING", claimToken: token, startedAt: new Date() })
        .where(eq(steps.id, next.id));
      await tx.update(orders).set({ state: "RUNNING" }).where(eq(orders.id, orderId));
      return { order, next, token, previous: saved.filter(step => step.state === "COMPLETE" && step.key !== "F1")
        .map(step => ({ key: step.key, artifactIds: Evidence.parse(step.evidence).artifactIds })) };
    });
    if ("stop" in claim) return claim.stop;
    try {
      const evidence = Evidence.parse(await dependencies.adapters[claim.next.key]!({
        orderId, stepKey: claim.next.key, dispatchKey: claim.next.id,
        input: snapshotInput(claim.order), previous: claim.previous,
      }));
      // An adapter returns only after its immutable artifacts have been saved.
      const saved = await db.update(steps).set({
        state: "COMPLETE", evidence, completedAt: new Date(),
      }).where(and(eq(steps.id, claim.next.id), eq(steps.claimToken, claim.token),
        eq(steps.state, "DISPATCHING"))).returning({ id: steps.id });
      if (!saved.length) return "REVIEW_REQUIRED" as const;
    } catch {
      await db.transaction(async tx => {
        const changed = await tx.update(steps).set({ state: "REVIEW_REQUIRED" })
          .where(and(eq(steps.id, claim.next.id), eq(steps.claimToken, claim.token),
            eq(steps.state, "DISPATCHING"))).returning({ id: steps.id });
        if (changed.length) await tx.update(orders).set({ state: "REVIEW_REQUIRED" }).where(eq(orders.id, orderId));
      });
      return "REVIEW_REQUIRED" as const;
    }
  }
}
