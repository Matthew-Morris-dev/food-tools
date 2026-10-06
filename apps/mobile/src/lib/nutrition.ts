import type { Slot } from './types';

type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const SLOTS: { value: Slot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

export const slotLabel = (slot: Slot) => SLOTS.find((s) => s.value === slot)?.label ?? slot;

// A sensible slot for "log something now"
export function slotForNow(now = new Date()): Slot {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 14.5) return 'lunch';
  if (h >= 17 && h < 21) return 'dinner';
  return 'snack';
}

export function forGrams(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return { kcal: per100g.kcal * f, protein: per100g.protein * f, carbs: per100g.carbs * f, fat: per100g.fat * f };
}

export function sum(items: Macros[]): Macros {
  return items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, protein: t.protein + i.protein, carbs: t.carbs + i.carbs, fat: t.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// 1 decimal place below 10, whole numbers above
export function fmt(n: number) {
  const rounded = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return rounded.toLocaleString('en-GB');
}

// Accepts "1,5" as well as "1.5"; returns null for empty or invalid input
export function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}
