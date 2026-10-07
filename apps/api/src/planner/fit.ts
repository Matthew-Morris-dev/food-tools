// Portion scaling: nudge a day's flexible meals so its calories land on the target.

export type FitItem = {
  id: string;
  // Calories of the entry at its current servings
  kcal: number;
  servings: number;
  // False for locked entries, single foods, meals already eaten and leftovers: those stay as they are
  flexible: boolean;
};

export type FitResult = {
  changes: { id: string; servings: number }[];
  resultKcal: number;
  // True when the limits stopped the day reaching its target
  clamped: boolean;
};

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2;
const STEP = 0.25;

const roundStep = (n: number) => Math.max(STEP, Math.round(n / STEP) * STEP);

export function fitDay(items: FitItem[], targetKcal: number): FitResult {
  const fixed = items.filter((i) => !i.flexible).reduce((s, i) => s + i.kcal, 0);
  const flexible = items.filter((i) => i.flexible && i.servings > 0 && i.kcal > 0);
  const flexKcal = flexible.reduce((s, i) => s + i.kcal, 0);
  if (flexible.length === 0) return { changes: [], resultKcal: Math.round(fixed), clamped: Math.abs(fixed - targetKcal) > targetKcal * 0.03 };

  const wanted = (targetKcal - fixed) / flexKcal;
  const factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, wanted));
  let result = fixed;
  const changes: FitResult["changes"] = [];
  for (const item of flexible) {
    const servings = roundStep(item.servings * factor);
    result += (item.kcal / item.servings) * servings;
    if (servings !== item.servings) changes.push({ id: item.id, servings });
  }
  return { changes, resultKcal: Math.round(result), clamped: Math.abs(result - targetKcal) > targetKcal * 0.03 };
}
