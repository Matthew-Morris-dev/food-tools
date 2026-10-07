import { forGrams } from "../nutrition";
import type { Macros } from "../recipes/nutrition";

// A planned meal's nutrition, from the live recipe or food it points at
export type PlanItem = {
  servings: number | null;
  grams: number | null;
  recipe: { perServing: Macros } | null;
  food: Macros | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function entryMacros(item: PlanItem): Macros {
  if (item.recipe && item.servings) {
    const f = item.servings;
    const m = item.recipe.perServing;
    return { kcal: round1(m.kcal * f), protein: round1(m.protein * f), carbs: round1(m.carbs * f), fat: round1(m.fat * f) };
  }
  if (item.food && item.grams) return forGrams(item.food, item.grams);
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { kcal: round1(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}
