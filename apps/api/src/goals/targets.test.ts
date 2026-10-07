import { describe, expect, it } from "vitest";

import { estimateKcal } from "./exercise";
import {
  computeTargets,
  energyNeeds,
  macrosFor,
  referenceWeightKg,
  tdee,
  weeksToTarget,
  withExtraKcal,
  type GoalInput,
} from "./targets";

const man: GoalInput = {
  sex: "male",
  weightKg: 80,
  heightCm: 180,
  age: 30,
  activity: "moderate",
  type: "maintain",
  ratePerWeekKg: 0,
};

describe("energy needs", () => {
  it("matches the Mifflin-St Jeor worked example", () => {
    expect(energyNeeds(man)).toBe(1780);
    expect(tdee(man, "moderate")).toBeCloseTo(2759, 0);
  });

  it("uses the midpoint constant when sex is unspecified", () => {
    expect(energyNeeds({ ...man, sex: "unspecified" })).toBe(1780 - 5 - 78);
  });
});

describe("computeTargets", () => {
  it("maintains at TDEE rounded to 10", () => {
    const t = computeTargets(man);
    expect(t.kcal).toBe(2760);
    expect(t.actualRatePerWeekKg).toBe(0);
    expect(t.floorApplied).toBe(false);
  });

  it("subtracts 0.5 kg/week as 550 kcal a day", () => {
    const t = computeTargets({ ...man, type: "lose", ratePerWeekKg: 0.5 });
    expect(t.kcal).toBe(2210);
    expect(t.actualRatePerWeekKg).toBeCloseTo(0.5, 1);
  });

  it("caps weight loss at 1% of bodyweight", () => {
    const t = computeTargets({ ...man, weightKg: 50, type: "lose", ratePerWeekKg: 1 });
    expect(t.rateCapped).toBe(true);
    expect(t.actualRatePerWeekKg).toBeLessThanOrEqual(0.5);
  });

  it("never plans below the calorie floor, and reports the real rate", () => {
    const small: GoalInput = {
      sex: "female",
      weightKg: 100,
      heightCm: 150,
      age: 60,
      activity: "sedentary",
      type: "lose",
      ratePerWeekKg: 1,
    };
    const t = computeTargets(small);
    expect(t.floorApplied).toBe(true);
    expect(t.kcal).toBe(1200);
    expect(t.actualRatePerWeekKg).toBeLessThan(1);
  });

  it("adds calories for gaining", () => {
    const t = computeTargets({ ...man, type: "gain", ratePerWeekKg: 0.25 });
    expect(t.kcal).toBe(3030); // 2,759 + 275
  });
});

describe("macros", () => {
  it("uses the lower of current weight and BMI 25 weight for protein", () => {
    expect(referenceWeightKg(140, 170)).toBeCloseTo(25 * 1.7 ** 2, 5);
    expect(referenceWeightKg(60, 180)).toBe(60);
    // 1.8 g/kg on 72.25 kg, rounded to 5
    expect(macrosFor(2000, "lose", 140, 170).protein).toBe(130);
  });

  it("gives fat at least 0.6 g/kg and never negative carbs", () => {
    const m = macrosFor(1200, "lose", 140, 170);
    expect(m.fat).toBeGreaterThanOrEqual(80);
    expect(m.carbs).toBe(0);
  });

  it("adds extra calories as carbs", () => {
    const base = { kcal: 2000, protein: 150, carbs: 200, fat: 70 };
    expect(withExtraKcal(base, 200)).toEqual({ ...base, kcal: 2200, carbs: 250 });
    expect(withExtraKcal(base, 0)).toBe(base);
  });
});

describe("weeksToTarget", () => {
  it("rounds up and ignores zero rates", () => {
    expect(weeksToTarget(80, 75, 0.5)).toBe(10);
    expect(weeksToTarget(80, 75, 0)).toBeNull();
    expect(weeksToTarget(80, null, 0.5)).toBeNull();
  });
});

describe("exercise", () => {
  it("counts calories above resting", () => {
    // (9.8 - 1) × 70 kg × 0.5 h
    expect(estimateKcal("running", 30, 70)).toBe(308);
  });
});
