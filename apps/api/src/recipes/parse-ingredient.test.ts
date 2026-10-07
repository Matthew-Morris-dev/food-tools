import { describe, expect, it } from "vitest";

import { parseIngredient } from "./parse-ingredient";

type Case = [line: string, expected: Partial<ReturnType<typeof parseIngredient>>];

const cases: Case[] = [
  ["2 tbsp sunflower oil", { quantity: 2, unit: "tbsp", name: "sunflower oil", note: null }],
  ["1 onion thinly sliced", { quantity: 1, unit: null, name: "onion", note: "thinly sliced" }],
  ["2 garlic cloves crushed", { quantity: 2, unit: null, name: "garlic cloves", note: "crushed" }],
  ["thumb-sized piece of ginger grated", { quantity: 1, unit: "piece", name: "ginger", note: "grated" }],
  ["6 chicken thighs boneless and skinless", { quantity: 6, unit: null, name: "chicken thighs boneless and skinless" }],
  ["3 tbsp medium spice paste (tikka works well)", { quantity: 3, unit: "tbsp", name: "medium spice paste", note: "tikka works well" }],
  ["400g can chopped tomatoes", { quantity: 400, unit: "g", name: "chopped tomatoes" }],
  ["2 x 400g tins chopped tomatoes", { quantity: 800, unit: "g", name: "chopped tomatoes" }],
  ["400 g (14oz) tin chickpeas, drained", { quantity: 400, unit: "g", name: "chickpeas", note: "drained" }],
  ["½ tsp salt", { quantity: 0.5, unit: "tsp", name: "salt" }],
  ["1½ cups plain flour", { quantity: 1.5, unit: "cup", name: "plain flour" }],
  ["1 1/2 tbsp honey", { quantity: 1.5, unit: "tbsp", name: "honey" }],
  ["2-3 tbsp olive oil", { quantity: 2.5, unit: "tbsp", name: "olive oil" }],
  ["250ml double cream", { quantity: 250, unit: "ml", name: "double cream" }],
  ["1.5kg new potatoes, halved", { quantity: 1.5, unit: "kg", name: "new potatoes", note: "halved" }],
  ["a pinch of salt", { quantity: 1, unit: "pinch", name: "salt" }],
  ["a handful of fresh coriander", { quantity: 1, unit: "handful", name: "fresh coriander" }],
  ["salt and pepper to taste", { quantity: null, unit: null, name: "salt and pepper", note: "to taste" }],
  ["black pepper", { quantity: null, unit: null, name: "black pepper" }],
  ["1 large red onion, finely chopped", { quantity: 1, unit: null, name: "red onion", note: "finely chopped", size: "large" }],
  ["2 medium carrots, peeled and sliced", { quantity: 2, unit: null, name: "carrots", note: "peeled and sliced", size: "medium" }],
  ["3 eggs, beaten", { quantity: 3, unit: null, name: "eggs", note: "beaten" }],
  ["1 heaped tsp ground cumin", { quantity: 1, unit: "tsp", name: "ground cumin" }],
  ["4 rashers smoked streaky bacon", { quantity: 4, unit: "rasher", name: "smoked streaky bacon" }],
  ["- 200g basmati rice", { quantity: 200, unit: "g", name: "basmati rice" }],
  ["2 tbsp of olive oil", { quantity: 2, unit: "tbsp", name: "olive oil" }],
  ["1 tsp. paprika", { quantity: 1, unit: "tsp", name: "paprika" }],
  ["500g lean beef mince (5% fat)", { quantity: 500, unit: "g", name: "lean beef mince", note: "5% fat" }],
  ["juice of 1 lemon", { quantity: null, unit: null, name: "juice of 1 lemon" }],
  ["fresh parsley, to serve", { quantity: null, unit: null, name: "fresh parsley", note: "to serve" }],
];

describe("parseIngredient", () => {
  it.each(cases)("%s", (line, expected) => {
    expect(parseIngredient(line)).toMatchObject(expected);
  });
});
