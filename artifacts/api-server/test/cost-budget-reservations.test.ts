import { afterEach, describe, expect, it, vi } from "vitest";
import { db, costBudgetReservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CostBudgetExceededError,
  currentMonthCostGlobalWithReservations,
  releaseCostBudgetReservation,
  reserveCostBudget,
} from "../src/lib/cost-budget";
import { sendProviderTierError } from "../src/engines/shared";

describe("monthly cost-budget reservations", () => {
  const originalCap = process.env.STAFF_MONTHLY_COST_CAP_USD;
  const createdReservationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdReservationIds.splice(0).map((id) => releaseCostBudgetReservation(id)),
    );
    if (originalCap === undefined) delete process.env.STAFF_MONTHLY_COST_CAP_USD;
    else process.env.STAFF_MONTHLY_COST_CAP_USD = originalCap;
  });

  it("admits only one concurrent call against the same near-cap balance", async () => {
    const usedBefore = await currentMonthCostGlobalWithReservations();
    process.env.STAFF_MONTHLY_COST_CAP_USD = String(usedBefore + 0.25);

    const results = await Promise.all([
      reserveCostBudget(0.2),
      reserveCostBudget(0.2),
    ]);
    const granted = results.filter((result) => result.ok);
    const denied = results.filter((result) => !result.ok);
    createdReservationIds.push(
      ...granted.map((result) => (result.ok ? result.reservationId : "")),
    );

    expect(granted).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(await currentMonthCostGlobalWithReservations()).toBeGreaterThanOrEqual(usedBefore + 0.2);
  });

  it("releases a reservation when the provider call fails", async () => {
    const usedBefore = await currentMonthCostGlobalWithReservations();
    process.env.STAFF_MONTHLY_COST_CAP_USD = String(usedBefore + 1);

    const result = await reserveCostBudget(0.2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdReservationIds.push(result.reservationId);

    await releaseCostBudgetReservation(result.reservationId);
    const rows = await db
      .select({ id: costBudgetReservationsTable.id })
      .from(costBudgetReservationsTable)
      .where(eq(costBudgetReservationsTable.id, result.reservationId));
    expect(rows).toHaveLength(0);
  });

  it("returns the standard 402 response when a reservation cannot be granted", () => {
    const denial = {
      status: 402 as const,
      body: {
        error: "Monthly LLM cost cap reached" as const,
        code: "COST_CAP_EXCEEDED" as const,
        usedUsd: 9.9,
        capUsd: 10,
        detail: "Insufficient remaining balance.",
      },
    };
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    expect(
      sendProviderTierError(
        response as unknown as import("express").Response,
        new CostBudgetExceededError(denial),
      ),
    ).toBe(true);
    expect(response.status).toHaveBeenCalledWith(402);
    expect(response.json).toHaveBeenCalledWith(denial.body);
  });
});