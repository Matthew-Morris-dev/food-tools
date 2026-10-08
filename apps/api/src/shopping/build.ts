// Works out what to buy from a week's plan. Pure, so the rules are easy to test.

export type PlanEntryInput = {
  id: string;
  date: string;
  recipeId: string | null;
  foodId: string | null;
  foodName: string | null;
  servings: number | null;
  grams: number | null;
  leftoverOfId: string | null;
  confirmed: boolean;
};

export type RecipeInput = {
  id: string;
  name: string;
  servings: number;
  ingredients: { foodId: string | null; name: string; quantity: number | null; unit: string | null; grams: number }[];
};

export type Need = {
  key: string;
  name: string;
  foodId: string | null;
  grams: number;
  // How many, when every contribution was counted ("3 onions") rather than weighed
  count: number | null;
  // The amount as written, for unmatched ingredients with no weight ("3 tbsp")
  written: string | null;
  sources: { label: string; dates: string[] }[];
};

export const normaliseName = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();
const round1 = (n: number) => Math.round(n * 10) / 10;

type Acc = Need & { allCounted: boolean; counted: number; writtenParts: string[] };

export function buildNeeds(
  entries: PlanEntryInput[],
  recipes: Map<string, RecipeInput>,
  options: { from?: string } = {},
): Need[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const acc = new Map<string, Acc>();

  const add = (key: string, name: string, foodId: string | null, source: { label: string; date: string }) => {
    let item = acc.get(key);
    if (!item) {
      item = { key, name, foodId, grams: 0, count: null, written: null, sources: [], allCounted: true, counted: 0, writtenParts: [] };
      acc.set(key, item);
    }
    const existing = item.sources.find((s) => s.label === source.label);
    if (existing) {
      if (!existing.dates.includes(source.date)) existing.dates.push(source.date);
    } else item.sources.push({ label: source.label, dates: [source.date] });
    return item;
  };

  // Meals eaten from another meal's cook, grouped under that cook
  const leftoversOf = new Map<string, PlanEntryInput[]>();
  for (const e of entries) {
    if (e.leftoverOfId && byId.has(e.leftoverOfId)) {
      leftoversOf.set(e.leftoverOfId, [...(leftoversOf.get(e.leftoverOfId) ?? []), e]);
    }
  }

  for (const e of entries) {
    // Already eaten, or in the past: already bought
    if (e.confirmed || (options.from && e.date < options.from)) continue;
    // Leftovers are bought for with their cook (an orphan one counts as its own cook)
    if (e.leftoverOfId && byId.has(e.leftoverOfId)) continue;

    if (e.foodId && e.grams) {
      const name = e.foodName ?? "Food";
      add(`food:${e.foodId}`, name, e.foodId, { label: name, date: e.date }).grams += e.grams;
      continue;
    }
    const recipe = e.recipeId ? recipes.get(e.recipeId) : undefined;
    if (!recipe || !e.servings || recipe.servings <= 0) continue;

    // Buy for everything eaten from this cook: its own servings plus every leftover
    const eaten = e.servings + (leftoversOf.get(e.id) ?? []).reduce((s, l) => s + (l.servings ?? 0), 0);
    const scale = eaten / recipe.servings;

    for (const ing of recipe.ingredients) {
      const key = ing.foodId ? `food:${ing.foodId}` : `name:${normaliseName(ing.name)}`;
      const item = add(key, ing.name, ing.foodId, { label: recipe.name, date: e.date });
      item.grams += ing.grams * scale;
      if (ing.unit === null && ing.quantity !== null) item.counted += ing.quantity * scale;
      else item.allCounted = false;
      if (!ing.foodId && ing.grams === 0 && ing.quantity !== null) {
        item.writtenParts.push(`${round1(ing.quantity * scale)}${ing.unit ? ` ${ing.unit}` : ""}`);
      }
    }
  }

  return [...acc.values()].map(({ allCounted, counted, writtenParts, ...need }) => ({
    ...need,
    grams: round1(need.grams),
    count: allCounted && counted > 0 ? Math.ceil(counted - 0.01) : null,
    written: need.grams === 0 && writtenParts.length ? writtenParts.join(" + ") : null,
  }));
}
