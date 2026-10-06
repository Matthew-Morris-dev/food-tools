type Per100g = { kcal: number; protein: number; carbs: number; fat: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function forGrams(food: Per100g, grams: number) {
  const f = grams / 100;
  return {
    kcal: round1(food.kcal * f),
    protein: round1(food.protein * f),
    carbs: round1(food.carbs * f),
    fat: round1(food.fat * f),
  };
}
