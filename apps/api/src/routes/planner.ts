import { zValidator } from "@hono/zod-validator";
import { and, between, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foodLogEntries, foods, mealPlanEntries, plannerSettings } from "../db/schema";
import { weekDates } from "../dates";
import { autoFill, type Candidate } from "../planner/autofill";
import { dayTargetsInRange } from "../goals/day";
import { DIET_PRESETS } from "../planner/diet";
import { fitDay } from "../planner/fit";
import { sumMacros } from "../planner/nutrition";
import { loadEntries, loadRecipes, loadSettings, type PlanEntryView } from "../planner/service";
import { requireSession, type AuthEnv } from "../middleware";
import { forGrams } from "../nutrition";
import { portion } from "../recipes/nutrition";
import { visibleTo } from "./foods";

const day = z.iso.date();
const slot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const idParam = zValidator("param", z.object({ id: z.uuid() }));
const servings = z.number().min(0.25).max(50);
const grams = z.number().min(1).max(5000);

const newEntry = z
  .object({
    date: day,
    slot,
    recipeId: z.uuid().optional(),
    foodId: z.uuid().optional(),
    servings: servings.optional(),
    grams: grams.optional(),
    leftoverOfId: z.uuid().optional(),
    locked: z.boolean().optional(),
  })
  .refine((e) => (e.recipeId ? !e.foodId && e.servings !== undefined : e.foodId !== undefined && e.grams !== undefined), {
    message: "A planned meal is a recipe with servings, or a food with grams",
  });

async function ownedEntry(userId: string, id: string) {
  const [entry] = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, userId)));
  if (!entry) throw new HTTPException(404, { message: "Planned meal not found" });
  return entry;
}

async function planDay(userId: string, date: string) {
  const [entries, targets] = await Promise.all([loadEntries(userId, date, date), dayTargetsInRange(userId, date, date)]);
  return dayView(date, entries, targets.get(date) ?? null);
}

function dayView(date: string, entries: PlanEntryView[], targets: Awaited<ReturnType<typeof dayTargetsInRange>> extends Map<string, infer T> ? T | null : never) {
  return {
    date,
    targets: targets?.targets ?? null,
    trainingDay: targets?.trainingDay ?? false,
    totals: sumMacros(entries.map((e) => e.macros)),
    entries,
  };
}

// Logs a planned meal to the diary (optionally adjusted) and links the two
async function logPlanned(userId: string, id: string, overrides: { slot?: PlanEntryView["slot"]; servings?: number; grams?: number }) {
  const entry = await ownedEntry(userId, id);
  if (entry.logEntryId) throw new HTTPException(409, { message: "That meal is already logged" });

  let values: { name: string; brand: string | null; recipeId: string | null; foodId: string | null; grams: number | null; kcal: number; protein: number; carbs: number; fat: number };
  if (entry.recipeId) {
    const recipe = (await loadRecipes(userId, [entry.recipeId])).get(entry.recipeId);
    if (!recipe) throw new HTTPException(404, { message: "Recipe not found" });
    const { macros, grams: weight } = portion(recipe.totals, recipe.servings, recipe.cookedWeightG, { servings: overrides.servings ?? entry.servings ?? 1 });
    values = { name: recipe.name, brand: null, recipeId: recipe.id, foodId: null, grams: weight, ...macros };
  } else {
    const [food] = await db
      .select()
      .from(foods)
      .where(and(eq(foods.id, entry.foodId!), visibleTo(userId)));
    if (!food) throw new HTTPException(404, { message: "Food not found" });
    const g = overrides.grams ?? entry.grams ?? 100;
    values = { name: food.name, brand: food.brand, recipeId: null, foodId: food.id, grams: g, ...forGrams(food, g) };
  }

  return db.transaction(async (tx) => {
    const [logged] = await tx
      .insert(foodLogEntries)
      .values({ userId, date: entry.date, slot: overrides.slot ?? entry.slot, ...values })
      .returning();
    await tx.update(mealPlanEntries).set({ logEntryId: logged.id }).where(eq(mealPlanEntries.id, id));
    return logged;
  });
}

export const plannerRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  // The week containing `date`
  .get("/", zValidator("query", z.object({ date: day })), async (c) => {
    const userId = c.get("session").user.id;
    const dates = weekDates(c.req.valid("query").date);
    const [entries, targets, settings] = await Promise.all([
      loadEntries(userId, dates[0], dates[6]),
      dayTargetsInRange(userId, dates[0], dates[6]),
      loadSettings(userId),
    ]);
    return c.json({
      weekStart: dates[0],
      days: dates.map((d) => dayView(d, entries.filter((e) => e.date === d), targets.get(d) ?? null)),
      settings,
    });
  })

  // A day's planned meals that haven't been eaten yet, for Today
  .get("/day/:date", zValidator("param", z.object({ date: day })), async (c) => {
    const entries = await loadEntries(c.get("session").user.id, c.req.valid("param").date, c.req.valid("param").date);
    return c.json(entries.filter((e) => !e.confirmed));
  })

  .post("/entries", zValidator("json", newEntry), async (c) => {
    const userId = c.get("session").user.id;
    const body = c.req.valid("json");

    if (body.recipeId) {
      if (!(await loadRecipes(userId, [body.recipeId])).has(body.recipeId)) throw new HTTPException(404, { message: "Recipe not found" });
    } else {
      const [food] = await db.select({ id: foods.id }).from(foods).where(and(eq(foods.id, body.foodId!), visibleTo(userId)));
      if (!food) throw new HTTPException(404, { message: "Food not found" });
    }
    if (body.leftoverOfId) {
      const cook = await ownedEntry(userId, body.leftoverOfId);
      if (!body.recipeId || cook.recipeId !== body.recipeId) {
        throw new HTTPException(400, { message: "Leftovers must be of the same recipe" });
      }
    }

    const [created] = await db
      .insert(mealPlanEntries)
      .values({
        userId,
        date: body.date,
        slot: body.slot,
        recipeId: body.recipeId ?? null,
        foodId: body.recipeId ? null : (body.foodId ?? null),
        servings: body.recipeId ? body.servings : null,
        grams: body.recipeId ? null : body.grams,
        leftoverOfId: body.leftoverOfId ?? null,
        locked: body.locked ?? false,
      })
      .returning({ id: mealPlanEntries.id });
    const entry = (await loadEntries(userId, body.date, body.date)).find((e) => e.id === created.id);
    return c.json(entry, 201);
  })

  .patch(
    "/entries/:id",
    idParam,
    zValidator("json", z.object({ date: day.optional(), slot: slot.optional(), servings: servings.optional(), grams: grams.optional(), locked: z.boolean().optional() })),
    async (c) => {
      const userId = c.get("session").user.id;
      const entry = await ownedEntry(userId, c.req.valid("param").id);
      if (entry.logEntryId) throw new HTTPException(409, { message: "That meal has been eaten, so it can't be changed" });
      const changes = c.req.valid("json");
      if (changes.servings !== undefined && !entry.recipeId) throw new HTTPException(400, { message: "Servings only apply to recipes" });
      if (changes.grams !== undefined && !entry.foodId) throw new HTTPException(400, { message: "Grams only apply to foods" });
      if (Object.keys(changes).length > 0) await db.update(mealPlanEntries).set(changes).where(eq(mealPlanEntries.id, entry.id));
      const date = changes.date ?? entry.date;
      return c.json((await loadEntries(userId, date, date)).find((e) => e.id === entry.id));
    },
  )

  .delete("/entries/:id", idParam, async (c) => {
    const userId = c.get("session").user.id;
    const entry = await ownedEntry(userId, c.req.valid("param").id);
    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, entry.id));
    return c.body(null, 204);
  })

  // Several at once, e.g. to undo an auto-fill. Only the user's own are removed.
  .post("/entries/delete", zValidator("json", z.object({ ids: z.array(z.uuid()).min(1).max(200) })), async (c) => {
    const deleted = await db
      .delete(mealPlanEntries)
      .where(and(eq(mealPlanEntries.userId, c.get("session").user.id), inArray(mealPlanEntries.id, c.req.valid("json").ids)))
      .returning({ id: mealPlanEntries.id });
    return c.json({ deleted: deleted.length });
  })

  // Portion scaling: bring the day's calories to its target
  .post("/days/:date/fit", zValidator("param", z.object({ date: day })), async (c) => {
    const userId = c.get("session").user.id;
    const { date } = c.req.valid("param");
    const view = await planDay(userId, date);
    if (!view.targets) throw new HTTPException(409, { message: "Set a goal first so there's a target to fit to" });

    const result = fitDay(
      view.entries.map((e) => ({
        id: e.id,
        kcal: e.macros.kcal,
        servings: e.servings ?? 0,
        // Single foods, locked and eaten meals and leftovers stay as they are
        flexible: !!e.recipeId && !e.locked && !e.confirmed && !e.leftoverOfId,
      })),
      view.targets.kcal,
    );
    await db.transaction(async (tx) => {
      for (const change of result.changes) {
        await tx.update(mealPlanEntries).set({ servings: change.servings }).where(eq(mealPlanEntries.id, change.id));
      }
    });
    return c.json({ day: await planDay(userId, date), clamped: result.clamped });
  })

  .post(
    "/entries/:id/log",
    idParam,
    zValidator("json", z.object({ slot: slot.optional(), servings: servings.optional(), grams: grams.optional() })),
    async (c) => c.json(await logPlanned(c.get("session").user.id, c.req.valid("param").id, c.req.valid("json")), 201),
  )

  .post("/days/:date/log", zValidator("param", z.object({ date: day })), async (c) => {
    const userId = c.get("session").user.id;
    const pending = (await loadEntries(userId, c.req.valid("param").date, c.req.valid("param").date)).filter((e) => !e.confirmed);
    const logged = [];
    for (const entry of pending) logged.push(await logPlanned(userId, entry.id, {}));
    return c.json(logged, 201);
  })

  // Fills the week's empty slots from the user's recipes and saves the result. The
  // new ids are returned so the app can offer Undo through the bulk delete.
  .post(
    "/autofill",
    zValidator(
      "json",
      z.object({
        date: day,
        slots: z.array(slot).min(1).max(4),
        leftovers: z.boolean().default(false),
        // Clears this week's unlocked, uneaten meals in those slots first
        replace: z.boolean().default(false),
      }),
    ),
    async (c) => {
      const userId = c.get("session").user.id;
      const body = c.req.valid("json");
      const dates = weekDates(body.date);

      const targets = await dayTargetsInRange(userId, dates[0], dates[6]);
      if (targets.size === 0) throw new HTTPException(409, { message: "Set a goal first so there are targets to fill towards" });

      let replaced = 0;
      if (body.replace) {
        const removed = await db
          .delete(mealPlanEntries)
          .where(
            and(
              eq(mealPlanEntries.userId, userId),
              between(mealPlanEntries.date, dates[0], dates[6]),
              inArray(mealPlanEntries.slot, body.slots),
              isNull(mealPlanEntries.logEntryId),
              eq(mealPlanEntries.locked, false),
            ),
          )
          .returning({ id: mealPlanEntries.id });
        replaced = removed.length;
      }

      const [existing, recipes, settings] = await Promise.all([loadEntries(userId, dates[0], dates[6]), loadRecipes(userId), loadSettings(userId)]);
      const candidates: Candidate[] = [...recipes.values()].map((r) => ({
        id: r.id,
        name: r.name,
        slots: r.slots as Candidate["slots"],
        preference: r.preference,
        perServing: r.perServing,
        servings: r.servings,
        ingredientNames: r.ingredients.map((i) => i.name),
        incomplete: r.incomplete,
      }));

      const result = autoFill({
        weekStart: dates[0],
        dates,
        targets: new Map([...targets].map(([d, t]) => [d, t.targets.kcal])),
        slots: body.slots,
        candidates,
        existing: existing.map((e) => ({ date: e.date, slot: e.slot, kcal: e.macros.kcal, recipeId: e.recipeId, leftover: e.leftoverOfId !== null })),
        diets: settings.diets,
        excludedWords: settings.excludedWords,
        leftovers: body.leftovers,
      });

      // Cooks are saved before the leftovers that point at them
      const realIds = new Map<string, string>();
      const ordered = [...result.entries].sort((a, b) => Number(a.leftoverOfTempId !== null) - Number(b.leftoverOfTempId !== null));
      await db.transaction(async (tx) => {
        for (const e of ordered) {
          const [row] = await tx
            .insert(mealPlanEntries)
            .values({
              userId,
              date: e.date,
              slot: e.slot,
              recipeId: e.recipeId,
              servings: e.servings,
              leftoverOfId: e.leftoverOfTempId ? (realIds.get(e.leftoverOfTempId) ?? null) : null,
            })
            .returning({ id: mealPlanEntries.id });
          realIds.set(e.tempId, row.id);
        }
      });

      return c.json({
        ids: [...realIds.values()],
        added: result.entries.length,
        leftovers: result.entries.filter((e) => e.leftoverOfTempId).length,
        replaced,
        skipped: result.skipped,
        excluded: result.excluded,
      });
    },
  )

  .get("/settings", async (c) => c.json({ ...(await loadSettings(c.get("session").user.id)), presets: Object.entries(DIET_PRESETS).map(([id, p]) => ({ id, label: p.label })) }))

  .put(
    "/settings",
    zValidator(
      "json",
      z.object({
        diets: z.array(z.enum(Object.keys(DIET_PRESETS) as [string, ...string[]])).max(6),
        excludedWords: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30),
      }),
    ),
    async (c) => {
      const userId = c.get("session").user.id;
      const body = { diets: [...new Set(c.req.valid("json").diets)], excludedWords: [...new Set(c.req.valid("json").excludedWords)] };
      await db.insert(plannerSettings).values({ userId, ...body }).onConflictDoUpdate({ target: plannerSettings.userId, set: body });
      return c.json(body);
    },
  );

