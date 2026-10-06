import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, ilike, inArray, isNull, isNotNull, max, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, foods } from "../db/schema";
import { requireSession, type AuthEnv } from "../middleware";
import { lookupBarcode, searchProducts } from "../open-food-facts";

const foodColumns = {
  id: foods.id,
  source: foods.source,
  name: foods.name,
  brand: foods.brand,
  barcode: foods.barcode,
  kcal: foods.kcal,
  protein: foods.protein,
  carbs: foods.carbs,
  fat: foods.fat,
  sugars: foods.sugars,
  fibre: foods.fibre,
  saturates: foods.saturates,
  salt: foods.salt,
  servings: foods.servings,
};

// Shared foods (CoFID, Open Food Facts) plus the user's own custom foods
export const visibleTo = (userId: string) => or(isNull(foods.ownerId), eq(foods.ownerId, userId));

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

const nutrient = (max: number) => z.number().min(0).max(max);

const customFoodBody = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullish(),
  barcode: z
    .string()
    .regex(/^\d{6,14}$/)
    .nullish(),
  kcal: nutrient(900),
  protein: nutrient(100),
  carbs: nutrient(100),
  fat: nutrient(100),
  sugars: nutrient(100).nullish(),
  fibre: nutrient(100).nullish(),
  saturates: nutrient(100).nullish(),
  salt: nutrient(100).nullish(),
  servings: z
    .array(z.object({ label: z.string().trim().min(1).max(50), grams: z.number().positive().max(5000) }))
    .max(10)
    .default([]),
});

export const foodRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/search", zValidator("query", z.object({ q: z.string().trim().min(1).max(100) })), async (c) => {
    const userId = c.get("session").user.id;
    const words = c.req.valid("query").q.split(/\s+/).slice(0, 6);
    const haystack = sql`${foods.name} || ' ' || coalesce(${foods.brand}, '')`;

    // Foods the user logs often come first
    const usage = db
      .select({ foodId: foodLogEntries.foodId, uses: count().as("uses") })
      .from(foodLogEntries)
      .where(eq(foodLogEntries.userId, userId))
      .groupBy(foodLogEntries.foodId)
      .as("usage");

    const rows = await db
      .select(foodColumns)
      .from(foods)
      .leftJoin(usage, eq(usage.foodId, foods.id))
      .where(and(visibleTo(userId), ...words.map((w) => ilike(haystack, `%${escapeLike(w)}%`))))
      .orderBy(
        desc(sql`coalesce(${usage.uses}, 0)`),
        desc(isNotNull(foods.ownerId)),
        desc(ilike(foods.name, `${escapeLike(words[0])}%`)),
        asc(sql`length(${foods.name})`),
      )
      .limit(30);
    return c.json(rows);
  })

  // Searches Open Food Facts and keeps the results, so they show up in local search next time
  .get("/search-off", zValidator("query", z.object({ q: z.string().trim().min(2).max(100) })), async (c) => {
    let products;
    try {
      products = await searchProducts(c.req.valid("query").q);
    } catch (err) {
      console.error(err);
      throw new HTTPException(502, { message: "Couldn't reach Open Food Facts" });
    }
    if (products.length === 0) return c.json([]);

    await db
      .insert(foods)
      .values(products.map(({ complete: _, ...p }) => ({ ...p, source: "off" as const, sourceId: p.barcode })))
      .onConflictDoNothing();
    const codes = products.map((p) => p.barcode);
    const rows = await db
      .select(foodColumns)
      .from(foods)
      .where(and(eq(foods.source, "off"), inArray(foods.sourceId, codes)));
    // Keep Open Food Facts' relevance order
    rows.sort((a, b) => codes.indexOf(a.barcode!) - codes.indexOf(b.barcode!));
    return c.json(rows);
  })

  .get("/recent", async (c) => {
    const userId = c.get("session").user.id;
    const lastUsed = max(foodLogEntries.createdAt);
    const rows = await db
      .select(foodColumns)
      .from(foodLogEntries)
      .innerJoin(foods, eq(foods.id, foodLogEntries.foodId))
      .where(eq(foodLogEntries.userId, userId))
      .groupBy(foods.id)
      .orderBy(desc(lastUsed))
      .limit(20);
    return c.json(rows);
  })

  .get("/barcode/:code", zValidator("param", z.object({ code: z.string().regex(/^\d{6,14}$/) })), async (c) => {
    const userId = c.get("session").user.id;
    const { code } = c.req.valid("param");

    const [known] = await db
      .select(foodColumns)
      .from(foods)
      .where(
        or(
          and(eq(foods.ownerId, userId), eq(foods.barcode, code)),
          and(eq(foods.source, "off"), eq(foods.sourceId, code)),
        ),
      )
      // The user's own version wins over the Open Food Facts copy
      .orderBy(desc(isNotNull(foods.ownerId)))
      .limit(1);
    if (known) return c.json({ status: "found" as const, food: known });

    let product;
    try {
      product = await lookupBarcode(code);
    } catch (err) {
      console.error(err);
      throw new HTTPException(502, { message: "Couldn't reach Open Food Facts" });
    }
    if (!product) return c.json({ status: "not_found" as const });
    if (!product.complete) {
      return c.json({ status: "incomplete" as const, name: product.name, brand: product.brand });
    }

    const { complete: _, ...data } = product;
    await db
      .insert(foods)
      .values({ ...data, source: "off", sourceId: code, barcode: code })
      .onConflictDoNothing();
    const [food] = await db
      .select(foodColumns)
      .from(foods)
      .where(and(eq(foods.source, "off"), eq(foods.sourceId, code)));
    return c.json({ status: "found" as const, food });
  })

  .get("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
    const [food] = await db
      .select(foodColumns)
      .from(foods)
      .where(and(eq(foods.id, c.req.valid("param").id), visibleTo(c.get("session").user.id)));
    if (!food) throw new HTTPException(404, { message: "Food not found" });
    return c.json(food);
  })

  .post("/", zValidator("json", customFoodBody), async (c) => {
    const [food] = await db
      .insert(foods)
      .values({ ...c.req.valid("json"), source: "custom", ownerId: c.get("session").user.id })
      .returning(foodColumns);
    return c.json(food, 201);
  });
