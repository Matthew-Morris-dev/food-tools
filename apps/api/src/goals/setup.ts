import { z } from "zod";

import { RATE_OPTIONS, ageFrom, computeTargets, weeksToTarget, type GoalType } from "./targets";

export const goalTypeSchema = z.enum(["lose", "maintain", "gain", "build"]);

export const profileBody = z.object({
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 13),
  sex: z.enum(["male", "female", "unspecified"]),
  heightCm: z.number().min(100).max(250),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
});

export const setupBody = z
  .object({
    date: z.iso.date(),
    profile: profileBody,
    weightKg: z.number().min(30).max(400),
    goal: z.object({
      type: goalTypeSchema,
      ratePerWeekKg: z.number().min(0).max(1).default(0),
      targetWeightKg: z.number().min(30).max(400).nullish(),
    }),
    trainingWeekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    trainingDayExtraKcal: z.number().min(0).max(1000).default(200),
    exerciseAddsToAllowance: z.boolean().default(false),
    // Manual override of the calculated targets, e.g. from a coach or dietitian
    manual: z
      .object({
        kcal: z.number().min(500).max(10000),
        protein: z.number().min(0).max(1000),
        carbs: z.number().min(0).max(1500),
        fat: z.number().min(0).max(1000),
        acknowledgeBelowFloor: z.boolean().default(false),
      })
      .nullish(),
  })
  .refine((b) => RATE_OPTIONS[b.goal.type as GoalType].includes(b.goal.ratePerWeekKg), {
    message: "Rate isn't one of the options for this goal",
    path: ["goal", "ratePerWeekKg"],
  });

export type SetupBody = z.infer<typeof setupBody>;

// Calculates the plan for a setup form without saving anything
export function planFor(body: SetupBody) {
  const calculated = computeTargets({
    sex: body.profile.sex,
    weightKg: body.weightKg,
    heightCm: body.profile.heightCm,
    age: ageFrom(body.profile.birthYear),
    activity: body.profile.activityLevel,
    type: body.goal.type,
    ratePerWeekKg: body.goal.ratePerWeekKg,
  });

  const { kcal, protein, carbs, fat } = body.manual ?? calculated;
  const belowFloor = body.manual != null && kcal < calculated.floorKcal;
  const weeks = weeksToTarget(body.weightKg, body.goal.targetWeightKg, calculated.actualRatePerWeekKg);

  return {
    targets: { kcal, protein, carbs, fat },
    calculated: { kcal: calculated.kcal, protein: calculated.protein, carbs: calculated.carbs, fat: calculated.fat },
    tdee: calculated.tdee,
    actualRatePerWeekKg: calculated.actualRatePerWeekKg,
    rateCapped: calculated.rateCapped,
    floorKcal: calculated.floorKcal,
    floorApplied: calculated.floorApplied,
    belowFloor,
    manual: body.manual != null,
    weeksToTarget: weeks,
  };
}
