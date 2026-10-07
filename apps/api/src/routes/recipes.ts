import { zValidator } from "@hono/zod-validator";
import { and, arrayContains, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, foods, recipeIngredients, recipes } from "../db/schema";
import { requireSession, type AuthEnv } from "../middleware";
import { extractRecipe } from "../recipes/extract";
import { FetchBlockedError, fetchPage } from "../recipes/fetch-page";
import { buildDraft } from "../recipes/import";
import { portion, recipeNutrition } from "../recipes/nutrition";
import { parseRecipeText } from "../recipes/text";
import { visibleTo } from "./foods";

const idParam = zValidator("param", z.object({ id: z.uuid() }));

const ingredientBody = z.object({
  foodId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().min(0).max(100000).nullable(),
  unit: z.string().trim().max(30).nullable(),
  grams: z.number().min(0).max(20000),
  note: z.string().trim().max(200).nullable(),
});

export const recipeBody = z.object({
  name: z.string().trim().min(1).max(200),
  servings: z.number().min(0.5).max(100),
  method: z.string().max(20000).default(""),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(10)
    .transform((tags) => [...new Set(tags)]),
  cookedWeightG: z.number().min(10).max(50000).nullable(),
  sourceUrl: z.url().max(2000).nullable(),
  ingredients: z.array(ingredientBody).max(80),
});

type Row = {
  ing: typeof recipeIngredients.$inferSelect;
  food: typeof foods.$inferSelect | null;
};

const foodSummary = (f: typeof foods.$inferSelect) => ({
  id: f.id,
  source: f.source,
  name: f.name,
  brand: f.brand,
  barcode: f.barcode,
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  sugars: f.sugars,
  fibre: f.fibre,
  saturates: f.saturates,
  salt: f.salt,
  servings: f.servings,
});

function present(recipe: typeof recipes.$inferSelect, rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a.ing.position - b.ing.position);
  const nutrition = recipeNutrition(
    sorted.map((r) => ({ grams: r.ing.grams, food: r.food })),
    recipe.servings,
    recipe.cookedWeightG,
  );
  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    method: recipe.method,
    tags: recipe.tags,
    cookedWeightG: recipe.cookedWeightG,
    sourceUrl: recipe.sourceUrl,
    ...nutrition,
    ingredients: sorted.map(({ ing, food }) => ({
      id: ing.id,
      foodId: ing.foodId,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: ing.grams,
      note: ing.note,
      food: food ? foodSummary(food) : null,
      kcal: food ? Math.round(((food.kcal * ing.grams) / 100) * 10) / 10 : 0,
    })),
  };
}

async function loadRows(recipeIds: string[]) {
  if (recipeIds.length === 0) return new Map<string, Row[]>();
  const rows = await db
    .select({ ing: recipeIngredients, food: foods })
    .from(recipeIngredients)
    .leftJoin(foods, eq(foods.id, recipeIngredients.foodId))
    .where(inArray(recipeIngredients.recipeId, recipeIds));
  return Map.groupBy(rows, (r) => r.ing.recipeId);
}

async function ownedRecipe(userId: string, id: string) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
  if (!recipe) throw new HTTPException(404, { message: "Recipe not found" });
  return recipe;
}

async function fullRecipe(userId: string, id: string) {
  const recipe = await ownedRecipe(userId, id);
  const rows = await loadRows([id]);
  return present(recipe, rows.get(id) ?? []);
}

// Ingredients can only use foods the user can see: shared ones and their own
async function checkFoods(userId: string, ingredients: z.infer<typeof ingredientBody>[]) {
  const ids = [...new Set(ingredients.flatMap((i) => (i.foodId ? [i.foodId] : [])))];
  if (ids.length === 0) return;
  const found = await db
    .select({ id: foods.id })
    .from(foods)
    .where(and(inArray(foods.id, ids), visibleTo(userId)));
  if (found.length !== ids.length) throw new HTTPException(400, { message: "An ingredient uses an unknown food" });
}

function insertIngredients(
  tx: Pick<typeof db, "insert">,
  recipeId: string,
  ingredients: z.infer<typeof ingredientBody>[],
) {
  if (ingredients.length === 0) return Promise.resolve();
  return tx.insert(recipeIngredients).values(ingredients.map((i, position) => ({ ...i, recipeId, position })));
}

const logBody = z.union([
  z.object({ date: z.iso.date(), slot: z.enum(["breakfast", "lunch", "dinner", "snack"]), servings: z.number().min(0.1).max(100) }),
  z.object({ date: z.iso.date(), slot: z.enum(["breakfast", "lunch", "dinner", "snack"]), grams: z.number().min(1).max(50000) }),
]);

export const recipeRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get(
    "/",
    zValidator("query", z.object({ q: z.string().trim().max(100).optional(), tag: z.string().trim().toLowerCase().max(30).optional() })),
    async (c) => {
      const userId = c.get("session").user.id;
      const { q, tag } = c.req.valid("query");
      const list = await db
        .select()
        .from(recipes)
        .where(
          and(
            eq(recipes.userId, userId),
            q ? ilike(recipes.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
            tag ? arrayContains(recipes.tags, [tag]) : undefined,
          ),
        )
        .orderBy(desc(recipes.updatedAt));
      const rows = await loadRows(list.map((r) => r.id));
      return c.json(
        list.map((r) => {
          const { ingredients, totals: _, ...rest } = present(r, rows.get(r.id) ?? []);
          return { ...rest, ingredientCount: ingredients.length, method: undefined };
        }),
      );
    },
  )

  // Reads a recipe from a web page or pasted text and returns a draft to review.
  // Nothing is saved until the user saves it like any other recipe.
  .post(
    "/import",
    zValidator("json", z.union([z.object({ url: z.string().trim().max(2000) }), z.object({ text: z.string().trim().min(10).max(30000) })])),
    async (c) => {
      const userId = c.get("session").user.id;
      const body = c.req.valid("json");

      if ("text" in body) {
        const parsed = parseRecipeText(body.text);
        if (parsed.ingredients.length === 0) {
          throw new HTTPException(422, { message: "Couldn't find any ingredients in that text. Put each ingredient on its own line, with its amount first." });
        }
        return c.json(await buildDraft(userId, parsed, null));
      }

      let html: string;
      try {
        html = await fetchPage(body.url);
      } catch (err) {
        const message = err instanceof FetchBlockedError ? err.message : "Couldn't read that page. Paste the recipe text instead.";
        throw new HTTPException(err instanceof FetchBlockedError ? 400 : 502, { message });
      }
      const extracted = extractRecipe(html);
      if (!extracted) {
        throw new HTTPException(422, { message: "Couldn't find a recipe on that page. Try pasting the recipe text instead." });
      }
      return c.json(await buildDraft(userId, { ...extracted }, body.url));
    },
  )

  .get("/tags", async (c) => {
    const result = await db.execute<{ tag: string }>(
      sql`select distinct unnest(${recipes.tags}) as tag from ${recipes} where ${recipes.userId} = ${c.get("session").user.id} order by 1`,
    );
    return c.json(result.map((r) => r.tag));
  })

  .get("/:id", idParam, async (c) => c.json(await fullRecipe(c.get("session").user.id, c.req.valid("param").id)))

  .post("/", zValidator("json", recipeBody), async (c) => {
    const userId = c.get("session").user.id;
    const { ingredients, ...body } = c.req.valid("json");
    await checkFoods(userId, ingredients);
    const id = await db.transaction(async (tx) => {
      const [recipe] = await tx.insert(recipes).values({ ...body, userId }).returning({ id: recipes.id });
      await insertIngredients(tx, recipe.id, ingredients);
      return recipe.id;
    });
    return c.json(await fullRecipe(userId, id), 201);
  })

  // Replaces the whole recipe, including its ingredient list
  .put("/:id", idParam, zValidator("json", recipeBody), async (c) => {
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");
    const { ingredients, ...body } = c.req.valid("json");
    await ownedRecipe(userId, id);
    await checkFoods(userId, ingredients);
    await db.transaction(async (tx) => {
      await tx.update(recipes).set(body).where(eq(recipes.id, id));
      await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
      await insertIngredients(tx, id, ingredients);
    });
    return c.json(await fullRecipe(userId, id));
  })

  .delete("/:id", idParam, async (c) => {
    const [deleted] = await db
      .delete(recipes)
      .where(and(eq(recipes.id, c.req.valid("param").id), eq(recipes.userId, c.get("session").user.id)))
      .returning({ id: recipes.id });
    if (!deleted) throw new HTTPException(404, { message: "Recipe not found" });
    return c.body(null, 204);
  })

  // Adds one diary entry for some servings, or a weight of the cooked dish
  .post("/:id/log", idParam, zValidator("json", logBody), async (c) => {
    const userId = c.get("session").user.id;
    const recipe = await fullRecipe(userId, c.req.valid("param").id);
    const body = c.req.valid("json");
    if ("grams" in body && !recipe.cookedWeightG) {
      throw new HTTPException(400, { message: "Add a cooked weight to this recipe to log it in grams" });
    }
    const { macros, grams } = portion(
      recipe.totals,
      recipe.servings,
      recipe.cookedWeightG,
      "grams" in body ? { grams: body.grams } : { servings: body.servings },
    );
    const [entry] = await db
      .insert(foodLogEntries)
      .values({ userId, date: body.date, slot: body.slot, recipeId: recipe.id, name: recipe.name, grams, ...macros })
      .returning();
    return c.json(entry, 201);
  });
