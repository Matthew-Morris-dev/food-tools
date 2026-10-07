import { daysBetween, addDays } from "../dates";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

export type WeekEntry = {
  id: string;
  date: string;
  slot: Slot;
  recipeId: string | null;
  foodId: string | null;
  servings: number | null;
  grams: number | null;
  leftoverOfId: string | null;
  locked: boolean;
};

// A planned meal on a day of the week (0 = Monday), with its cook referred to by position
export type TemplateEntry = {
  dayOffset: number;
  slot: Slot;
  recipeId: string | null;
  foodId: string | null;
  servings: number | null;
  grams: number | null;
  locked: boolean;
  leftoverOfIndex: number | null;
};

// Cooks come before the leftovers that depend on them, so links always point backwards
function inDependencyOrder<T extends { leftover: boolean; day: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(a.leftover) - Number(b.leftover) || a.day - b.day);
}

export function weekToTemplate(weekStart: string, entries: WeekEntry[]): TemplateEntry[] {
  const ordered = inDependencyOrder(
    entries.map((e) => ({ e, leftover: e.leftoverOfId !== null, day: daysBetween(weekStart, e.date) })),
  );
  const indexById = new Map(ordered.map((o, i) => [o.e.id, i]));
  return ordered.map(({ e, day }) => ({
    dayOffset: day,
    slot: e.slot,
    recipeId: e.recipeId,
    foodId: e.foodId,
    servings: e.servings,
    grams: e.grams,
    locked: e.locked,
    // A cook that isn't part of the week leaves the meal as a plain one
    leftoverOfIndex: e.leftoverOfId ? (indexById.get(e.leftoverOfId) ?? null) : null,
  }));
}

// `index` is the entry's position in the template, which leftover links refer to
export type NewPlanned = TemplateEntry & { date: string; index: number };

// Entries to create when applying a template to a week. Slots in `occupied` ("date|slot")
// are skipped, and so are leftovers whose cook was skipped.
export function templateToWeek(weekStart: string, template: TemplateEntry[], occupied: Set<string>) {
  const keep = new Map<number, boolean>();
  const entries: NewPlanned[] = [];
  const skipped: NewPlanned[] = [];
  template.forEach((t, i) => {
    const date = addDays(weekStart, t.dayOffset);
    const blocked = occupied.has(`${date}|${t.slot}`) || (t.leftoverOfIndex !== null && keep.get(t.leftoverOfIndex) !== true);
    keep.set(i, !blocked);
    (blocked ? skipped : entries).push({ ...t, date, index: i });
  });
  return { entries, skipped };
}
