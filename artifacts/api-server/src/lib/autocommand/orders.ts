import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db, autoCommandDraftsTable as drafts, autoCommandUploadsTable as uploads,
  autoCommandOrdersTable as orders, autoCommandStepsTable as steps,
} from "@workspace/db";
import { AutoCommandError, AutoCommandIntakeSchema, type AutoCommandInput } from "./intake";
import { autoCommandPlan, AUTO_COMMAND_PLAN_VERSION } from "./plan";
import { packageFor } from "./catalog";
import { governanceHash } from "../artifact-governance";

type Order = typeof orders.$inferSelect;
type Step = typeof steps.$inferSelect;
export function orderView(order: Order, stages: Step[]) {
  return {
    id: order.id, draftId: order.draftId, projectName: order.projectName, packageType: order.packageType,
    standardPriceCents: order.standardPriceCents, currency: "USD" as const, state: order.state,
    // No commercial/publication authorization exists in this milestone.
    paymentStatus: "NOT_STARTED" as const, promotionStatus: "NOT_CLAIMED" as const,
    deliveryStatus: "NOT_STARTED" as const, snapshotHash: order.snapshotHash,
    completedStages: stages.filter(stage => stage.state === "COMPLETE").length, totalStages: stages.length,
    stages: stages.map(stage => ({ key: stage.key, title: stage.title, state: stage.state })),
    createdAt: order.createdAt.toISOString(),
  };
}
export async function listAutoCommandOrders(userId: string) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50);
  const stages = rows.length ? await db.select().from(steps).where(inArray(steps.orderId, rows.map(row => row.id)))
    .orderBy(asc(steps.position)) : [];
  return rows.map(row => orderView(row, stages.filter(stage => stage.orderId === row.id)));
}
export async function getAutoCommandOrder(userId: string, id: string) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.id, id))).limit(1);
    if (!row) throw new AutoCommandError(404, "Order unavailable.");
    // Same transaction snapshot for order and progress.
    const stages = await tx.select().from(steps).where(eq(steps.orderId, row.id)).orderBy(asc(steps.position));
    return orderView(row, stages);
  }, { isolationLevel: "repeatable read" });
}
export async function prepareAutoCommandOrder(userId: string, verifiedEmail: string, draftId: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`autocommand-order:${userId}`}, 0))`);
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, draftId), eq(drafts.userId, userId))).limit(1);
    if (!draft) throw new AutoCommandError(404, "Owned draft unavailable.");
    const email = verifiedEmail.trim().toLowerCase();
    if (email !== draft.verifiedEmail) throw new AutoCommandError(409, "Your verified email changed. Save a new intake before preparing an order.");
    const [existing] = await tx.select().from(orders).where(eq(orders.draftId, draft.id)).limit(1);
    if (existing) {
      const saved = await tx.select().from(steps).where(eq(steps.orderId, existing.id)).orderBy(asc(steps.position));
      return orderView(existing, saved);
    }
    const input = AutoCommandIntakeSchema.parse(draft.input);
    const expected = [
      ...(input.documentUploadId ? [{ id: input.documentUploadId, purpose: "DOCUMENT" }] : []),
      ...(input.logoUploadId ? [{ id: input.logoUploadId, purpose: "LOGO" }] : []),
    ];
    const files = expected.length ? await tx.select().from(uploads).where(and(eq(uploads.userId, userId),
      eq(uploads.state, "STORED"), inArray(uploads.id, expected.map(file => file.id)))) : [];
    if (expected.some(file => !files.some(saved => saved.id === file.id && saved.purpose === file.purpose))) {
      throw new AutoCommandError(409, "A source file is no longer available. Save a new intake.");
    }
    const snapshot = { input, files: files.map(file => ({
      id: file.id, purpose: file.purpose, filename: file.filename, contentHash: file.contentHash,
    })).sort((a, b) => a.id.localeCompare(b.id)) };
    const [order] = await tx.insert(orders).values({
      userId, draftId, verifiedEmail: email, projectName: input.projectName, packageType: input.packageType,
      standardPriceCents: packageFor(input.packageType).priceCents,
      snapshot, snapshotHash: governanceHash(snapshot), planVersion: AUTO_COMMAND_PLAN_VERSION,
    }).returning();
    const saved = await tx.insert(steps).values(autoCommandPlan(input.packageType).map((stage, position) => ({
      orderId: order.id, position, ...stage, state: position === 0 ? "COMPLETE" : "PENDING",
      completedAt: position === 0 ? new Date() : null,
      evidence: position === 0 ? { snapshotHash: order.snapshotHash, checks: ["verified_identity", "owned_sources", "valid_intake"] } : null,
    }))).returning();
    return orderView(order, saved.sort((a, b) => a.position - b.position));
  });
}

export function snapshotInput(order: Order): AutoCommandInput {
  return AutoCommandIntakeSchema.parse(order.snapshot.input);
}
