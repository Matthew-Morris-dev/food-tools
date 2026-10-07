import { and, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import { foods } from "../db/schema";
import { foodColumns, visibleTo } from "../routes/foods";
import { queryTokens, rankFoods, type Candidate } from "./match";
import { parseIngredient } from "./parse-ingredient";
import type { ExtractedRecipe } from "./extract";
import { toGrams } from "./units";

export type MatchedFood = Awaited<ReturnType<typeof candidatesFor>>[number];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function candidatesFor(userId: string, tokens: string[]) {
  if (tokens.length === 0) return [];
  // Generic foods and the user's own first; branded products only if those come up short
  const query = (sources: ("cofid" | "custom" | "off")[]) =>
    db
      .select(foodColumns)
      .from(foods)
      .where(
        and(
          visibleTo(userId),
          inArray(foods.source, sources),
          // Whole words only, allowing a plural: "butter" must not match "butternut"
          ...tokens.map((t) => sql`${foods.name} ~* ${`\\m${escapeRegex(t)}(es|s)?\\M`}`),
        ),
      )
      .orderBy(sql`length(${foods.name})`)
      .limit(40);
  const generic = await query(["cofid", "custom"]);
  return generic.length >= 3 ? generic : [...generic, ...(await query(["off"]))];
}

// Describing words that can be dropped when nothing matches with them ("ground cumin" -> "cumin")
const SAFE_TO_DROP = new Set(["ground", "sweet", "mild", "hot", "dark", "light", "fine", "thick", "thin", "plain", "large", "small", "new", "baby"]);

export async function matchIngredient(userId: string, name: string) {
  const tokens = queryTokens(name);
  let used = tokens;
  let found = await candidatesFor(userId, tokens);
  let approximate = false;
  if (found.length === 0 && tokens.length > 1) {
    const kept = tokens.filter((t) => !SAFE_TO_DROP.has(t));
    if (kept.length > 0 && kept.length < tokens.length) {
      used = kept;
      found = await candidatesFor(userId, kept);
      approximate = found.length > 0;
    }
  }
  const asCandidates: (Candidate & (typeof found)[number])[] = found.map((f) => ({ ...f, owned: f.source === "custom" }));
  const ranked = rankFoods(used, asCandidates);
  return { best: ranked[0] ?? null, alternatives: ranked.slice(0, 5), approximate };
}

export type DraftIngredient = {
  foodId: string | null;
  food: MatchedFood | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  grams: number;
  note: string | null;
  alternatives: MatchedFood[];
  warning?: string;
};

export type Draft = {
  name: string;
  servings: number;
  method: string;
  tags: string[];
  cookedWeightG: null;
  sourceUrl: string | null;
  ingredients: DraftIngredient[];
  warnings: string[];
  siteNutrition: ExtractedRecipe["siteNutrition"];
};

const MAX_INGREDIENTS = 80;

// Turns extracted text into a draft recipe for the user to review: every line parsed,
// matched to a food and given a weight where we can work one out
export async function buildDraft(
  userId: string,
  source: { name: string | null; servings: number | null; ingredients: string[]; method: string; tags?: string[]; siteNutrition?: ExtractedRecipe["siteNutrition"] },
  sourceUrl: string | null,
): Promise<Draft> {
  const warnings: string[] = [];
  const lines = source.ingredients.slice(0, MAX_INGREDIENTS);
  if (source.ingredients.length > MAX_INGREDIENTS) warnings.push(`Only the first ${MAX_INGREDIENTS} ingredients were imported.`);
  if (source.servings === null) warnings.push("The number of servings wasn't given, so it's set to 4. Change it if that's wrong.");

  const ingredients: DraftIngredient[] = [];
  for (const line of lines) {
    const parsed = parseIngredient(line);
    const { best, alternatives, approximate } = await matchIngredient(userId, parsed.name);
    const result = toGrams(parsed, best);

    const warning = !best
      ? "No matching food found. Choose one."
      : approximate
        ? "Closest match. Check it's the right food."
        : result.grams === null
        ? "Couldn't work out the weight. Enter the grams."
        : result.estimated
          ? "Weight estimated from the amount. Check it."
          : undefined;
    ingredients.push({
      foodId: best?.id ?? null,
      food: best,
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      grams: result.grams ?? 0,
      note: parsed.note,
      alternatives,
      warning,
    });
  }

  return {
    name: source.name?.trim() || "Imported recipe",
    servings: source.servings ?? 4,
    method: source.method,
    tags: source.tags ?? [],
    cookedWeightG: null,
    sourceUrl,
    ingredients,
    warnings,
    siteNutrition: source.siteNutrition ?? null,
  };
}

