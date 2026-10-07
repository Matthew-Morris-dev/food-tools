import { describe, expect, it } from "vitest";

import { dietViolations } from "./diet";

const check = (diet: string, ...ingredients: string[]) => dietViolations(ingredients, [diet], []);

describe("dietViolations", () => {
  it("flags meat and fish for vegetarians but not for pescatarians", () => {
    expect(check("vegetarian", "chicken thighs", "onion")).toEqual(["chicken"]);
    expect(check("vegetarian", "smoked salmon")).toEqual(["salmon"]);
    expect(check("pescatarian", "smoked salmon", "olive oil")).toEqual([]);
    expect(check("pescatarian", "streaky bacon")).toEqual(["bacon"]);
    expect(check("vegetarian", "red lentils", "tomatoes", "cheddar cheese")).toEqual([]);
  });

  it("flags animal products for vegans", () => {
    expect(check("vegan", "greek yogurt", "honey", "2 eggs", "plain flour").sort()).toEqual(["eggs", "honey", "yogurt"]);
    expect(check("vegan", "coconut milk", "tofu", "peanut butter")).toEqual([]);
  });

  it("handles dairy-free look-alikes", () => {
    expect(check("dairy-free", "butter", "double cream")).toEqual(["butter", "cream"]);
    expect(check("dairy-free", "coconut milk", "almond milk", "peanut butter", "butternut squash", "cocoa butter")).toEqual([]);
    expect(check("dairy-free", "buttermilk")).toContain("buttermilk");
  });

  it("flags gluten but not gluten-free flours", () => {
    expect(check("gluten-free", "plain flour", "wholemeal bread").sort()).toEqual(["bread", "flour"]);
    expect(check("gluten-free", "cornflour", "rice flour", "rice noodles", "gluten-free pasta")).toEqual([]);
  });

  it("flags nuts but not nutmeg, butternut or coconut", () => {
    expect(check("nut-free", "ground almonds", "peanut butter", "pine nuts").sort()).toEqual(["almonds", "peanut", "pine nuts"]);
    expect(check("nut-free", "nutmeg", "butternut squash", "coconut oil", "water chestnuts")).toEqual([]);
  });

  it("applies your own excluded words, with plurals", () => {
    expect(dietViolations(["fresh coriander", "mushrooms"], [], ["mushroom", "olives"])).toEqual(["mushroom"]);
    expect(dietViolations(["onion"], [], ["", "  "])).toEqual([]);
  });

  it("ignores unknown diets", () => {
    expect(dietViolations(["chicken"], ["unknown"], [])).toEqual([]);
  });
});
