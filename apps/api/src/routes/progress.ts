import { zValidator } from "@hono/zod-validator";
import { and, asc, between, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, goals, weightEntries } from "../db/schema";
import { addDays, daysBetween } from "../dates";
import { dayTargetsInRange } from "../goals/day";
import { withTrend } from "../goals/trend";
import { requireSession, type AuthEnv } from "../middleware";

const day = z.iso.date();
const weightKg = z.number().min(20).max(500);

export const weightRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/", zValidator("query", z.object({ from: day.optional(), to: day.optional() })), async (c) => {
    const { from, to } = c.req.valid("query");
    const rows = await db
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(
        and(
          eq(weightEntries.userId, c.get("session").user.id),
          from ? gte(weightEntries.date, from) : undefined,
          to ? sql`${weightEntries.date} <= ${to}` : undefined,
        ),
      )
      .orderBy(asc(weightEntries.date));
    return c.json(withTrend(rows));
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
