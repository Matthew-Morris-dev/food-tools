import { addDays } from "../dates";

export type Weigh = { date: string; weightKg: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

// Weight trend at a date: the average of weigh-ins in the 7 days up to and including it.
// Single weigh-ins swing with water and food, so targets follow the trend instead.
export function trendAt(weights: Weigh[], date: string, windowDays = 7) {
  const from = addDays(date, -(windowDays - 1));
  const inWindow = weights.filter((w) => w.date >= from && w.date <= date);
  if (inWindow.length === 0) return null;
  return { kg: round1(inWindow.reduce((s, w) => s + w.weightKg, 0) / inWindow.length), count: inWindow.length };
}

export function withTrend(weights: Weigh[]) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => ({ ...w, trendKg: trendAt(sorted, w.date)!.kg }));
}
