import { forGrams } from "../nutrition";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
type Per100g = Macros;

export type IngredientNutrition = { grams: number; food: Per100g | null };

const round1 = (n: number) => Math.round(n * 10) / 10;
const scale = (m: Macros, factor: number): Macros => ({
  kcal: round1(m.kcal * factor),
  protein: round1(m.protein * factor),
  carbs: round1(m.carbs * factor),
  fat: round1(m.fat * factor),
});

// Whole-recipe nutrition. Ingredients without a food contribute nothing and flag the
// recipe as incomplete.
export function recipeNutrition(
  ingredients: IngredientNutrition[],
  servings: number,
  cookedWeightG: number | null,
) {
  const sum = ingredients.reduce<Macros>(
    (t, i) => {
      if (!i.food) return t;
      const m = forGrams(i.food, i.grams);
      return { kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const totals = scale(sum, 1);
  return {
    totals,
    perServing: scale(sum, 1 / servings),
    // Per 100 g of the finished dish, when it has been weighed
    per100gCooked: cookedWeightG ? scale(sum, 100 / cookedWeightG) : null,
    incomplete: ingredients.some((i) => !i.food),
  };
}

// What logging a portion adds to the diary: some servings, or a weight of the cooked dish
export function portion(
  totals: Macros,
  servings: number,
  cookedWeightG: number | null,
  amount: { servings: number } | { grams: number },
) {
  if ("grams" in amount) {
    if (!cookedWeightG) throw new Error("This recipe has no cooked weight");
    return { macros: scale(totals, amount.grams / cookedWeightG), grams: amount.grams };
  }
  const fraction = amount.servings / servings;
  return {
    macros: scale(totals, fraction),
    // Weight of that many servings, when the dish has been weighed
    grams: cookedWeightG ? round1(cookedWeightG * fraction) : null,
  };
}
