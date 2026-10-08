import { describe, expect, it } from "vitest";

import { buildNeeds, type PlanEntryInput, type RecipeInput } from "./build";

const curry: RecipeInput = {
  id: "curry",
  name: "Chicken curry",
  servings: 4,
  ingredients: [
    { foodId: "chicken", name: "chicken thighs", quantity: 800, unit: "g", grams: 800 },
    { foodId: "onion", name: "onion", quantity: 2, unit: null, grams: 220 },
    { foodId: null, name: "curry paste", quantity: 3, unit: "tbsp", grams: 0 },
  ],
};
const stew: RecipeInput = {
  id: "stew",
  name: "Stew",
  servings: 2,
  ingredients: [
    { foodId: "onion", name: "onions", quantity: 1, unit: null, grams: 110 },
    { foodId: "carrot", name: "carrots", quantity: 300, unit: "g", grams: 300 },
  ],
};
const recipes = new Map([curry, stew].map((r) => [r.id, r]));

const entry = (id: string, date: string, extra: Partial<PlanEntryInput>): PlanEntryInput => ({
  id,
  date,
  recipeId: null,
  foodId: null,
  foodName: null,
  servings: null,
  grams: null,
  leftoverOfId: null,
  confirmed: false,
  ...extra,
});

const get = (needs: ReturnType<typeof buildNeeds>, key: string) => needs.find((n) => n.key === key)!;

describe("buildNeeds", () => {
  it("scales a recipe by the servings planned", () => {
    const needs = buildNeeds([entry("a", "2026-10-12", { recipeId: "curry", servings: 2 })], recipes);
    expect(get(needs, "food:chicken").grams).toBe(400);
    expect(get(needs, "food:onion").grams).toBe(110);
  });

  it("counts a cook once, for its own servings plus its leftovers", () => {
    const needs = buildNeeds(
      [
        entry("cook", "2026-10-12", { recipeId: "curry", servings: 1 }),
        entry("left1", "2026-10-13", { recipeId: "curry", servings: 1.75, leftoverOfId: "cook" }),
      ],
      recipes,
    );
    // 2.75 of 4 servings
    expect(get(needs, "food:chicken").grams).toBe(550);
  });

  it("buys for an orphan leftover as if it were its own cook", () => {
    const needs = buildNeeds([entry("left", "2026-10-13", { recipeId: "curry", servings: 2, leftoverOfId: "gone" })], recipes);
    expect(get(needs, "food:chicken").grams).toBe(400);
  });

  it("leaves out meals already eaten, with their leftovers", () => {
    const needs = buildNeeds(
      [
        entry("cook", "2026-10-12", { recipeId: "curry", servings: 2, confirmed: true }),
        entry("left", "2026-10-13", { recipeId: "curry", servings: 2, leftoverOfId: "cook" }),
      ],
      recipes,
    );
    expect(needs).toEqual([]);
  });

  it("can skip days that have passed, including a cook from before", () => {
    const entries = [
      entry("cook", "2026-10-12", { recipeId: "curry", servings: 2 }),
      entry("left", "2026-10-14", { recipeId: "curry", servings: 2, leftoverOfId: "cook" }),
      entry("later", "2026-10-15", { recipeId: "stew", servings: 2 }),
    ];
    const needs = buildNeeds(entries, recipes, { from: "2026-10-14" });
    expect(needs.map((n) => n.key).sort()).toEqual(["food:carrot", "food:onion"]);
  });

  it("merges the same food across recipes and keeps where it came from", () => {
    const needs = buildNeeds(
      [entry("a", "2026-10-12", { recipeId: "curry", servings: 4 }), entry("b", "2026-10-14", { recipeId: "stew", servings: 2 })],
      recipes,
    );
    const onion = get(needs, "food:onion");
    expect(onion.grams).toBe(330);
    expect(onion.sources.map((s) => s.label)).toEqual(["Chicken curry", "Stew"]);
    expect(onion.sources[0].dates).toEqual(["2026-10-12"]);
  });

  it("counts items that were counted, and weighs the rest", () => {
    const needs = buildNeeds([entry("a", "2026-10-12", { recipeId: "curry", servings: 4 }), entry("b", "2026-10-14", { recipeId: "stew", servings: 2 })], recipes);
    expect(get(needs, "food:onion").count).toBe(3);
    expect(get(needs, "food:chicken").count).toBeNull();
    // Mixing a counted line with a weighed one drops the count
    const mixed = new Map(recipes).set("mix", { id: "mix", name: "Mix", servings: 1, ingredients: [{ foodId: "onion", name: "onion", quantity: 100, unit: "g", grams: 100 }] });
    const n = buildNeeds([entry("a", "2026-10-12", { recipeId: "curry", servings: 4 }), entry("b", "2026-10-13", { recipeId: "mix", servings: 1 })], mixed);
    expect(get(n, "food:onion").count).toBeNull();
  });

  it("rounds a fractional count up", () => {
    const needs = buildNeeds([entry("a", "2026-10-12", { recipeId: "curry", servings: 1 })], recipes);
    expect(get(needs, "food:onion").count).toBe(1); // 0.5 onion
  });

  it("keeps unmatched ingredients by name, with their written amount", () => {
    const needs = buildNeeds([entry("a", "2026-10-12", { recipeId: "curry", servings: 2 })], recipes);
    const paste = get(needs, "name:curry paste");
    expect(paste.foodId).toBeNull();
    expect(paste.written).toBe("1.5 tbsp");
  });

  it("adds single foods by weight", () => {
    const needs = buildNeeds(
      [entry("a", "2026-10-12", { foodId: "egg", foodName: "Eggs", grams: 110 }), entry("b", "2026-10-13", { foodId: "egg", foodName: "Eggs", grams: 55 })],
      recipes,
    );
    expect(get(needs, "food:egg")).toMatchObject({ name: "Eggs", grams: 165 });
  });

  it("ignores plan entries whose recipe is gone", () => {
    expect(buildNeeds([entry("a", "2026-10-12", { recipeId: "deleted", servings: 2 })], recipes)).toEqual([]);
  });
});
