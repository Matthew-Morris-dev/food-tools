import { describe, expect, it } from "vitest";

import { extractRecipe, parseServings } from "./extract";
import { parseRecipeText } from "./text";

const page = (json: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;

describe("extractRecipe", () => {
  it("reads a plain Recipe", () => {
    const r = extractRecipe(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Easy chicken curry",
        recipeYield: "4",
        recipeIngredient: ["2 tbsp sunflower oil", "1 onion thinly sliced"],
        recipeInstructions: [{ "@type": "HowToStep", text: "Heat the oil." }, { "@type": "HowToStep", text: "Add the onion &amp; cook." }],
        recipeCategory: ["Dinner", "Main course"],
        nutrition: { calories: "354 calories", proteinContent: "24 grams protein", carbohydrateContent: "10 grams carbohydrates", fatContent: "23 grams fat" },
      }),
    );
    expect(r).toMatchObject({
      name: "Easy chicken curry",
      servings: 4,
      ingredients: ["2 tbsp sunflower oil", "1 onion thinly sliced"],
      method: "1. Heat the oil.\n2. Add the onion & cook.",
      tags: ["dinner", "main course"],
      siteNutrition: { kcal: 354, protein: 24, carbs: 10, fat: 23 },
    });
  });

  it("finds a Recipe inside @graph and HowToSections", () => {
    const r = extractRecipe(
      page({
        "@graph": [
          { "@type": "WebSite" },
          {
            "@type": ["Recipe", "Thing"],
            name: "Soup",
            recipeYield: ["6", "6 servings"],
            recipeIngredient: ["1 leek"],
            recipeInstructions: [{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Chop." }, { "@type": "HowToStep", text: "Simmer." }] }],
          },
        ],
      }),
    );
    expect(r?.servings).toBe(6);
    expect(r?.method).toBe("1. Chop.\n2. Simmer.");
  });

  it("accepts instructions as one string and no nutrition", () => {
    const r = extractRecipe(page({ "@type": "Recipe", name: "Toast", recipeIngredient: ["bread"], recipeInstructions: "Toast it.\nButter it." }));
    expect(r?.method).toBe("1. Toast it.\n2. Butter it.");
    expect(r?.siteNutrition).toBeNull();
  });

  it("skips bad JSON and pages without a recipe", () => {
    expect(extractRecipe('<script type="application/ld+json">{oops</script>')).toBeNull();
    expect(extractRecipe(page({ "@type": "Article" }))).toBeNull();
    expect(extractRecipe(page({ "@type": "Recipe", name: "No ingredients" }))).toBeNull();
    expect(extractRecipe("<html></html>")).toBeNull();
  });
});

describe("parseServings", () => {
  it.each([["4", 4], [4, 4], ["Serves 4-6", 4], ["Makes 12 cookies", 12], [["6", "6 servings"], 6], [undefined, null], ["a few", null]])(
    "%j",
    (input, expected) => {
      expect(parseServings(input)).toBe(expected);
    },
  );
});

describe("parseRecipeText", () => {
  it("splits headed sections", () => {
    const r = parseRecipeText("Quick dal\nServes 4\n\nIngredients\n- 200g red lentils\n1 onion, chopped\n\nMethod\n1. Rinse the lentils.\n2. Simmer for 20 minutes.");
    expect(r).toMatchObject({ name: "Quick dal", servings: 4, ingredients: ["- 200g red lentils", "1 onion, chopped"] });
    expect(r.method).toBe("1. Rinse the lentils.\n2. Simmer for 20 minutes.");
  });

  it("works without headings", () => {
    const r = parseRecipeText("Pancakes\n100g plain flour\n2 eggs\n300ml milk\nWhisk everything together until smooth.\nFry in a hot pan.");
    expect(r.name).toBe("Pancakes");
    expect(r.ingredients).toEqual(["100g plain flour", "2 eggs", "300ml milk"]);
    expect(r.method).toBe("1. Whisk everything together until smooth.\n2. Fry in a hot pan.");
  });

  it("handles ingredients with no method", () => {
    const r = parseRecipeText("Ingredients:\n2 eggs\n1 tbsp butter");
    expect(r.ingredients).toEqual(["2 eggs", "1 tbsp butter"]);
    expect(r.method).toBe("");
  });
});
