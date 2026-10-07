import { addDays, daysBetween } from "../dates";
import { roundTo } from "./targets";
import { trendAt, type Weigh } from "./trend";

const KCAL_PER_KG = 7700;
// Weekly rate difference (kg) that still counts as on track
const TOLERANCE_KG = 0.2;
// Never move targets by more than this in one check-in
const MAX_STEP_KCAL = 200;
const MIN_WEIGHINS = 3;
export const CHECK_IN_DAYS = 7;

export type CheckInResult =
  | { status: "insufficient"; message: string; neededWeighIns?: number }
  | { status: "on_track"; observedRateKg: number; plannedRateKg: number; trendKg: number; atFloor?: boolean }
  | {
      status: "adjust";
      observedRateKg: number;
      plannedRateKg: number;
      trendKg: number;
      deltaKcal: number;
      suggestedKcal: number;
    };

// A check-in is due a week after the goal was last set or the last check-in
export const isDue = (today: string, lastEvent: string) => daysBetween(lastEvent, today) >= CHECK_IN_DAYS;

type Input = {
  weights: Weigh[];
  today: string;
  // Signed weekly change the plan aims for: negative when losing
  plannedRateKg: number;
  kcal: number;
  floorKcal: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

// Compares the weight trend with the plan and suggests a calorie change. Uses the trend
// (7-day average) rather than single weigh-ins, and moves targets by half the gap, capped.
export function evaluateCheckIn({ weights, today, plannedRateKg, kcal, floorKcal }: Input): CheckInResult {
  const now = trendAt(weights, today);
  if (!now || now.count < MIN_WEIGHINS) {
    const needed = MIN_WEIGHINS - (now?.count ?? 0);
    return {
      status: "insufficient",
      neededWeighIns: needed,
      message: `Log ${needed} more weigh-in${needed === 1 ? "" : "s"} this week to see how your trend compares with your plan.`,
    };
  }

  // Compare with the trend a fortnight ago, or a week ago if that's all there is
  const baseline = [14, 7]
    .map((days) => ({ days, trend: trendAt(weights, addDays(today, -days)) }))
    .find((b) => b.trend && b.trend.count >= 2);
  if (!baseline?.trend) {
    return { status: "insufficient", message: "Weigh-ins from the week before this one are needed to measure your trend." };
  }

  const observedRateKg = round2((now.kg - baseline.trend.kg) / (baseline.days / 7));
  const base = { observedRateKg, plannedRateKg: round2(plannedRateKg), trendKg: now.kg };

  let delta: number;
  if (observedRateKg < -1) {
    // Losing faster than 1 kg a week is more than is advised, whatever the plan said
    delta = clamp(Math.round(0.5 * (-1 - observedRateKg) * (KCAL_PER_KG / 7)), 100, MAX_STEP_KCAL);
  } else {
    const gap = observedRateKg - plannedRateKg;
    if (Math.abs(gap) <= TOLERANCE_KG) return { status: "on_track", ...base };
    // Gaining faster than planned (positive gap) means eating less, and vice versa
    delta = clamp(Math.round(-gap * 0.5 * (KCAL_PER_KG / 7)), -MAX_STEP_KCAL, MAX_STEP_KCAL);
  }

  let suggestedKcal = roundTo(kcal + delta, 10);
  if (delta < 0 && suggestedKcal < floorKcal) suggestedKcal = floorKcal;
  if (suggestedKcal === kcal) return { status: "on_track", ...base, atFloor: delta < 0 };
  return { status: "adjust", ...base, deltaKcal: suggestedKcal - kcal, suggestedKcal };
}
