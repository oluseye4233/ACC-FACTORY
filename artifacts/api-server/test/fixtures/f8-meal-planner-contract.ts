// A complete synthetic source contract for cross-provider generation checks.
// These are demonstration prices, not live groceries or nutritional advice.
export const F8_MEAL_CATALOG = [
  { id: "rice-beans", name: "Rice and beans", ingredients: ["rice", "beans"] },
  { id: "tomato-pasta", name: "Tomato pasta", ingredients: ["pasta", "tomato"] },
  { id: "lentil-stew", name: "Lentil stew", ingredients: ["lentils", "tomato"] },
  { id: "vegetable-rice", name: "Vegetable rice", ingredients: ["rice", "mixedVegetables"] },
  { id: "chickpea-couscous", name: "Chickpea couscous", ingredients: ["chickpeas", "couscous"] },
  { id: "potatoes-peas", name: "Potatoes and peas", ingredients: ["potatoes", "peas"] },
  { id: "vegetable-oats", name: "Vegetable oats", ingredients: ["oats", "mixedVegetables"] },
] as const;

export const F8_DEMO_PRICES_CENTS = {
  rice: 25, beans: 50, pasta: 40, tomato: 30, lentils: 45,
  mixedVegetables: 60, chickpeas: 50, couscous: 40, potatoes: 35, peas: 35, oats: 30,
} as const;

export const F8_MEAL_PLANNER_CONTRACT = {
  sections: [
    { key: "objective", title: "Objective", body:
      "Build a client-only React/Vite JavaScript demonstration of seven distinct dinners within a user budget. No backend, LLM recipe generation, database, accounts or external pricing integration." },
    { key: "io", title: "I/O contract", body:
      "Inputs: integer budgetCents >= 0 (default 12000), integer familySize from 1 through 12 (default 4). Each ingredient listed for a meal uses exactly one illustrative portion per person. A portion costs its exact demo unitPriceCents. Output: status, days[], shoppingList[], totalCostCents, requiredBudgetCents. Reject non-integer, missing or out-of-range inputs with a visible error; do not silently clamp." },
    { key: "pricing", title: "Pricing and provenance", body:
      "Use only the exact mealCatalog and demoPricesCents supplied below. They are authoritative synthetic test data, not placeholders to replace or real market prices. No API or further source decision is required for this demonstration. Display 'Demonstration prices only — not live grocery prices or nutritional advice'. Do not infer nutrition, availability or external integrations." },
    { key: "calculation", title: "Calculation", body:
      "Use all seven catalog meals in order, one per day. Ingredient quantity is familySize portions for each occurrence. Aggregate shopping quantities by ingredient; each line cost is quantity * demoPricesCents[ingredient]. Meal cost is the sum of its ingredient costs; totalCostCents is the sum of all seven meals. Use integer cents throughout; never invent prices or reduce quantities to force a passing budget." },
    { key: "success", title: "Success criteria", body:
      "If total cost <= budgetCents, return status='feasible', seven distinct days and the aggregated shoppingList. Otherwise return status='insufficient_budget', empty days and shoppingList, the calculated totalCostCents and requiredBudgetCents, and a visible explanation; never claim a feasible plan. Both outcomes are fully specified behavior, not a request for source clarification. Show the same calculated total in both cases." },
    { key: "examples", title: "Acceptance examples", body:
      "familySize=4 and budgetCents=12000 => feasible, seven days, totalCostCents=2220, requiredBudgetCents=2220. familySize=4 and budgetCents=2219 => insufficient_budget, empty days/shoppingList, totalCostCents=2220, requiredBudgetCents=2220. familySize=0 => visible validation error." },
    { key: "delivery", title: "Delivery scope", body:
      "Editable static JavaScript/JSX source using this contract and the source-bound hosting plan; keep the bundle within twelve files. Include a README explaining setup and manual acceptance checks. Do not claim builds, tests, drift verification or deployment have run. Do not add requirements, services or credentials." },
  ],
  mealCatalog: F8_MEAL_CATALOG,
  demoPricesCents: F8_DEMO_PRICES_CENTS,
  donut: { a: 6, b: 2, c: 1 },
};
