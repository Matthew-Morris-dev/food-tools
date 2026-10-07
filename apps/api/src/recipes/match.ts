// Matches an ingredient name ("chicken breast") to foods in the database. Ranking is a
// pure function so the choices can be tested without a database.

// UK recipe wording to the way CoFID names foods. The first rule that matches is used,
// so specific wording comes before general ("egg yolk" before "egg").
const SYNONYMS: [RegExp, string][] = [
  [/\bchicken breasts?\b/, "chicken light meat raw"],
  [/\bchicken (?:thighs?|drumsticks?|legs?)\b/, "chicken dark meat raw"],
  [/\b(?:minced beef|beef mince|ground beef)\b/, "beef mince raw"],
  [/\b(?:minced lamb|lamb mince)\b/, "lamb mince raw"],
  [/\b(?:minced pork|pork mince)\b/, "pork mince raw"],
  [/\b(?:chopped|tinned|canned) tomatoes\b/, "tomatoes canned"],
  [/\bplain flour\b/, "flour plain white"],
  [/\bself[- ]raising flour\b/, "flour self-raising white"],
  [/\b(?:caster|granulated) sugar\b/, "sugar white"],
  [/\bspring onions?\b/, "spring onions raw"],
  [/(?<!cherry\s|plum\s|sun-dried\s|sundried\s)\btomatoes?\b/, "tomatoes standard raw"],
  [/\bgarlic(?: cloves?)?\b/, "garlic raw"],
  [/\begg yolks?\b/, "eggs chicken yolk raw"],
  [/\begg whites?\b/, "eggs chicken white raw"],
  [/\beggs?\b/, "eggs chicken whole raw"],
  [/\b(?:whole|full[- ]fat) milk\b/, "milk whole"],
  [/\bskimmed milk\b/, "milk skimmed"],
  [/\b(?:semi[- ]skimmed )?milk\b/, "milk semi-skimmed"],
  [/\bunsalted butter\b/, "butter unsalted"],
  [/\bbutter\b/, "butter salted"],
  [/\b(?:basmati)\b.*\brice\b|\brice\b.*\bbasmati\b/, "rice white basmati raw"],
  [/\b(?:long[- ]grain )?rice\b/, "rice white long grain raw"],
  [/\b(?:pasta|spaghetti|penne|fusilli|linguine|tagliatelle|macaroni)\b/, "pasta white dried raw"],
  [/\bcheddar\b|\bcheese\b/, "cheese cheddar english"],
  [/\bnew potatoes?\b/, "potatoes new"],
  [/\bsweet potatoes?\b/, "sweet potato raw"],
  [/\bpotatoes?\b/, "potatoes old raw"],
  [/\bstreaky bacon\b/, "bacon rashers streaky raw"],
  [/\bbacon\b/, "bacon rashers back raw"],
  [/\bmushrooms?\b/, "mushrooms white raw"],
  [/\b(?:wholemeal|brown|granary) bread\b/, "bread wholemeal"],
  [/\bbread\b/, "bread white average"],
];

const STOP_WORDS = new Set([
  "fresh", "large", "small", "medium", "good", "quality", "organic", "free-range", "boneless", "skinless", "extra", "virgin",
  "finely", "freshly", "ripe", "whole", "of", "the", "a", "an", "and", "or", "with", "for", "to",
]);

const singular = (t: string) =>
  t.endsWith("oes") ? t.slice(0, -2) : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;

const words = (text: string) => text.split(/\s+/).filter((t) => t.length >= 2);

export function queryTokens(name: string): string[] {
  let text = name.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  let replacement = "";
  for (const [re, to] of SYNONYMS) {
    if (re.test(text)) {
      text = text.replace(re, " ");
      replacement = to;
      break;
    }
  }
  // Filler words are dropped from what the user wrote, but never from a replacement
  const rest = words(text).filter((t) => !STOP_WORDS.has(t));
  // "tomatoes" -> "tomato", so a token matches both spellings
  return [...new Set([...words(replacement), ...rest].map(singular))];
}

const PROCESSED = /\b(fried|roasted|boiled|baked|stewed|grilled|steamed|stir-fried|casseroled|canned|powder|juice|sauce|soup|crisps|pudding|cake|biscuits?|bread|sandwich|pie|curry|takeaway|salad|pickled|smoked|dried|frozen|battered|breaded|stuffed|mashed|chips)\b/;
// Flavoured and sweetened versions are rarely what a recipe means
const FLAVOURED = /\b(fruit|flavoured|sweetened|chocolate|vanilla|strawberry|caramel|honey|sugar-free)\b/;
const PLAIN = /\b(plain|natural|unsweetened)\b/;
const SUBSTITUTE = /\b(substitute|imitation|alternative)\b/;
const MADE_UP = /\b(homemade|retail|takeaway|ready meal)\b/;

export type Candidate = { id: string; name: string; source: "cofid" | "off" | "custom"; owned: boolean };

export function scoreFood(tokens: string[], food: Candidate): number {
  const name = food.name.toLowerCase();
  const firstSegment = name.split(",")[0];
  let score = 0;
  if (food.owned) score += 40;
  if (/\braw\b/.test(name) && !tokens.includes("raw")) score += 15;
  // Tokens in the first part of the name ("Oil, sunflower" beats "Onions, fried in sunflower oil")
  score += 10 * tokens.filter((t) => firstSegment.includes(t)).length;
  const processed = name.match(PROCESSED)?.[1];
  if (processed && !tokens.some((t) => processed.includes(t))) score -= 25;
  if (MADE_UP.test(name)) score -= 15;
  const flavour = name.match(FLAVOURED)?.[1];
  if (flavour && !tokens.some((t) => flavour.includes(t))) score -= 20;
  if (PLAIN.test(name)) score += 10;
  // Weights that include bone or shell are the wrong basis for a recipe amount
  if (/weighed with/.test(name)) score -= 40;
  if (SUBSTITUTE.test(name)) score -= 30;
  // "Lemon sole" is not "lemon": penalise extra words in the main part of the name
  const extra = firstSegment.split(/\s+/).filter((w) => w && !tokens.some((t) => w.startsWith(t))).length;
  score -= 20 * extra;
  if (food.source === "off") score -= 10;
  return score - name.length / 5;
}

export function rankFoods<T extends Candidate>(tokens: string[], candidates: T[]): T[] {
  return [...candidates].sort((a, b) => scoreFood(tokens, b) - scoreFood(tokens, a));
}
