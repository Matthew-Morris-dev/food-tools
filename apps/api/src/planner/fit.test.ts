import { describe, expect, it } from "vitest";

import { fitDay, type FitItem } from "./fit";

const meal = (id: string, kcal: number, servings = 1, flexible = true): FitItem => ({ id, kcal, servings, flexible });

describe("fitDay", () => {
  it("scales flexible meals together to reach the target", () => {
    const r = fitDay([meal("a", 500, 2), meal("b", 700, 2), meal("c", 600, 2)], 2000);
    // 1,800 kcal now, so about 1.11x, rounded to quarter servings
    expect(r.changes.map((c) => c.servings)).toEqual([2.25, 2.25, 2.25]);
    expect(Math.abs(r.resultKcal - 2000)).toBeLessThan(120);
    expect(r.clamped).toBe(false);
  });

  it("lands within about 1% when portions are big enough to step finely", () => {
    const r = fitDay([meal("a", 2000, 8), meal("b", 3000, 12)], 4000);
    expect(Math.abs(r.resultKcal - 4000)).toBeLessThan(40);
  });

  it("leaves locked entries, foods, eaten meals and leftovers alone", () => {
    const r = fitDay([meal("locked", 400, 1, false), meal("flex", 600, 1)], 1400);
    // Wants 1.67x the 600 kcal meal, which rounds to 1.75 servings: 400 + 1,050
    expect(r.changes).toEqual([{ id: "flex", servings: 1.75 }]);
    expect(r.resultKcal).toBe(1450);
  });

  it("stops at 0.5x and 2x and says it was clamped", () => {
    const low = fitDay([meal("a", 1000, 2)], 3000);
    expect(low.changes).toEqual([{ id: "a", servings: 4 }]);
    expect(low.clamped).toBe(true);
    const high = fitDay([meal("a", 1000, 2)], 200);
    expect(high.changes).toEqual([{ id: "a", servings: 1 }]);
    expect(high.clamped).toBe(true);
  });

  it("never goes below a quarter serving", () => {
    expect(fitDay([meal("a", 100, 0.25)], 10).changes).toEqual([]);
  });

  it("does nothing when nothing can move", () => {
    const r = fitDay([meal("a", 500, 1, false)], 2000);
    expect(r.changes).toEqual([]);
    expect(r.resultKcal).toBe(500);
    expect(r.clamped).toBe(true);
  });

  it("only reports entries that changed", () => {
    expect(fitDay([meal("a", 1000, 1)], 1000).changes).toEqual([]);
  });
});
