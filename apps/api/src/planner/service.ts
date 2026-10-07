import { and, between, eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { foods, mealPlanEntries, plannerSettings, recipes } from "../db/schema";
import { loadRows, present } from "../routes/recipes";
import { visibleTo } from "../routes/foods";
import { dietViolations } from "./diet";
import { entryMacros } from "./nutrition";

export type PlannerSettings = { diets: string[]; excludedWords: string[] };

export async function loadSettings(userId: string): Promise<PlannerSettings> {
  const [row] = await db.select().from(plannerSettings).where(eq(plannerSettings.userId, userId));
  return { diets: row?.diets ?? [], excludedWords: row?.excludedWords ?? [] };
}

export type RecipeInfo = ReturnType<typeof present>;

// The user's recipes with their nutrition and ingredient names, keyed by id
export async function loadRecipes(userId: string, ids?: string[]) {
  const list = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.userId, userId), ids ? inArray(recipes.id, ids) : undefined));
  const rows = await loadRows(list.map((r) => r.id));
  return new Map(list.map((r) => [r.id, present(r, rows.get(r.id) ?? [])] as const));
}

export type PlanEntryView = {
  id: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId: string | null;
  foodId: string | null;
  servings: number | null;
  grams: number | null;
  leftoverOfId: string | null;
  locked: boolean;
  logEntryId: string | null;
  confirmed: boolean;
  name: string;
  brand: string | null;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  // Diet or exclusion words found in the ingredients
  warnings: string[];
  // A recipe with unmatched ingredients, so its numbers are too low
  incomplete: boolean;
};

// Planned meals between two dates, with nutrition worked out from the live recipe or food
export async function loadEntries(userId: string, from: string, to: string): Promise<PlanEntryView[]> {
  const rows = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.userId, userId), between(mealPlanEntries.date, from, to)))
    .orderBy(mealPlanEntries.date, mealPlanEntries.createdAt);
  if (rows.length === 0) return [];

  const recipeIds = [...new Set(rows.flatMap((r) => (r.recipeId ? [r.recipeId] : [])))];
  const foodIds = [...new Set(rows.flatMap((r) => (r.foodId ? [r.foodId] : [])))];
  const recipeMap = recipeIds.length ? await loadRecipes(userId, recipeIds) : new Map<string, RecipeInfo>();
  const foodRows = foodIds.length
    ? await db.select().from(foods).where(and(inArray(foods.id, foodIds), visibleTo(userId)))
    : [];
  const foodMap = new Map(foodRows.map((f) => [f.id, f]));
  const settings = await loadSettings(userId);

  return rows.map((e) => {
    const recipe = e.recipeId ? (recipeMap.get(e.recipeId) ?? null) : null;
    const food = e.foodId ? (foodMap.get(e.foodId) ?? null) : null;
    const names = recipe ? recipe.ingredients.map((i) => i.name) : food ? [food.name] : [];
    return {
      id: e.id,
      date: e.date,
      slot: e.slot,
      recipeId: e.recipeId,
      foodId: e.foodId,
      servings: e.servings,
      grams: e.grams,
      leftoverOfId: e.leftoverOfId,
      locked: e.locked,
      logEntryId: e.logEntryId,
      confirmed: e.logEntryId !== null,
      name: recipe?.name ?? food?.name ?? "Unknown",
      brand: food?.brand ?? null,
      macros: entryMacros({ servings: e.servings, grams: e.grams, recipe, food }),
      warnings: dietViolations(names, settings.diets, settings.excludedWords),
      incomplete: recipe?.incomplete ?? false,
    };
  });
}
