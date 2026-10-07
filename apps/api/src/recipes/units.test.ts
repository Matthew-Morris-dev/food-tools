import { describe, expect, it } from "vitest";

import { parseIngredient } from "./parse-ingredient";
import { toGrams } from "./units";

const grams = (line: string, food?: Parameters<typeof toGrams>[1]) => toGrams(parseIngredient(line), food);

describe("toGrams", () => {
  it("converts weights exactly", () => {
    expect(grams("200g rice")).toEqual({ grams: 200, estimated: false });
    expect(grams("1.5kg potatoes")).toEqual({ grams: 1500, estimated: false });
    expect(grams("8 oz flour")).toEqual({ grams: 226.8, estimated: false });
    expect(grams("2 lb beef")).toEqual({ grams: 907.2, estimated: false });
  });

  it("estimates volumes with a density", () => {
    expect(grams("2 tbsp sunflower oil")).toEqual({ grams: 27.6, estimated: true });
    expect(grams("250ml double cream")).toEqual({ grams: 257.5, estimated: true });
    expect(grams("1 cup plain flour")).toEqual({ grams: 127.2, estimated: true });
    expect(grams("1 tsp salt")).toEqual({ grams: 6, estimated: true });
    expect(grams("500ml water").grams).toBe(515);
  });

  it("estimates counted ingredients, scaled by size", () => {
    expect(grams("2 eggs")).toEqual({ grams: 110, estimated: true });
    expect(grams("1 onion").grams).toBe(110);
    expect(grams("1 large onion").grams).toBe(154);
    expect(grams("2 small carrots").grams).toBe(112);
    expect(grams("1 sweet potato").grams).toBe(250);
    expect(grams("2 egg yolks").grams).toBe(36);
  });

  it("estimates named units", () => {
    expect(grams("2 garlic cloves").grams).toBe(8);
    expect(grams("3 cloves garlic").grams).toBe(12);
    expect(grams("a pinch of salt").grams).toBe(0.4);
    expect(grams("1 slice bread").grams).toBe(36);
    expect(grams("thumb-sized piece of ginger").grams).toBe(25);
    expect(grams("1 bunch coriander").grams).toBe(30);
  });

  it("uses a product's serving size for counted packaged foods", () => {
    expect(grams("2 yoghurts", { servings: [{ label: "1 pot", grams: 125 }] })).toEqual({ grams: 250, estimated: true });
  });

  it("gives up honestly", () => {
    expect(grams("salt and pepper")).toEqual({ grams: null, estimated: false });
    expect(grams("2 mysteries")).toEqual({ grams: null, estimated: false });
  });
});
