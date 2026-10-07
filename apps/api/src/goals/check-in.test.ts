import { describe, expect, it } from "vitest";

import { addDays } from "../dates";
import { evaluateCheckIn, isDue } from "./check-in";
import type { Weigh } from "./trend";

const today = "2026-10-21";

// Weigh-ins every other day over four weeks, falling by `perWeek` kg a week from `start`
function series(start: number, perWeek: number): Weigh[] {
  const out: Weigh[] = [];
  for (let back = 28; back >= 0; back -= 2) {
    out.push({ date: addDays(today, -back), weightKg: start + (perWeek * (28 - back)) / 7 });
  }
  return out;
}

const plan = { today, kcal: 2200, floorKcal: 1500 };

describe("isDue", () => {
  it("is due a week after the last event", () => {
    expect(isDue("2026-10-21", "2026-10-14")).toBe(true);
    expect(isDue("2026-10-20", "2026-10-14")).toBe(false);
  });
});

describe("evaluateCheckIn", () => {
  it("is on track when the trend matches the plan", () => {
    const r = evaluateCheckIn({ ...plan, weights: series(85, -0.5), plannedRateKg: -0.5 });
    expect(r.status).toBe("on_track");
  });

  it("suggests fewer calories when losing slower than planned, capped at 200", () => {
    const r = evaluateCheckIn({ ...plan, weights: series(85, -0.1), plannedRateKg: -0.5 });
    expect(r.status).toBe("adjust");
    if (r.status === "adjust") {
      expect(r.deltaKcal).toBe(-200);
      expect(r.suggestedKcal).toBe(2000);
    }
  });

  it("moves by half the gap for a smaller miss", () => {
    // 0.3 kg a week slower than planned: half of 0.3 × 1100 is 165, and 2,035 rounds to 2,040
    const r = evaluateCheckIn({ ...plan, weights: series(85, -0.2), plannedRateKg: -0.5 });
    expect(r.status === "adjust" && r.deltaKcal).toBe(-160);
  });

  it("suggests more calories when losing faster than planned", () => {
    const r = evaluateCheckIn({ ...plan, weights: series(85, -0.8), plannedRateKg: -0.5 });
    expect(r.status === "adjust" && r.deltaKcal).toBeGreaterThan(0);
  });

  it("always raises calories when losing faster than 1 kg a week", () => {
    const r = evaluateCheckIn({ ...plan, weights: series(85, -1.4), plannedRateKg: -1.4 });
    expect(r.status === "adjust" && r.deltaKcal).toBeGreaterThanOrEqual(100);
  });

  it("suggests eating less when maintaining but gaining", () => {
    const r = evaluateCheckIn({ ...plan, weights: series(80, 0.4), plannedRateKg: 0 });
    expect(r.status === "adjust" && r.deltaKcal).toBeLessThan(0);
  });

  it("won't go below the calorie floor", () => {
    const r = evaluateCheckIn({ ...plan, kcal: 1500, weights: series(85, 0), plannedRateKg: -0.5 });
    expect(r).toMatchObject({ status: "on_track", atFloor: true });
    const near = evaluateCheckIn({ ...plan, kcal: 1560, weights: series(85, 0), plannedRateKg: -0.5 });
    expect(near.status === "adjust" && near.suggestedKcal).toBe(1500);
  });

  it("needs enough weigh-ins", () => {
    const few: Weigh[] = [{ date: today, weightKg: 80 }];
    const r = evaluateCheckIn({ ...plan, weights: few, plannedRateKg: 0 });
    expect(r).toMatchObject({ status: "insufficient", neededWeighIns: 2 });
  });

  it("needs earlier weigh-ins to measure a rate", () => {
    const recent = series(85, -0.5).filter((w) => w.date > addDays(today, -6));
    const r = evaluateCheckIn({ ...plan, weights: recent, plannedRateKg: -0.5 });
    expect(r.status).toBe("insufficient");
  });
});
