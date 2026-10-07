import { and, asc, between, eq, lte, sql } from "drizzle-orm";

import { db } from "../db";
import { days, exerciseEntries, goals } from "../db/schema";
import { eachDay, isoWeekday } from "../dates";
import { withExtraKcal, type Targets } from "./targets";

export type DayTargets = {
  goalId: string;
  type: (typeof goals.$inferSelect)["type"];
  base: Targets;
  targets: Targets;
  hasSchedule: boolean;
  trainingDay: boolean;
  trainingExtraKcal: number;
  exerciseKcal: number;
  exerciseAddsToAllowance: boolean;
};

// The targets that apply on each date in a range: the goal active that day, plus the
// training-day extra and (if switched on) logged exercise. Dates before the first goal
// are left out.
export async function dayTargetsInRange(userId: string, from: string, to: string) {
  const goalRows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), lte(goals.activeFrom, to)))
    .orderBy(asc(goals.activeFrom), asc(goals.createdAt));

  const overrides = await db
    .select({ date: days.date, trainingDay: days.trainingDay })
    .from(days)
    .where(and(eq(days.userId, userId), between(days.date, from, to)));
  const overrideByDate = new Map(overrides.map((o) => [o.date, o.trainingDay]));

  const exercise = await db
    .select({ date: exerciseEntries.date, kcal: sql<number>`sum(${exerciseEntries.kcal})`.mapWith(Number) })
    .from(exerciseEntries)
    .where(and(eq(exerciseEntries.userId, userId), between(exerciseEntries.date, from, to)))
    .groupBy(exerciseEntries.date);
  const exerciseByDate = new Map(exercise.map((e) => [e.date, e.kcal]));

  const result = new Map<string, DayTargets>();
  for (const date of eachDay(from, to)) {
    // Latest goal that started on or before this date (rows are ordered oldest first)
    const goal = goalRows.findLast((g) => g.activeFrom <= date);
    if (!goal) continue;

    const trainingDay = overrideByDate.get(date) ?? goal.trainingWeekdays.includes(isoWeekday(date));
    const exerciseKcal = exerciseByDate.get(date) ?? 0;
    const trainingExtraKcal = trainingDay ? goal.trainingDayExtraKcal : 0;
    const extra = trainingExtraKcal + (goal.exerciseAddsToAllowance ? exerciseKcal : 0);
    const base = { kcal: goal.kcal, protein: goal.protein, carbs: goal.carbs, fat: goal.fat };
    result.set(date, {
      goalId: goal.id,
      type: goal.type,
      base,
      targets: withExtraKcal(base, extra),
      hasSchedule: goal.trainingWeekdays.length > 0,
      trainingDay,
      trainingExtraKcal,
      exerciseKcal,
      exerciseAddsToAllowance: goal.exerciseAddsToAllowance,
    });
  }
  return result;
}
