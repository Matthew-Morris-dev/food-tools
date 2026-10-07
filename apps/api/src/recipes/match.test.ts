import { describe, expect, it } from "vitest";

import { queryTokens, rankFoods, type Candidate } from "./match";

const cofid = (name: string): Candidate => ({ id: name, name, source: "cofid", owned: false });
const best = (query: string, names: string[]) => rankFoods(queryTokens(query), names.map(cofid))[0].name;

describe("queryTokens", () => {
  it("drops filler words and singularises", () => {
    expect(queryTokens("fresh large courgettes")).toEqual(["courgette"]);
    expect(queryTokens("Medium Red Onions")).toEqual(["red", "onion"]);
    expect(queryTokens("extra virgin olive oil")).toEqual(["olive", "oil"]);
  });

  it("rewrites UK recipe wording to CoFID names", () => {
    expect(queryTokens("chicken breast")).toEqual(["chicken", "light", "meat", "raw"]);
    expect(queryTokens("2 chicken thighs")).toContain("dark");
    expect(queryTokens("chopped tomatoes")).toEqual(["tomato", "canned"]);
    expect(queryTokens("caster sugar")).toEqual(["sugar", "white"]);
  });

  it("picks everyday defaults", () => {
    expect(queryTokens("2 eggs")).toContain("chicken");
    expect(queryTokens("egg yolks")).toContain("yolk");
    expect(queryTokens("milk")).toEqual(["milk", "semi-skimmed"]);
    expect(queryTokens("whole milk")).toEqual(["milk", "whole"]);
    expect(queryTokens("butter")).toEqual(["butter", "salted"]);
    expect(queryTokens("basmati rice")).toEqual(["rice", "white", "basmati", "raw"]);
    expect(queryTokens("new potatoes")).toEqual(["potato", "new"]);
    expect(queryTokens("sweet potatoes")).toEqual(["sweet", "potato", "raw"]);
    expect(queryTokens("2 tomatoes")).toContain("standard");
    expect(queryTokens("cherry tomatoes")).toEqual(["cherry", "tomato"]);
    expect(queryTokens("potatoes")).toEqual(["potato", "old", "raw"]);
    expect(queryTokens("streaky bacon")).toContain("streaky");
  });
});

describe("rankFoods", () => {
  it("prefers the plain raw food", () => {
    expect(best("onion", ["Onions, fried in lard", "Onions, baked", "Onions, raw", "Bread, onion", "Onions, dried, raw"])).toBe("Onions, raw");
    expect(best("garlic", ["Garlic powder", "Garlic mushrooms, not coated, homemade", "Garlic, raw"])).toBe("Garlic, raw");
  });

  it("puts the food ahead of dishes that mention it", () => {
    expect(best("sunflower oil", ["Onions, fried in sunflower oil", "Tuna, canned in sunflower oil, drained", "Oil, sunflower"])).toBe("Oil, sunflower");
  });

  it("doesn't confuse a food with a different one that starts the same", () => {
    expect(best("lemon", ["Lemon sole, flesh only, raw", "Lemons, whole, without pips"])).toBe("Lemons, whole, without pips");
    expect(best("double cream", ["Cream substitute, double", "Cream, fresh, double"])).toBe("Cream, fresh, double");
  });

  it("prefers plain over flavoured", () => {
    expect(best("greek yogurt", ["Yogurt, Greek style, fruit", "Yogurt, Greek style, plain"])).toBe("Yogurt, Greek style, plain");
  });

  it("matches garlic cloves to garlic", () => {
    expect(queryTokens("garlic cloves")).toEqual(["garlic", "raw"]);
    expect(best("garlic cloves", ["Garlic powder", "Garlic, raw"])).toBe("Garlic, raw");
  });

  it("avoids weights that include bone", () => {
    expect(
      best("chicken thigh", ["Chicken, dark meat, raw, weighed with bone", "Chicken, dark meat, raw"]),
    ).toBe("Chicken, dark meat, raw");
  });

  it("prefers the user's own foods", () => {
    const mine: Candidate = { id: "x", name: "Homemade curry paste", source: "custom", owned: true };
    const other: Candidate = { id: "y", name: "Curry paste", source: "cofid", owned: false };
    expect(rankFoods(queryTokens("curry paste"), [other, mine])[0]).toBe(mine);
  });

  it("ranks Open Food Facts products below generic foods", () => {
    const off: Candidate = { id: "o", name: "Plain flour", source: "off", owned: false };
    expect(rankFoods(queryTokens("flour"), [off, cofid("Flour, plain, white")])[0].name).toBe("Flour, plain, white");
  });
});
