import { describe, expect, it } from "vitest";
import { F8_DEMO_PRICES_CENTS, F8_MEAL_CATALOG, F8_MEAL_PLANNER_CONTRACT } from "./fixtures/f8-meal-planner-contract";

describe("complete F8 provider smoke-test source contract", () => {
  it("supplies seven unique meals with exact positive integer ingredient prices", () => {
    expect(F8_MEAL_CATALOG).toHaveLength(7);
    expect(new Set(F8_MEAL_CATALOG.map(meal => meal.id)).size).toBe(7);
    for (const meal of F8_MEAL_CATALOG) {
      for (const ingredient of meal.ingredients) {
        expect(Number.isInteger(F8_DEMO_PRICES_CENTS[ingredient])).toBe(true);
        expect(F8_DEMO_PRICES_CENTS[ingredient]).toBeGreaterThan(0);
      }
    }
  });
  it("has arithmetically consistent normal and insufficient-budget acceptance examples", () => {
    const perPersonCost = F8_MEAL_CATALOG.reduce((total, meal) =>
      total + meal.ingredients.reduce((sum, ingredient) => sum + F8_DEMO_PRICES_CENTS[ingredient], 0), 0);
    expect(perPersonCost * 4).toBe(2220);
    const examples = F8_MEAL_PLANNER_CONTRACT.sections.find(section => section.key === "examples")!.body;
    expect(examples).toContain("budgetCents=12000 => feasible");
    expect(examples).toContain("budgetCents=2219 => insufficient_budget");
    expect(examples).toContain("requiredBudgetCents=2220");
  });
});
