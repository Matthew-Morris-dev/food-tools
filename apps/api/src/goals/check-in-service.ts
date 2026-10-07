import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "../db";
import { checkIns, goals, profiles, weightEntries } from "../db/schema";
import { evaluateCheckIn, isDue, CHECK_IN_DAYS, type CheckInResult } from "./check-in";
import { addDays } from "../dates";
import { ageFrom, tdee } from "./targets";
import { trendAt } from "./trend";

const KCAL_PER_KG = 7700;

export type CheckInState =
  | { status: "no_goal" }
  | { status: "not_due"; dueOn: string }
  | ({ dueOn: string } & CheckInResult);

// Where this user's weekly check-in stands on `today`
export async function checkInState(userId: string, today: string) {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), lte(goals.activeFrom, today)))
    .orderBy(desc(goals.activeFrom), desc(goals.createdAt))
    .limit(1);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!goal || !profile) return { state: { status: "no_goal" } as CheckInState, goal: null, profile: null, trendKg: null };

  const [last] = await db
    .select({ date: checkIns.date })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.date))
    .limit(1);
  const lastEvent = last && last.date > goal.activeFrom ? last.date : goal.activeFrom;
  const dueOn = addDays(lastEvent, CHECK_IN_DAYS);
  if (!isDue(today, lastEvent)) {
    return { state: { status: "not_due", dueOn } as CheckInState, goal, profile, trendKg: null };
  }

  const weights = await db
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), lte(weightEntries.date, today)));
  const trendKg = trendAt(weights, today)?.kg ?? goal.startWeightKg;

  // The plan's weekly rate follows from its calories versus estimated needs, so it also
  // holds for manual goals and goals held up by the calorie floor
  const needs = tdee(
    { sex: profile.sex, weightKg: trendKg, heightCm: profile.heightCm, age: ageFrom(profile.birthYear) },
    profile.activityLevel,
  );
  const plannedRateKg = ((goal.kcal - needs) * 7) / KCAL_PER_KG;
  const floorKcal = profile.sex === "female" ? 1200 : 1500;

  const result = evaluateCheckIn({ weights, today, plannedRateKg, kcal: goal.kcal, floorKcal });
  return { state: { ...result, dueOn } as CheckInState, goal, profile, trendKg };
}
