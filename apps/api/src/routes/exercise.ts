import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { exerciseEntries, goals, weightEntries } from "../db/schema";
import { ACTIVITIES, estimateKcal, type Activity } from "../goals/exercise";
import { requireSession, type AuthEnv } from "../middleware";

const day = z.iso.date();
const activity = z.enum(Object.keys(ACTIVITIES) as [Activity, ...Activity[]]);
const minutes = z.number().int().min(1).max(600);

// Body weight to estimate with: the latest weigh-in up to that date, else the goal's start weight
async function weightFor(userId: string, date: string) {
  const [w] = await db
    .select({ kg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), lte(weightEntries.date, date)))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  if (w) return w.kg;
  const [g] = await db.select({ kg: goals.startWeightKg }).from(goals).where(eq(goals.userId, userId)).limit(1);
  return g?.kg ?? null;
}

export const exerciseRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/", zValidator("query", z.object({ date: day })), async (c) =>
    c.json(
      await db
        .select()
        .from(exerciseEntries)
        .where(and(eq(exerciseEntries.userId, c.get("session").user.id), eq(exerciseEntries.date, c.req.valid("query").date)))
        .orderBy(asc(exerciseEntries.createdAt)),
    ),
  )

  .get("/estimate", zValidator("query", z.object({ date: day, activity, minutes: z.coerce.number().int().min(1).max(600) })), async (c) => {
    const { date, activity: a, minutes: m } = c.req.valid("query");
    const kg = await weightFor(c.get("session").user.id, date);
    return c.json({ kcal: kg === null || a === "other" ? null : estimateKcal(a, m, kg) });
  })

  .post(
    "/",
    zValidator("json", z.object({ date: day, activity, minutes, kcal: z.number().min(0).max(5000).optional() })),
    async (c) => {
      const userId = c.get("session").user.id;
      const body = c.req.valid("json");
      let kcal = body.kcal;
      if (kcal === undefined) {
        const kg = body.activity === "other" ? null : await weightFor(userId, body.date);
        if (kg === null) throw new HTTPException(400, { message: "Enter the calories burned for this activity" });
        kcal = estimateKcal(body.activity, body.minutes, kg);
      }
      const [entry] = await db
        .insert(exerciseEntries)
        .values({ userId, date: body.date, activity: body.activity, minutes: body.minutes, kcal })
        .returning();
      return c.json(entry, 201);
    },
  )

  .delete("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
    const [deleted] = await db
      .delete(exerciseEntries)
      .where(and(eq(exerciseEntries.id, c.req.valid("param").id), eq(exerciseEntries.userId, c.get("session").user.id)))
      .returning({ id: exerciseEntries.id });
    if (!deleted) throw new HTTPException(404, { message: "Entry not found" });
    return c.body(null, 204);
  });
