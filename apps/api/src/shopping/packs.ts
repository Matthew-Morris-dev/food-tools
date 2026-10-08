// How things are sold, so a list can say "buy 2 x 400 g" rather than "700 g".

export type Pack = { grams: number; label: string; count?: number };

// Common UK pack sizes. Your own pack size for an item overrides these.
const DEFAULT_PACKS: [RegExp, Pack][] = [
  [/\beggs?\b/, { grams: 330, count: 6, label: "6 eggs" }],
  [/\bchicken (?:breasts?|light meat)\b|\bchicken breast/, { grams: 300, label: "300 g" }],
  [/\bchicken (?:thighs?|dark meat|drumsticks?|legs?)\b/, { grams: 500, label: "500 g" }],
  [/\b(?:beef|lamb|pork|turkey) mince\b|\bmince\b|\bminced\b/, { grams: 500, label: "500 g" }],
  [/\bbacon\b/, { grams: 240, label: "240 g" }],
  [/\bsausages?\b/, { grams: 454, label: "454 g" }],
  [/\bsalmon\b/, { grams: 240, label: "2 fillets (240 g)" }],
  [/\b(?:rice|couscous|quinoa)\b/, { grams: 1000, label: "1 kg" }],
  [/\b(?:pasta|spaghetti|penne|fusilli|linguine|tagliatelle|macaroni|noodles?)\b/, { grams: 500, label: "500 g" }],
  [/\bflour\b/, { grams: 1500, label: "1.5 kg" }],
  [/\bsugar\b/, { grams: 1000, label: "1 kg" }],
  [/\b(?:oats|porridge)\b/, { grams: 1000, label: "1 kg" }],
  [/\bbutter\b/, { grams: 250, label: "250 g" }],
  [/\bcheese|cheddar\b/, { grams: 350, label: "350 g" }],
  [/\bmilk\b/, { grams: 1170, label: "2 pints" }],
  [/\bcream\b/, { grams: 300, label: "300 ml" }],
  [/\b(?:yoghurt|yogurt)\b/, { grams: 500, label: "500 g" }],
  [/\b(?:chopped|canned|tinned)? ?tomatoes\b.*\b(?:canned|chopped|tinned)\b|\b(?:chopped|canned|tinned) tomatoes\b/, { grams: 400, label: "400 g tin" }],
  [/\b(?:chickpeas|beans|lentils|sweetcorn|coconut milk)\b.*(?:canned|tinned)|\b(?:canned|tinned) (?:chickpeas|beans|lentils|sweetcorn)\b|\bcoconut milk\b/, { grams: 400, label: "400 g tin" }],
  [/\bolive oil\b/, { grams: 460, label: "500 ml" }],
  [/\b(?:sunflower|vegetable|rapeseed) oil\b/, { grams: 920, label: "1 litre" }],
  [/\bpotato(?:es)?\b/, { grams: 2000, label: "2 kg bag" }],
  [/\bonions?\b/, { grams: 1000, label: "1 kg bag" }],
  [/\bcarrots?\b/, { grams: 1000, label: "1 kg bag" }],
  [/\bmushrooms?\b/, { grams: 300, label: "300 g" }],
  [/\bbroccoli\b/, { grams: 350, label: "350 g" }],
  [/\bspinach\b/, { grams: 200, label: "200 g bag" }],
  [/\bgarlic\b/, { grams: 50, label: "1 bulb" }],
  [/\bbread\b/, { grams: 800, label: "800 g loaf" }],
];

export function defaultPack(name: string): Pack | null {
  const lower = name.toLowerCase();
  return DEFAULT_PACKS.find(([re]) => re.test(lower))?.[1] ?? null;
}

// Wanting a hair more than a pack (5%) doesn't need a second one
const SLACK = 0.05;

export type PackPlan = { packs: number; packLabel: string; buyGrams: number; buyCount: number | null };

export function planPacks(need: { grams: number; count: number | null }, pack: Pack): PackPlan | null {
  if (pack.count && need.count !== null) {
    const packs = Math.max(1, Math.ceil(need.count / pack.count - SLACK));
    return { packs, packLabel: pack.label, buyGrams: packs * pack.grams, buyCount: packs * pack.count };
  }
  if (need.grams <= 0) return null;
  const packs = Math.max(1, Math.ceil(need.grams / pack.grams - SLACK));
  return { packs, packLabel: pack.label, buyGrams: packs * pack.grams, buyCount: null };
}

// A pack you set yourself, labelled by its weight
export const customPack = (grams: number): Pack => ({ grams, label: formatGrams(grams) });

export function formatGrams(g: number) {
  if (g >= 1000) return `${Math.round(g / 10) / 100} kg`.replace(/\.0+ kg$/, " kg");
  return `${Math.round(g)} g`;
}
