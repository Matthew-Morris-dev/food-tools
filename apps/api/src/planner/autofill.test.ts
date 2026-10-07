import { describe, expect, it } from "vitest";

import { addDays } from "../dates";
import { autoFill, type AutoFillInput, type Candidate, type Slot } from "./autofill";

const week = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const recipe = (id: string, kcal: number, protein: number, slots: Slot[], extra: Partial<Candidate> = {}): Candidate => ({
  id,
  name: id,
  slots,
  preference: "neutral",
  perServing: { kcal, protein, carbs: kcal / 8, fat: kcal / 30 },
  servings: 4,
  ingredientNames: ["rice", "tomato"],
  incomplete: false,
  ...extra,
});

const RECIPES: Candidate[] = [
  recipe("oats", 450, 20, ["breakfast"]),
  recipe("eggs", 400, 28, ["breakfast"]),
  recipe("yoghurt", 300, 22, ["breakfast", "snack"]),
  recipe("soup", 600, 30, ["lunch"]),
  recipe("wrap", 700, 38, ["lunch"]),
  recipe("curry", 800, 45, ["lunch", "dinner"]),
  recipe("pasta", 900, 40, ["dinner"]),
  recipe("stirfry", 750, 42, ["dinner"]),
  recipe("fish", 700, 50, ["dinner"]),
  recipe("chilli", 850, 48, ["dinner", "lunch"]),
];

function input(overrides: Partial<AutoFillInput> = {}): AutoFillInput {
  const dates = week("2026-10-05");
  return {
    weekStart: "2026-10-05",
    dates,
    targets: new Map(dates.map((d) => [d, 2400])),
    slots: ["breakfast", "lunch", "dinner"],
    candidates: RECIPES,
    existing: [],
    diets: [],
    excludedWords: [],
    leftovers: false,
    ...overrides,
  };
}

const kcalByDay = (r: ReturnType<typeof autoFill>, cands = RECIPES) => {
  const out = new Map<string, number>();
  for (const e of r.entries) out.set(e.date, (out.get(e.date) ?? 0) + e.servings * cands.find((c) => c.id === e.recipeId)!.perServing.kcal);
  return out;
};

describe("autoFill", () => {
  it("fills every chosen slot of every day", () => {
    const r = autoFill(input());
    expect(r.entries).toHaveLength(21);
    expect(r.skipped).toEqual([]);
  });

  it("puts recipes only in meals they suit", () => {
    const r = autoFill(input({ slots: ["breakfast", "lunch", "dinner", "snack"] }));
    for (const e of r.entries) expect(RECIPES.find((c) => c.id === e.recipeId)!.slots).toContain(e.slot);
  });

  it("leaves days near their calorie target", () => {
    const r = autoFill(input());
    for (const kcal of kcalByDay(r).values()) expect(Math.abs(kcal - 2400) / 2400).toBeLessThan(0.1);
  });

  it("only fills empty slots and counts what's already there", () => {
    const r = autoFill(input({ existing: [{ date: "2026-10-06", slot: "dinner", kcal: 1000, recipeId: "pasta", leftover: false }] }));
    expect(r.entries.find((e) => e.date === "2026-10-06" && e.slot === "dinner")).toBeUndefined();
    expect(r.entries.filter((e) => e.date === "2026-10-06")).toHaveLength(2);
  });

  it("only fills the slots asked for", () => {
    const r = autoFill(input({ slots: ["dinner"] }));
    expect(r.entries.every((e) => e.slot === "dinner")).toBe(true);
    expect(r.entries).toHaveLength(7);
  });

  it("skips days with no target", () => {
    const targets = new Map(input().targets);
    targets.delete("2026-10-07");
    expect(autoFill(input({ targets })).entries.some((e) => e.date === "2026-10-07")).toBe(false);
  });

  it("never uses disliked, incomplete or rule-breaking recipes, and says how many it skipped", () => {
    const cands = [
      ...RECIPES.filter((c) => c.id !== "pasta"),
      recipe("pasta", 900, 40, ["dinner"], { preference: "dislike" }),
      recipe("bad", 800, 40, ["dinner"], { incomplete: true }),
      recipe("meaty", 800, 40, ["dinner"], { ingredientNames: ["chicken thighs"] }),
    ];
    const r = autoFill(input({ candidates: cands, diets: ["vegetarian"] }));
    const used = new Set(r.entries.map((e) => e.recipeId));
    expect(used.has("pasta") || used.has("bad") || used.has("meaty")).toBe(false);
    expect(r.excluded).toEqual({ disliked: 1, incomplete: 1, diet: 1 });
  });

  it("varies dinners rather than repeating one", () => {
    const dinners = autoFill(input()).entries.filter((e) => e.slot === "dinner").map((e) => e.recipeId);
    const counts = new Map<string, number>();
    for (const d of dinners) counts.set(d, (counts.get(d) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    expect(counts.size).toBeGreaterThanOrEqual(3);
  });

  it("is repeatable for the same week and varies between weeks", () => {
    const a = JSON.stringify(autoFill(input()).entries);
    expect(JSON.stringify(autoFill(input()).entries)).toBe(a);
    const dates2 = week("2026-10-12");
    const other = autoFill(input({ weekStart: "2026-10-12", dates: dates2, targets: new Map(dates2.map((d) => [d, 2400])) }));
    const shape = (r: typeof other) => r.entries.map((e) => e.recipeId).join();
    expect(shape(other)).not.toBe(autoFill(input()).entries.map((e) => e.recipeId).join());
  });

  it("explains slots it can't fill", () => {
    const r = autoFill(input({ candidates: RECIPES.filter((c) => !c.slots.includes("breakfast")) }));
    expect(r.skipped.filter((s) => s.slot === "breakfast")).toHaveLength(7);
    expect(r.skipped[0].reason).toMatch(/suiting this meal/);
  });

  it("explains slots where nothing fits the calories", () => {
    const r = autoFill(input({ candidates: [recipe("tiny", 40, 2, ["dinner"])], slots: ["dinner"] }));
    expect(r.entries).toEqual([]);
    expect(r.skipped[0].reason).toMatch(/calories/);
  });

  describe("leftovers", () => {
    const r = autoFill(input({ leftovers: true }));
    const byTemp = new Map(r.entries.map((e) => [e.tempId, e]));
    const leftovers = r.entries.filter((e) => e.leftoverOfTempId);

    it("makes some dinners cover the next day's lunch", () => {
      expect(leftovers.length).toBeGreaterThan(0);
      for (const l of leftovers) {
        const cook = byTemp.get(l.leftoverOfTempId!)!;
        expect(cook.slot).toBe("dinner");
        expect(l.slot).toBe("lunch");
        expect(l.recipeId).toBe(cook.recipeId);
        expect(l.date > cook.date).toBe(true);
      }
    });

    it("never eats more from a cook than the recipe makes", () => {
      for (const cook of r.entries.filter((e) => !e.leftoverOfTempId)) {
        const eaten = cook.servings + leftovers.filter((l) => l.leftoverOfTempId === cook.tempId).reduce((s, l) => s + l.servings, 0);
        expect(eaten).toBeLessThanOrEqual(4);
      }
    });

    it("doesn't plan leftovers of a recipe that doesn't suit lunch", () => {
      for (const l of leftovers) expect(RECIPES.find((c) => c.id === l.recipeId)!.slots).toContain("lunch");
    });
  });
});
