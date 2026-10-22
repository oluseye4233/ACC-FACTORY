import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, internalReviewStepsTable, usersTable } from "@workspace/db";
import { CostBudgetExceededError } from "../cost-budget";
import { recoverableInternalReview } from "./internal-review-recovery";

const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../engines/shared", () => ({ callLlmJson: mock.call }));
describe("durable private internal model step recovery", () => {
  let owner: string;
  const schema = z.object({ answer: z.string() });
  beforeAll(async () => {
    const [user] = await db.insert(usersTable).values({
      clerkUserId: `internal-recovery-${randomUUID()}`, email: `internal-recovery-${randomUUID()}@example.test`,
    }).returning();
    owner = user!.id;
  });
  beforeEach(() => { mock.call.mockReset(); mock.call.mockResolvedValue({ answer: "reviewed" }); });
  afterAll(async () => {
    if (!owner) return;
    await db.delete(internalReviewStepsTable).where(eq(internalReviewStepsTable.userId, owner));
    await db.delete(usersTable).where(eq(usersTable.id, owner));
  });
  const run = (prompt: string, engineId = -201) => recoverableInternalReview("claude", "Bounded internal review",
    prompt, schema, { userId: owner, sessionId: null, engineId });
  it("reuses a completed response across requests without another provider call", async () => {
    const prompt = randomUUID();
    expect(await run(prompt)).toEqual({ answer: "reviewed" });
    expect(await run(prompt)).toEqual({ answer: "reviewed" });
    expect(mock.call).toHaveBeenCalledTimes(1);
  });
  it("resumes SOCRATES after a budget denial without repeating completed KLARITY", async () => {
    const prompt = randomUUID();
    await run(prompt, -201);
    mock.call.mockRejectedValueOnce(new CostBudgetExceededError({ status: 402, body: { error: "Budget denied" } } as never));
    await expect(run(prompt, -202)).rejects.toThrow("Budget denied");
    await run(prompt, -201); await run(prompt, -202);
    expect(mock.call.mock.calls.map(c => c[4].engineId)).toEqual([-201, -202, -202]);
  });
  it("refuses to repeat a provider dispatch whose outcome is unknown", async () => {
    const prompt = randomUUID();
    mock.call.mockRejectedValueOnce(new Error("Provider connection lost"));
    await expect(run(prompt)).rejects.toThrow("connection lost");
    await expect(run(prompt)).rejects.toThrow("unknown outcome");
    expect(mock.call).toHaveBeenCalledTimes(1);
  });
  it("prevents simultaneous requests from charging twice", async () => {
    const prompt = randomUUID();
    let finish!: (value: { answer: string }) => void, started!: () => void;
    const dispatched = new Promise<void>(resolve => { started = resolve; });
    mock.call.mockImplementationOnce(() => { started(); return new Promise(resolve => { finish = resolve; }); });
    const first = run(prompt);
    try {
      await dispatched;
      await expect(run(prompt)).rejects.toThrow("still running");
    } finally { finish({ answer: "once" }); }
    expect(await first).toEqual({ answer: "once" });
    expect(await run(prompt)).toEqual({ answer: "once" });
    expect(mock.call).toHaveBeenCalledTimes(1);
  });
  it("does not reuse evidence after the exact source/prompt changes", async () => {
    const prompt = randomUUID();
    await run(prompt); await run(`${prompt}:corrected source`);
    expect(mock.call).toHaveBeenCalledTimes(2);
  });
});
