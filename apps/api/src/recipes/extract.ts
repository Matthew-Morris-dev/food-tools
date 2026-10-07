// Reads the recipe a web page publishes for search engines (schema.org JSON-LD).

export type ExtractedRecipe = {
  name: string;
  servings: number | null;
  ingredients: string[];
  method: string;
  tags: string[];
  // What the site says one serving contains, as a sanity check against our own numbers
  siteNutrition: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", frac12: "½", frac14: "¼", frac34: "¾", deg: "°" };

export function decodeText(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .trim();
}

type Json = unknown;
const isObject = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

function findRecipe(node: Json): Record<string, Json> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  const type = node["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return node;
  for (const value of Object.values(node)) {
    if (typeof value === "object") {
      const found = findRecipe(value);
      if (found) return found;
    }
  }
  return null;
}

function instructions(value: Json): string[] {
  return asArray(value).flatMap((step): string[] => {
    if (typeof step === "string") return decodeText(step).split(/\n+/).filter(Boolean);
    if (!isObject(step)) return [];
    // HowToSection holds HowToSteps
    if (step.itemListElement) return instructions(step.itemListElement);
    const text = step.text ?? step.name;
    return typeof text === "string" ? decodeText(text).split(/\n+/).filter(Boolean) : [];
  });
}

export function parseServings(value: Json): number | null {
  for (const item of asArray(value)) {
    const text = typeof item === "number" ? String(item) : typeof item === "string" ? item : "";
    const match = text.match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

const num = (v: Json) => {
  const m = typeof v === "number" ? String(v) : typeof v === "string" ? (v.match(/\d+(?:\.\d+)?/)?.[0] ?? "") : "";
  return m ? Number(m) : null;
};

export function extractRecipe(html: string): ExtractedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    let data: Json;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;

    const ingredients = asArray(recipe.recipeIngredient ?? recipe.ingredients)
      .filter((i): i is string => typeof i === "string")
      .map((i) => decodeText(i))
      .filter(Boolean);
    if (ingredients.length === 0) continue;

    const nutrition = isObject(recipe.nutrition) ? recipe.nutrition : null;
    const categories = [...asArray(recipe.recipeCategory), ...asArray(recipe.recipeCuisine)];
    return {
      name: typeof recipe.name === "string" ? decodeText(recipe.name) : "Imported recipe",
      servings: parseServings(recipe.recipeYield),
      ingredients,
      method: instructions(recipe.recipeInstructions).map((s, i) => `${i + 1}. ${s}`).join("\n"),
      tags: [...new Set(categories.flatMap((c) => (typeof c === "string" ? c.split(",") : [])).map((t) => decodeText(t).toLowerCase().trim()).filter((t) => t && t.length <= 30))].slice(0, 5),
      siteNutrition: nutrition
        ? {
            kcal: num(nutrition.calories),
            protein: num(nutrition.proteinContent),
            carbs: num(nutrition.carbohydrateContent),
            fat: num(nutrition.fatContent),
          }
        : null,
    };
  }
  return null;
}
