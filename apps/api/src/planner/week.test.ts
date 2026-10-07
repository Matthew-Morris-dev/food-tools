import { describe, expect, it } from "vitest";

import { entryMacros, sumMacros } from "./nutrition";
import { weekDates, weekStart } from "../dates";

describe("weeks", () => {
  it("starts on Monday", () => {
    expect(weekStart("2026-10-07")).toBe("2026-10-05"); // Wednesday
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekDates("2026-10-12")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });

  it("handles month and year boundaries", () => {
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });
});

describe("entryMacros", () => {
  const per = { kcal: 400, protein: 30, carbs: 40, fat: 10 };
  it("scales a recipe by servings and a food by grams", () => {
    expect(entryMacros({ servings: 1.5, grams: null, recipe: { perServing: per }, food: null }).kcal).toBe(600);
    expect(entryMacros({ servings: null, grams: 50, recipe: null, food: { kcal: 200, protein: 10, carbs: 20, fat: 5 } }).kcal).toBe(100);
    expect(entryMacros({ servings: null, grams: null, recipe: null, food: null }).kcal).toBe(0);
  });
  it("sums", () => {
    expect(sumMacros([per, per]).protein).toBe(60);
  });
});
