import { describe, expect, it } from "vitest";

import { templateToWeek, weekToTemplate, type WeekEntry } from "./templates";

const entry = (id: string, date: string, slot: WeekEntry["slot"], extra: Partial<WeekEntry> = {}): WeekEntry => ({
  id,
  date,
  slot,
  recipeId: "r1",
  foodId: null,
  servings: 1,
  grams: null,
  leftoverOfId: null,
  locked: false,
  ...extra,
});

const WEEK = "2026-10-05";

describe("weekToTemplate", () => {
  it("records day offsets from Monday", () => {
    const t = weekToTemplate(WEEK, [entry("a", "2026-10-05", "dinner"), entry("b", "2026-10-11", "lunch")]);
    expect(t.map((x) => x.dayOffset)).toEqual([0, 6]);
  });

  it("keeps leftover links as positions, cooks first", () => {
    const t = weekToTemplate(WEEK, [
      entry("left", "2026-10-06", "lunch", { leftoverOfId: "cook" }),
      entry("cook", "2026-10-05", "dinner"),
    ]);
    expect(t[0].leftoverOfIndex).toBeNull();
    expect(t[1].leftoverOfIndex).toBe(0);
    expect(t[1].dayOffset).toBe(1);
  });

  it("turns leftovers into plain meals when their cook isn't in the week", () => {
    const t = weekToTemplate(WEEK, [entry("left", "2026-10-06", "lunch", { leftoverOfId: "elsewhere" })]);
    expect(t[0].leftoverOfIndex).toBeNull();
  });

  it("keeps foods, grams and locks", () => {
    const t = weekToTemplate(WEEK, [entry("a", WEEK, "snack", { recipeId: null, foodId: "f", servings: null, grams: 110, locked: true })]);
    expect(t[0]).toMatchObject({ foodId: "f", grams: 110, locked: true, recipeId: null });
  });
});

describe("templateToWeek", () => {
  const template = weekToTemplate(WEEK, [
    entry("cook", "2026-10-05", "dinner"),
    entry("left", "2026-10-06", "lunch", { leftoverOfId: "cook" }),
    entry("other", "2026-10-07", "breakfast"),
  ]);

  it("lays the template onto another week", () => {
    const { entries, skipped } = templateToWeek("2026-11-02", template, new Set());
    expect(entries.map((e) => `${e.date}|${e.slot}`).sort()).toEqual(["2026-11-02|dinner", "2026-11-03|lunch", "2026-11-04|breakfast"]);
        expect(skipped).toEqual([]);
  });

  it("skips occupied slots, and leftovers of a skipped cook", () => {
    const { entries, skipped } = templateToWeek("2026-11-02", template, new Set(["2026-11-02|dinner"]));
    expect(entries.map((e) => e.slot)).toEqual(["breakfast"]);
    expect(skipped.map((e) => e.slot).sort()).toEqual(["dinner", "lunch"]);
  });

  it("reports each entry's template position, which leftover links use", () => {
    const { entries } = templateToWeek("2026-11-02", template, new Set());
    const leftover = entries.find((e) => e.leftoverOfIndex !== null)!;
    expect(entries.find((e) => e.index === leftover.leftoverOfIndex)?.slot).toBe("dinner");
  });

  it("round trips a week", () => {
    const { entries } = templateToWeek(WEEK, template, new Set());
    expect(entries.map((e) => `${e.date}|${e.slot}`).sort()).toEqual(["2026-10-05|dinner", "2026-10-06|lunch", "2026-10-07|breakfast"]);
  });
});
