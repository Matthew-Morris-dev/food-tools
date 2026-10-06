import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, foods } from "../db/schema";
import { requireSession, type AuthEnv } from "../middleware";
import { forGrams } from "../nutrition";
import { visibleTo } from "./foods";

const day = z.iso.date();
const slot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const grams = z.number().positive().max(5000);

const addBody = z.union([
  z.object({ date: day, slot, foodId: z.uuid(), grams }),
  z.object({
    date: day,
    slot,
    quick: z.object({
      name: z.string().trim().max(200).nullish(),
      kcal: z.number().min(0).max(10000),
      protein: z.number().min(0).max(1000).default(0),
      carbs: z.number().min(0).max(1000).default(0),
      fat: z.number().min(0).max(1000).default(0),
    }),
  }),
]);

const updateBody = z.object({ slot: slot.optional(), grams: grams.optional() });

const idParam = zValidator("param", z.object({ id: z.uuid() }));

export const logRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/", zValidator("query", z.object({ date: day })), async (c) => {
    const rows = await db
      .select()
      .from(foodLogEntries)
      .where(and(eq(foodLogEntries.userId, c.get("session").user.id), eq(foodLogEntries.date, c.req.valid("query").date)))
      .orderBy(asc(foodLogEntries.createdAt));
    return c.json(rows);
  })

  .post("/", zValidator("json", addBody), async (c) => {
    const userId = c.get("session").user.id;
    const body = c.req.valid("json");

    let values;
    if ("quick" in body) {
      const { name, ...macros } = body.quick;
      values = { name: name || "Quick add", grams: null, ...macros };
    } else {
      const [food] = await db
        .select()
        .from(foods)
        .where(and(eq(foods.id, body.foodId), visibleTo(userId)));
      if (!food) throw new HTTPException(404, { message: "Food not found" });
      values = { foodId: food.id, name: food.name, brand: food.brand, grams: body.grams, ...forGrams(food, body.grams) };
    }

    const [entry] = await db
      .insert(foodLogEntries)
      .values({ userId, date: body.date, slot: body.slot, ...values })
      .returning();
    return c.json(entry, 201);
  })

  .patch("/:id", idParam, zValidator("json", updateBody), async (c) => {
    const where = and(eq(foodLogEntries.id, c.req.valid("param").id), eq(foodLogEntries.userId, c.get("session").user.id));
    const [entry] = await db.select().from(foodLogEntries).where(where);
    if (!entry) throw new HTTPException(404, { message: "Entry not found" });

    const body = c.req.valid("json");
    const changes: Partial<typeof foodLogEntries.$inferInsert> = {};
    if (body.slot) changes.slot = body.slot;
    // Scale the stored snapshot rather than re-reading the food, so later edits to
    // the food don't leak into history
    if (body.grams !== undefined && entry.grams) {
      const per100g = {
        kcal: (entry.kcal / entry.grams) * 100,
        protein: (entry.protein / entry.grams) * 100,
        carbs: (entry.carbs / entry.grams) * 100,
        fat: (entry.fat / entry.grams) * 100,
      };
      Object.assign(changes, { grams: body.grams }, forGrams(per100g, body.grams));
    }
    if (Object.keys(changes).length === 0) return c.json(entry);

    const [updated] = await db.update(foodLogEntries).set(changes).where(where).returning();
    return c.json(updated);
  })

  .delete("/:id", idParam, async (c) => {
    const [deleted] = await db
      .delete(foodLogEntries)
      .where(and(eq(foodLogEntries.id, c.req.valid("param").id), eq(foodLogEntries.userId, c.get("session").user.id)))
      .returning({ id: foodLogEntries.id });
    if (!deleted) throw new HTTPException(404, { message: "Entry not found" });
    return c.body(null, 204);
  });
