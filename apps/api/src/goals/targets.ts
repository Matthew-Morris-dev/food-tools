// Calorie and macro targets. Pure functions, so the rules are easy to test and to reuse
// from the check-in and (later) the meal planner.

export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain" | "build";

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Weekly rate options in kg, per goal type
export const RATE_OPTIONS: Record<GoalType, number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  maintain: [0],
  gain: [0.25, 0.5],
  build: [0.1, 0.25],
};

const KCAL_PER_KG = 7700;
const PROTEIN_PER_KG: Record<GoalType, number> = { lose: 1.8, build: 1.8, gain: 1.6, maintain: 1.4 };

export type Body = { sex: Sex; weightKg: number; heightCm: number; age: number };

export type Targets = { kcal: number; protein: number; carbs: number; fat: number };

export type GoalInput = Body & {
  activity: ActivityLevel;
  type: GoalType;
  ratePerWeekKg: number;
};

export type TargetResult = Targets & {
  tdee: number;
  // The rate the plan actually produces, after the rate cap and calorie floor
  actualRatePerWeekKg: number;
  rateCapped: boolean;
  floorKcal: number;
  floorApplied: boolean;
};

export const ageFrom = (birthYear: number, now = new Date()) => now.getFullYear() - birthYear;

// Mifflin-St Jeor. "unspecified" uses the midpoint of the male and female constants.
export function energyNeeds({ sex, weightKg, heightCm, age }: Body) {
  const constant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant;
}

export const tdee = (body: Body, activity: ActivityLevel) => energyNeeds(body) * ACTIVITY_FACTOR[activity];

export const calorieFloor = (sex: Sex) => (sex === "female" ? 1200 : 1500);

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// Protein is sized on the lower of current weight and the weight at BMI 25, so targets
// don't balloon at higher body weights
export const referenceWeightKg = (weightKg: number, heightCm: number) =>
  Math.min(weightKg, 25 * (heightCm / 100) ** 2);

export function macrosFor(kcal: number, type: GoalType, weightKg: number, heightCm: number): Targets {
  const protein = roundTo(PROTEIN_PER_KG[type] * referenceWeightKg(weightKg, heightCm), 5);
  const fat = roundTo(Math.max((0.3 * kcal) / 9, 0.6 * weightKg), 5);
  const carbs = Math.max(0, roundTo((kcal - 4 * protein - 9 * fat) / 4, 5));
  return { kcal, protein, carbs, fat };
}

export function computeTargets(input: GoalInput): TargetResult {
  const total = tdee(input, input.activity);
  const floorKcal = calorieFloor(input.sex);

  // NHS guidance is roughly 0.5 to 1 kg a week; never plan above 1% of bodyweight
  const cap = Math.min(1, input.weightKg * 0.01);
  const rateCapped = input.type === "lose" && input.ratePerWeekKg > cap;
  const rate = input.type === "maintain" ? 0 : rateCapped ? cap : input.ratePerWeekKg;

  const daily = (rate * KCAL_PER_KG) / 7;
  const wanted = input.type === "lose" ? total - daily : total + daily;
  const floorApplied = input.type === "lose" && wanted < floorKcal;
  const kcal = roundTo(floorApplied ? floorKcal : wanted, 10);

  const actualRate = input.type === "maintain" ? 0 : (Math.abs(kcal - total) * 7) / KCAL_PER_KG;
  return {
    ...macrosFor(kcal, input.type, input.weightKg, input.heightCm),
    tdee: Math.round(total),
    actualRatePerWeekKg: Math.round(actualRate * 100) / 100,
    rateCapped,
    floorKcal,
    floorApplied,
  };
}

// Extra calories on training days (or from logged exercise) go to carbs
export function withExtraKcal(targets: Targets, extraKcal: number): Targets {
  if (extraKcal <= 0) return targets;
  return {
    ...targets,
    kcal: targets.kcal + extraKcal,
    carbs: targets.carbs + roundTo(extraKcal / 4, 5),
  };
}

// Whole-week estimate of when the target weight is reached at the plan's actual rate
export function weeksToTarget(startKg: number, targetKg: number | null | undefined, actualRateKg: number) {
  if (targetKg == null || actualRateKg <= 0 || startKg === targetKg) return null;
  return Math.ceil(Math.abs(targetKg - startKg) / actualRateKg);
}
