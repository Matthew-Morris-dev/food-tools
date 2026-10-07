import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lte, sum } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { days, exerciseEntries, goals, profiles, weightEntries } from "../db/schema";
import { planFor, setupBody } from "../goals/setup";
import { withExtraKcal } from "../goals/targets";
import { requireSession, type AuthEnv } from "../middleware";

const day = z.iso.date();

// ISO weekday (1 = Monday ... 7 = Sunday) of a YYYY-MM-DD date
export const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

export async function goalOn(userId: string, date: string) {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), lte(goals.activeFrom, date)))
    .orderBy(desc(goals.activeFrom), desc(goals.createdAt))
    .limit(1);
  return goal ?? null;
}

const units = z.object({
  weightUnit: z.enum(["kg", "st_lb", "lb"]).optional(),
  heightUnit: z.enum(["cm", "ft_in"]).optional(),
});

export const profileRoutes = new Hono<AuthEnv>()
  .use(requireSession)
  .get("/", async (c) => {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, c.get("session").user.id));
    return c.json(profile ?? null);
  })
  // Units can be changed any time, without touching the goal
  .patch("/units", zValidator("json", units), async (c) => {
    const userId = c.get("session").user.id;
    const changes = c.req.valid("json");
    if (Object.keys(changes).length === 0) throw new HTTPException(400, { message: "Nothing to change" });
    const [profile] = await db.update(profiles).set(changes).where(eq(profiles.userId, userId)).returning();
    if (!profile) throw new HTTPException(409, { message: "Set up your profile first" });
    return c.json(profile);
  });

export const goalRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/current", zValidator("query", z.object({ date: day })), async (c) =>
    c.json(await goalOn(c.get("session").user.id, c.req.valid("query").date)),
  )

  .post("/preview", zValidator("json", setupBody), (c) => c.json(planFor(c.req.valid("json"))))

  // Creates a new goal version; also saves the profile and logs the weight
  .post("/", zValidator("json", setupBody), async (c) => {
    const userId = c.get("session").user.id;
    const body = c.req.valid("json");
    const plan = planFor(body);
    if (plan.belowFloor && !body.manual?.acknowledgeBelowFloor) {
      throw new HTTPException(400, {
        message: `Targets below ${plan.floorKcal} kcal need to be acknowledged`,
      });
    }

    const goal = await db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId, ...body.profile })
        .onConflictDoUpdate({ target: profiles.userId, set: body.profile });
      await tx
        .insert(weightEntries)
        .values({ userId, date: body.date, weightKg: body.weightKg })
        .onConflictDoUpdate({
          target: [weightEntries.userId, weightEntries.date],
          set: { weightKg: body.weightKg },
        });
      const previous = await tx.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId)).limit(1);
      const [created] = await tx
        .insert(goals)
        .values({
          userId,
          type: body.goal.type,
          ratePerWeekKg: body.goal.ratePerWeekKg,
          startWeightKg: body.weightKg,
          targetWeightKg: body.goal.targetWeightKg ?? null,
          ...plan.targets,
          manual: plan.manual,
          trainingWeekdays: body.trainingWeekdays,
          trainingDayExtraKcal: body.trainingDayExtraKcal,
          exerciseAddsToAllowance: body.exerciseAddsToAllowance,
          activeFrom: body.date,
          reason: previous.length === 0 ? "setup" : "edit",
        })
        .returning();
      return created;
    });
    return c.json({ goal, plan }, 201);
  })

  // The targets that apply on one date, after training-day and exercise adjustments
  .get("/day/:date", zValidator("param", z.object({ date: day })), async (c) => {
    const userId = c.get("session").user.id;
    const { date } = c.req.valid("param");
    const goal = await goalOn(userId, date);
    if (!goal) return c.json(null);

    const [override] = await db
      .select({ trainingDay: days.trainingDay })
      .from(days)
      .where(and(eq(days.userId, userId), eq(days.date, date)));
    const scheduled = goal.trainingWeekdays.includes(isoWeekday(date));
    const trainingDay = override?.trainingDay ?? scheduled;

    const [{ total }] = await db
      .select({ total: sum(exerciseEntries.kcal).mapWith(Number) })
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, userId), eq(exerciseEntries.date, date)));
    const exerciseKcal = total ?? 0;

    const base = { kcal: goal.kcal, protein: goal.protein, carbs: goal.carbs, fat: goal.fat };
    const trainingExtra = trainingDay ? goal.trainingDayExtraKcal : 0;
    const exerciseExtra = goal.exerciseAddsToAllowance ? exerciseKcal : 0;
    return c.json({
      goalId: goal.id,
      type: goal.type,
      base,
      targets: withExtraKcal(base, trainingExtra + exerciseExtra),
      hasSchedule: goal.trainingWeekdays.length > 0,
      trainingDay,
      trainingExtraKcal: trainingExtra,
      exerciseKcal,
      exerciseAddsToAllowance: goal.exerciseAddsToAllowance,
    });
  })

  .put(
    "/day/:date/training",
    zValidator("param", z.object({ date: day })),
    zValidator("json", z.object({ trainingDay: z.boolean().nullable() })),
    async (c) => {
      const userId = c.get("session").user.id;
      const { date } = c.req.valid("param");
      const { trainingDay } = c.req.valid("json");
      await db
        .insert(days)
        .values({ userId, date, trainingDay })
        .onConflictDoUpdate({ target: [days.userId, days.date], set: { trainingDay } });
      return c.body(null, 204);
    },
  );
