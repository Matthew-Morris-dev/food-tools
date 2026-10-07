// Pasted recipe text: an optional title, an ingredients list and a method.

export type TextRecipe = { name: string | null; servings: number | null; ingredients: string[]; method: string };

const INGREDIENTS_HEADING = /^\s*(?:#+\s*)?ingredients?\s*:?\s*$/i;
const METHOD_HEADING = /^\s*(?:#+\s*)?(?:method|instructions?|directions?|steps?|preparation)\s*:?\s*$/i;
// Starts like a quantity: a number, a fraction, or an amount word
const LOOKS_LIKE_INGREDIENT = /^\s*(?:[-•*▢☐]\s*)?(?:\d|[½¼¾⅓⅔⅛]|(?:a|an|one|two|three|half)\s+(?:pinch|handful|bunch|knob|clove|tin|can)\b)/i;
const STEP_NUMBER = /^\s*(?:step\s*)?\d+[.)]\s+/i;

export function parseRecipeText(text: string): TextRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const servingsLine = lines.find((l) => /^(?:serves|servings?|makes|yield)\b[:\s]+\d+/i.test(l));
  const servings = servingsLine ? Number(servingsLine.match(/\d+/)![0]) : null;

  const ingStart = lines.findIndex((l) => INGREDIENTS_HEADING.test(l));
  const methodStart = lines.findIndex((l) => METHOD_HEADING.test(l));

  let ingredients: string[];
  let method: string[];
  let preface: string[] = [];

  if (ingStart >= 0) {
    preface = lines.slice(0, ingStart);
    const ingEnd = methodStart > ingStart ? methodStart : lines.length;
    ingredients = lines.slice(ingStart + 1, ingEnd);
    method = methodStart > ingStart ? lines.slice(methodStart + 1) : [];
  } else {
    // No headings: numbered steps and long sentences are method, quantity-led lines are ingredients
    const firstIngredient = lines.findIndex((l) => LOOKS_LIKE_INGREDIENT.test(l) && !STEP_NUMBER.test(l));
    preface = firstIngredient > 0 ? lines.slice(0, firstIngredient) : [];
    const rest = firstIngredient >= 0 ? lines.slice(firstIngredient) : lines;
    ingredients = rest.filter((l) => LOOKS_LIKE_INGREDIENT.test(l) && !STEP_NUMBER.test(l) && l.length < 100);
    method = rest.filter((l) => !ingredients.includes(l));
  }

  const name = preface.find((l) => !/^(?:serves|servings?|makes|yield)\b/i.test(l) && l.length <= 120) ?? null;
  return {
    name,
    servings,
    ingredients: ingredients.filter((l) => !/^(?:serves|servings?|makes|yield)\b/i.test(l)),
    method: method.map((l, i) => (STEP_NUMBER.test(l) ? l : `${i + 1}. ${l}`)).join("\n"),
  };
}
