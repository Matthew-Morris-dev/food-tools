import { zValidator } from "@hono/zod-validator";
import { and, asc, between, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { checkIns, foodLogEntries, goals, weightEntries } from "../db/schema";
import { addDays, daysBetween } from "../dates";
import { checkInState } from "../goals/check-in-service";
import { dayTargetsInRange } from "../goals/day";
import { macrosFor, roundTo } from "../goals/targets";
import { withTrend } from "../goals/trend";
import { requireSession, type AuthEnv } from "../middleware";

const day = z.iso.date();
const weightKg = z.number().min(20).max(500);

export const weightRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  // The trend needs the week before `from`, so it's computed over everything first
  .get("/", zValidator("query", z.object({ from: day.optional(), to: day.optional() })), async (c) => {
    const { from, to } = c.req.valid("query");
    const rows = await db
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(eq(weightEntries.userId, c.get("session").user.id))
      .orderBy(asc(weightEntries.date));
    return c.json(withTrend(rows).filter((w) => (!from || w.date >= from) && (!to || w.date <= to)));
  })

  .put("/:date", zValidator("param", z.object({ date: day })), zValidator("json", z.object({ weightKg })), async (c) => {
    const userId = c.get("session").user.id;
    const { date } = c.req.valid("param");
    const { weightKg: kg } = c.req.valid("json");
    const [entry] = await db
      .insert(weightEntries)
      .values({ userId, date, weightKg: kg })
      .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.date], set: { weightKg: kg } })
      .returning({ date: weightEntries.date, weightKg: weightEntries.weightKg });
    return c.json(entry);
  })

  .delete("/:date", zValidator("param", z.object({ date: day })), async (c) => {
    const [deleted] = await db
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, c.get("session").user.id), eq(weightEntries.date, c.req.valid("param").date)))
      .returning({ id: weightEntries.id });
    if (!deleted) throw new HTTPException(404, { message: "No weigh-in on that date" });
    return c.body(null, 204);
  });

const RANGE_DAYS = { "4w": 28, "12w": 84 } as const;

export const progressRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  // `date` is the user's local today
  .get(
    "/",
    zValidator("query", z.object({ date: day, range: z.enum(["4w", "12w", "all"]).default("12w") })),
    async (c) => {
      const userId = c.get("session").user.id;
      const { date: today, range } = c.req.valid("query");

      const [firstGoal] = await db
        .select({ activeFrom: goals.activeFrom })
        .from(goals)
        .where(eq(goals.userId, userId))
        .orderBy(asc(goals.activeFrom))
        .limit(1);
      const [currentGoal] = await db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), sql`${goals.activeFrom} <= ${today}`))
        .orderBy(sql`${goals.activeFrom} desc, ${goals.createdAt} desc`)
        .limit(1);

      // Trend values need the week before the first plotted point
      const from = range === "all" ? (firstGoal?.activeFrom ?? addDays(today, -84)) : addDays(today, -RANGE_DAYS[range]);
      const all = await db
        .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
        .from(weightEntries)
        .where(and(eq(weightEntries.userId, userId), sql`${weightEntries.date} <= ${today}`))
        .orderBy(asc(weightEntries.date));
      const withTrends = withTrend(all);
      const weights = withTrends.filter((w) => w.date >= from);
      const latest = withTrends.at(-1) ?? null;

      // Eating: only days with something logged count, so a missed day isn't a zero
      const statsFrom = from;
      const logged = await db
        .select({
          date: foodLogEntries.date,
          kcal: sql<number>`sum(${foodLogEntries.kcal})`.mapWith(Number),
          protein: sql<number>`sum(${foodLogEntries.protein})`.mapWith(Number),
        })
        .from(foodLogEntries)
        .where(and(eq(foodLogEntries.userId, userId), between(foodLogEntries.date, statsFrom, today)))
        .groupBy(foodLogEntries.date);
      const targetsByDate = await dayTargetsInRange(userId, statsFrom, today);

      const rows = logged.flatMap((l) => {
        const t = targetsByDate.get(l.date);
        return t ? [{ ...l, target: t.targets }] : [];
      });
      const lastWeek = rows.filter((r) => daysBetween(r.date, today) < 7);
      const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

      return c.json({
        goal: currentGoal ?? null,
        checkIn: (await checkInState(userId, today)).state,
        weights,
        latest,
        changeSinceStartKg: currentGoal && latest ? Math.round((latest.trendKg - currentGoal.startWeightKg) * 10) / 10 : null,
        intake:
          lastWeek.length > 0
            ? {
                days: lastWeek.length,
                avgKcal: Math.round(avg(lastWeek.map((r) => r.kcal))),
                avgTargetKcal: Math.round(avg(lastWeek.map((r) => r.target.kcal))),
              }
            : null,
        proteinHitRate:
          rows.length > 0
            ? { hit: rows.filter((r) => r.protein >= 0.9 * r.target.protein).length, days: rows.length }
            : null,
      });
    },
  );

export const checkInRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  // Accepting applies the suggestion as a new goal version; keeping the current targets
  // just records the check-in. The suggestion is recomputed here, never taken from the client.
  .post("/", zValidator("json", z.object({ date: day, accept: z.boolean() })), async (c) => {
    const userId = c.get("session").user.id;
    const { date, accept } = c.req.valid("json");
    const { state, goal, profile, trendKg } = await checkInState(userId, date);
    if (!goal || !profile || (state.status !== "on_track" && state.status !== "adjust")) {
      throw new HTTPException(409, { message: "No check-in is due" });
    }

    const adjust = state.status === "adjust";
    await db.transaction(async (tx) => {
      await tx.insert(checkIns).values({
        userId,
        date,
        observedRateKg: state.observedRateKg,
        suggestedKcal: adjust ? state.suggestedKcal : null,
        accepted: adjust && accept,
      });
      if (!(adjust && accept)) return;

      // Manual goals keep their protein and fat; the calorie change goes to carbs
      const macros = goal.manual
        ? { protein: goal.protein, fat: goal.fat, carbs: Math.max(0, goal.carbs + roundTo(state.deltaKcal / 4, 5)) }
        : macrosFor(state.suggestedKcal, goal.type, trendKg ?? goal.startWeightKg, profile.heightCm);
      await tx.insert(goals).values({
        userId,
        type: goal.type,
        ratePerWeekKg: goal.ratePerWeekKg,
        startWeightKg: goal.startWeightKg,
        targetWeightKg: goal.targetWeightKg,
        kcal: state.suggestedKcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        manual: goal.manual,
        trainingWeekdays: goal.trainingWeekdays,
        trainingDayExtraKcal: goal.trainingDayExtraKcal,
        exerciseAddsToAllowance: goal.exerciseAddsToAllowance,
        activeFrom: date,
        reason: "check_in",
      });
    });
    return c.body(null, 204);
  });
