import { describe, expect, it } from "vitest";

import { portion, recipeNutrition } from "./nutrition";

const oil = { kcal: 900, protein: 0, carbs: 0, fat: 100 };
const rice = { kcal: 350, protein: 7, carbs: 78, fat: 1 };

describe("recipeNutrition", () => {
  const ingredients = [
    { grams: 20, food: oil },
    { grams: 300, food: rice },
  ];

  it("sums the ingredients and divides by servings", () => {
    const n = recipeNutrition(ingredients, 4, null);
    expect(n.totals).toEqual({ kcal: 1230, protein: 21, carbs: 234, fat: 23 });
    expect(n.perServing.kcal).toBe(307.5);
    expect(n.per100gCooked).toBeNull();
    expect(n.incomplete).toBe(false);
  });

  it("gives nutrition per 100 g of the cooked dish when it has a weight", () => {
    // 1,230 kcal in 900 g cooked
    expect(recipeNutrition(ingredients, 4, 900).per100gCooked?.kcal).toBe(136.7);
  });

  it("flags unmatched ingredients and counts them as zero", () => {
    const n = recipeNutrition([...ingredients, { grams: 50, food: null }], 4, null);
    expect(n.incomplete).toBe(true);
    expect(n.totals.kcal).toBe(1230);
  });
});

describe("portion", () => {
  const totals = { kcal: 1200, protein: 80, carbs: 120, fat: 40 };

  it("logs a number of servings, with its weight if the dish was weighed", () => {
    expect(portion(totals, 4, 1000, { servings: 2 })).toEqual({
      macros: { kcal: 600, protein: 40, carbs: 60, fat: 20 },
      grams: 500,
    });
    expect(portion(totals, 4, null, { servings: 1 }).grams).toBeNull();
  });

  it("logs a weight of the cooked dish", () => {
    expect(portion(totals, 4, 1000, { grams: 250 })).toEqual({
      macros: { kcal: 300, protein: 20, carbs: 30, fat: 10 },
      grams: 250,
    });
  });

  it("refuses grams for a dish that wasn't weighed", () => {
    expect(() => portion(totals, 4, null, { grams: 250 })).toThrow();
  });
});
