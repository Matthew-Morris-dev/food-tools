import type { ParsedIngredient } from "./parse-ingredient";

export type GramsResult = {
  grams: number | null;
  // True when the weight is a guess from a volume or a count, so the user should check it
  estimated: boolean;
};

const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const VOLUME_ML: Record<string, number> = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240, pint: 568 };

// Grams per millilitre for ingredients that aren't about the density of water
const DENSITY: [RegExp, number][] = [
  [/\b(oil)\b/, 0.92],
  [/\b(butter|lard|ghee)\b/, 0.95],
  [/\b(honey|syrup|treacle|molasses)\b/, 1.4],
  [/\b(flour|cornflour|cornstarch)\b/, 0.53],
  [/\b(sugar|caster|icing)\b/, 0.85],
  [/\b(salt)\b/, 1.2],
  [/\b(rice|couscous|quinoa|lentils?)\b/, 0.8],
  [/\b(oats|porridge)\b/, 0.35],
  [/\b(cocoa)\b/, 0.45],
  [/\b(ground|powder|paprika|cumin|turmeric|cinnamon|spice|seasoning)\b/, 0.5],
  [/\b(milk|cream|yoghurt|yogurt|stock|broth|water|juice|wine|vinegar)\b/, 1.03],
];

// Typical weights of one, in grams, for ingredients counted by number
const EACH: [RegExp, number][] = [
  [/\begg yolks?\b/, 18],
  [/\begg whites?\b/, 33],
  [/\begg(s)?\b/, 55],
  [/\bspring onions?\b/, 15],
  [/\bonions?\b/, 110],
  [/\bcarrots?\b/, 80],
  [/\bsweet potato(es)?\b/, 250],
  [/\bpotato(es)?\b/, 170],
  [/\btomato(es)?\b/, 85],
  [/\bpeppers?\b/, 150],
  [/\bcourgettes?\b/, 200],
  [/\baubergines?\b/, 300],
  [/\bleeks?\b/, 150],
  [/\bavocados?\b/, 150],
  [/\bbananas?\b/, 120],
  [/\bapples?\b/, 150],
  [/\blemons?\b/, 60],
  [/\blimes?\b/, 45],
  [/\bchillies|chillis?|chilli\b/, 15],
  [/\bmushrooms?\b/, 20],
  [/\bchicken breasts?\b/, 150],
  [/\bchicken (thighs?|drumsticks?|legs?)\b/, 90],
  [/\bsausages?\b/, 60],
  [/\bbay leaf|bay leaves\b/, 0.2],
  [/\bgarlic cloves?\b/, 4],
  [/\btortillas?\b/, 45],
  [/\bpitta?s?\b/, 60],
];

// Typical weights for named units, by what they're counting
const UNIT_G: Record<string, number | [RegExp, number][]> = {
  pinch: 0.4,
  dash: 0.6,
  handful: 30,
  clove: 4,
  knob: 15,
  rasher: 30,
  slice: [[/\b(bread|toast)\b/, 36], [/\b(cheese)\b/, 20], [/\b(ham|bacon|meat)\b/, 25], [/.*/, 30]],
  sprig: 2,
  stick: [[/\bcelery\b/, 40], [/\bcinnamon\b/, 3], [/\bbutter\b/, 125], [/.*/, 40]],
  stalk: 40,
  bunch: [[/\b(parsley|coriander|basil|mint|dill|chives?|herbs?)\b/, 30], [/\bspring onions?\b/, 100], [/.*/, 100]],
  head: [[/\bgarlic\b/, 50], [/\bbroccoli|cauliflower\b/, 300], [/.*/, 300]],
  piece: [[/\bginger\b/, 25], [/.*/, 50]],
  fillet: [[/\b(fish|salmon|cod|haddock|sea bass|trout)\b/, 140], [/.*/, 150]],
  can: 400,
};

const SIZE_FACTOR = { small: 0.7, medium: 1, large: 1.4 } as const;

export function density(name: string) {
  const lower = name.toLowerCase();
  return DENSITY.find(([re]) => re.test(lower))?.[1] ?? 1;
}

const lookup = (table: [RegExp, number][], name: string) => table.find(([re]) => re.test(name))?.[1] ?? null;

// How many grams an ingredient line stands for. Exact for weights, an estimate for
// volumes and counts, and null when there's nothing to go on.
export function toGrams(
  ing: Pick<ParsedIngredient, "quantity" | "unit" | "name" | "size">,
  food?: { servings: { label: string; grams: number }[] } | null,
): GramsResult {
  const name = ing.name.toLowerCase();
  if (ing.quantity === null) return { grams: null, estimated: false };
  const q = ing.quantity;

  if (ing.unit && ing.unit in WEIGHT_G) return { grams: round(q * WEIGHT_G[ing.unit]), estimated: false };
  if (ing.unit === "floz") return { grams: round(q * 28.41 * density(name)), estimated: true };
  if (ing.unit && ing.unit in VOLUME_ML) return { grams: round(q * VOLUME_ML[ing.unit] * density(name)), estimated: true };

  if (ing.unit && ing.unit in UNIT_G) {
    const each = UNIT_G[ing.unit];
    const g = typeof each === "number" ? each : lookup(each, name);
    return g === null ? { grams: null, estimated: false } : { grams: round(q * g), estimated: true };
  }

  if (ing.unit === null) {
    const each = lookup(EACH, name);
    if (each !== null) return { grams: round(q * each * (ing.size ? SIZE_FACTOR[ing.size] : 1)), estimated: true };
    // A packaged product with a serving size: "2 yoghurts"
    if (food?.servings[0]) return { grams: round(q * food.servings[0].grams), estimated: true };
  }
  return { grams: null, estimated: false };
}

const round = (n: number) => Math.round(n * 10) / 10;
