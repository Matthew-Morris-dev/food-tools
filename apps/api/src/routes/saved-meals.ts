import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, foods, savedMealItems, savedMeals } from "../db/schema";
import { requireSession, type AuthEnv } from "../middleware";
import { forGrams } from "../nutrition";

const idParam = zValidator("param", z.object({ id: z.uuid() }));
const name = z.string().trim().min(1).max(100);

type Item = typeof savedMealItems.$inferSelect;

async function mealsFor(userId: string, mealId?: string) {
  const meals = await db
    .select({ id: savedMeals.id, name: savedMeals.name })
    .from(savedMeals)
    .where(and(eq(savedMeals.userId, userId), mealId ? eq(savedMeals.id, mealId) : undefined))
    .orderBy(desc(savedMeals.updatedAt));
  if (meals.length === 0) return [];

  const items = await db
    .select()
    .from(savedMealItems)
    .where(
      inArray(
        savedMealItems.mealId,
        meals.map((m) => m.id),
      ),
    )
    .orderBy(asc(savedMealItems.position));
  const byMeal = Map.groupBy(items, (i) => i.mealId);
  return meals.map((m) => ({
    ...m,
    items: (byMeal.get(m.id) ?? []).map(({ mealId: _, position: __, ...item }) => item),
  }));
}

async function ownedMeal(userId: string, id: string) {
  const [meal] = await mealsFor(userId, id);
  if (!meal) throw new HTTPException(404, { message: "Meal not found" });
  return meal;
}

// Current nutrition for an item: from its food if it still exists, else the snapshot
async function currentNutrition(items: Omit<Item, "mealId" | "position">[]) {
  const foodIds = items.flatMap((i) => (i.foodId ? [i.foodId] : []));
  const foodRows = foodIds.length ? await db.select().from(foods).where(inArray(foods.id, foodIds)) : [];
  const foodById = new Map(foodRows.map((f) => [f.id, f]));
  return items.map((item) => {
    const food = item.foodId ? foodById.get(item.foodId) : undefined;
    const macros =
      food && item.grams
        ? forGrams(food, item.grams)
        : { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };
    return { foodId: item.foodId, name: item.name, brand: item.brand, grams: item.grams, ...macros };
  });
}

export const savedMealRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/", async (c) => c.json(await mealsFor(c.get("session").user.id)))

  // Creates a meal from entries already in the log, e.g. today's breakfast
  .post("/", zValidator("json", z.object({ name, entryIds: z.array(z.uuid()).min(1).max(50) })), async (c) => {
    const userId = c.get("session").user.id;
    const body = c.req.valid("json");
    const entries = await db
      .select()
      .from(foodLogEntries)
      .where(and(eq(foodLogEntries.userId, userId), inArray(foodLogEntries.id, body.entryIds)))
      .orderBy(asc(foodLogEntries.createdAt));
    if (entries.length === 0) throw new HTTPException(400, { message: "No entries to save" });

    const mealId = await db.transaction(async (tx) => {
      const [meal] = await tx.insert(savedMeals).values({ userId, name: body.name }).returning();
      await tx.insert(savedMealItems).values(
        entries.map((e, position) => ({
          mealId: meal.id,
          position,
          foodId: e.foodId,
          name: e.name,
          brand: e.brand,
          grams: e.grams,
          kcal: e.kcal,
          protein: e.protein,
          carbs: e.carbs,
          fat: e.fat,
        })),
      );
      return meal.id;
    });
    return c.json(await ownedMeal(userId, mealId), 201);
  })

  .patch("/:id", idParam, zValidator("json", z.object({ name })), async (c) => {
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");
    const [updated] = await db
      .update(savedMeals)
      .set({ name: c.req.valid("json").name })
      .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
      .returning({ id: savedMeals.id });
    if (!updated) throw new HTTPException(404, { message: "Meal not found" });
    return c.json(await ownedMeal(userId, id));
  })

  .delete("/:id", idParam, async (c) => {
    const [deleted] = await db
      .delete(savedMeals)
      .where(and(eq(savedMeals.id, c.req.valid("param").id), eq(savedMeals.userId, c.get("session").user.id)))
      .returning({ id: savedMeals.id });
    if (!deleted) throw new HTTPException(404, { message: "Meal not found" });
    return c.body(null, 204);
  })

  .post(
    "/:id/log",
    idParam,
    zValidator("json", z.object({ date: z.iso.date(), slot: z.enum(["breakfast", "lunch", "dinner", "snack"]) })),
    async (c) => {
      const userId = c.get("session").user.id;
      const meal = await ownedMeal(userId, c.req.valid("param").id);
      const { date, slot } = c.req.valid("json");
      const items = await currentNutrition(meal.items);

      const entries = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(foodLogEntries)
          .values(items.map((item) => ({ ...item, userId, date, slot })))
          .returning();
        // Most recently used meals sort first
        await tx.update(savedMeals).set({ updatedAt: new Date() }).where(eq(savedMeals.id, meal.id));
        return inserted;
      });
      return c.json(entries, 201);
    },
  );
