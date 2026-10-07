// Fills a week's empty meal slots from the user's recipes, aiming each day at its target.
// Rule-based: greedy by day and slot, with a score that favours calories close to the
// slot's share, protein, liked recipes and variety. The same input always gives the same
// week; a hash of the week and slot varies the choices from week to week.

import { addDays } from "../dates";
import type { Macros } from "../recipes/nutrition";
import { dietViolations } from "./diet";
import { fitDay } from "./fit";

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";

export type Candidate = {
  id: string;
  name: string;
  slots: Slot[];
  preference: "like" | "neutral" | "dislike";
  perServing: Macros;
  // How many servings the recipe makes in one cook
  servings: number;
  ingredientNames: string[];
  incomplete: boolean;
};

export type Existing = { date: string; slot: Slot; kcal: number; recipeId: string | null; leftover: boolean };

export type ProposedEntry = {
  tempId: string;
  date: string;
  slot: Slot;
  recipeId: string;
  servings: number;
  leftoverOfTempId: string | null;
};

export type AutoFillInput = {
  weekStart: string;
  dates: string[];
  // Calorie target per date; days without one are left alone
  targets: Map<string, number>;
  slots: Slot[];
  candidates: Candidate[];
  existing: Existing[];
  diets: string[];
  excludedWords: string[];
  leftovers: boolean;
};

export type AutoFillResult = {
  entries: ProposedEntry[];
  skipped: { date: string; slot: Slot; reason: string }[];
  excluded: { incomplete: number; disliked: number; diet: number };
};

const SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.3, dinner: 0.35, snack: 0.1 };
// Biggest meals first, so the small ones adapt to what's left
const ORDER: Slot[] = ["dinner", "lunch", "breakfast", "snack"];
const MAX_ERROR = 0.35;
const MIN_SERVINGS = 0.5;
const MAX_SERVINGS = 2;
const STEP = 0.25;

const roundStep = (n: number) => Math.round(n / STEP) * STEP;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A small stable number in [0, 1) from text, to vary choices without randomness
function hash01(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function autoFill(input: AutoFillInput): AutoFillResult {
  const excluded = { incomplete: 0, disliked: 0, diet: 0 };
  const candidates = [...input.candidates]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((c) => {
      if (c.preference === "dislike") return void excluded.disliked++;
      if (c.incomplete || c.perServing.kcal <= 0) return void excluded.incomplete++;
      if (dietViolations(c.ingredientNames, input.diets, input.excludedWords).length > 0) return void excluded.diet++;
      return true;
    }) as Candidate[];

  const placed: (ProposedEntry & { kcal: number; flexible: boolean })[] = [];
  const skipped: AutoFillResult["skipped"] = [];
  const cookUsed = new Map<string, number>(); // tempId -> servings eaten from that cook
  const byId = new Map(candidates.map((c) => [c.id, c]));
  let counter = 0;

  const occupied = (date: string, slot: Slot) =>
    input.existing.some((e) => e.date === date && e.slot === slot) || placed.some((p) => p.date === date && p.slot === slot);
  const dayKcal = (date: string) =>
    input.existing.filter((e) => e.date === date).reduce((s, e) => s + e.kcal, 0) +
    placed.filter((p) => p.date === date).reduce((s, p) => s + p.kcal, 0);
  const timesUsed = (id: string) =>
    input.existing.filter((e) => e.recipeId === id && !e.leftover).length + placed.filter((p) => p.recipeId === id && !p.leftoverOfTempId).length;
  const usedOn = (id: string, date: string) =>
    input.existing.some((e) => e.recipeId === id && e.date === date) || placed.some((p) => p.recipeId === id && p.date === date);

  // The calories a slot should get: what's left of the day, split by share among the
  // chosen slots still empty
  function slotTarget(date: string, slot: Slot) {
    const target = input.targets.get(date)!;
    const empty = input.slots.filter((s) => !occupied(date, s));
    const total = empty.reduce((s, x) => s + SHARE[x], 0) || 1;
    return Math.max(0, target - dayKcal(date)) * (SHARE[slot] / total);
  }

  function canCoverLunch(c: Candidate, servings: number, date: string, slot: Slot) {
    const next = addDays(date, 1);
    return (
      input.leftovers &&
      slot === "dinner" &&
      input.slots.includes("lunch") &&
      input.dates.includes(next) &&
      input.targets.has(next) &&
      !occupied(next, "lunch") &&
      c.slots.includes("lunch") &&
      c.servings - servings >= MIN_SERVINGS
    );
  }

  function bestServings(c: Candidate, wanted: number) {
    const servings = clamp(roundStep(wanted / c.perServing.kcal), MIN_SERVINGS, MAX_SERVINGS);
    return { servings, error: Math.abs(servings * c.perServing.kcal - wanted) / wanted };
  }

  for (const date of input.dates) {
    if (!input.targets.has(date)) continue;

    for (const slot of ORDER) {
      if (!input.slots.includes(slot) || occupied(date, slot)) continue;
      const wanted = slotTarget(date, slot);
      const suitable = candidates.filter((c) => c.slots.includes(slot));
      if (suitable.length === 0) {
        skipped.push({ date, slot, reason: "No usable recipes are marked as suiting this meal" });
        continue;
      }
      if (wanted < 50) {
        skipped.push({ date, slot, reason: "The day's calories are already used up" });
        continue;
      }

      let best: { c: Candidate; servings: number; score: number } | null = null;
      for (const c of suitable) {
        const { servings, error } = bestServings(c, wanted);
        if (error > MAX_ERROR) continue;
        const proteinDensity = c.perServing.protein / c.perServing.kcal;
        const score =
          -50 * error +
          10 * Math.min(1, proteinDensity / 0.08) +
          (c.preference === "like" ? 10 : 0) -
          15 * timesUsed(c.id) -
          (usedOn(c.id, addDays(date, -1)) ? 10 : 0) -
          (usedOn(c.id, date) ? 15 : 0) +
          // With leftovers on, favour a dinner that can also make tomorrow's lunch
          (canCoverLunch(c, servings, date, slot) ? 12 : 0) +
          4 * hash01(`${input.weekStart}|${date}|${slot}|${c.id}`);
        if (!best || score > best.score) best = { c, servings, score };
      }
      if (!best) {
        skipped.push({ date, slot, reason: "No recipe comes close to this meal's calories" });
        continue;
      }

      const tempId = `new-${counter++}`;
      placed.push({
        tempId,
        date,
        slot,
        recipeId: best.c.id,
        servings: best.servings,
        leftoverOfTempId: null,
        kcal: best.servings * best.c.perServing.kcal,
        flexible: true,
      });
      cookUsed.set(tempId, best.servings);

      // Dinner for the next day's lunch too
      const next = addDays(date, 1);
      if (input.leftovers && slot === "dinner" && input.slots.includes("lunch") && input.dates.includes(next) && input.targets.has(next) && !occupied(next, "lunch") && best.c.slots.includes("lunch")) {
        const spare = best.c.servings - best.servings;
        const lunchWanted = (input.targets.get(next)! * SHARE.lunch) / input.slots.reduce((s, x) => s + SHARE[x], 0);
        const servings = Math.min(clamp(roundStep(lunchWanted / best.c.perServing.kcal), MIN_SERVINGS, MAX_SERVINGS), Math.floor(spare / STEP) * STEP);
        if (servings >= MIN_SERVINGS) {
          placed.push({
            tempId: `new-${counter++}`,
            date: next,
            slot: "lunch",
            recipeId: best.c.id,
            servings,
            leftoverOfTempId: tempId,
            kcal: servings * best.c.perServing.kcal,
            flexible: false,
          });
          cookUsed.set(tempId, best.servings + servings);
          // Servings with leftovers hanging off them are fixed, so they can't outgrow the cook
          placed.find((p) => p.tempId === tempId)!.flexible = false;
        }
      }
    }

    // Nudge the day onto its target with portion scaling
    const mine = placed.filter((p) => p.date === date);
    const fixedKcal = input.existing.filter((e) => e.date === date).reduce((s, e) => s + e.kcal, 0);
    const fit = fitDay(
      [
        ...(fixedKcal > 0 ? [{ id: "existing", kcal: fixedKcal, servings: 1, flexible: false }] : []),
        ...mine.map((p) => ({ id: p.tempId, kcal: p.kcal, servings: p.servings, flexible: p.flexible })),
      ],
      input.targets.get(date)!,
    );
    for (const change of fit.changes) {
      const p = placed.find((x) => x.tempId === change.id)!;
      const c = byId.get(p.recipeId)!;
      p.servings = change.servings;
      p.kcal = change.servings * c.perServing.kcal;
    }
  }

  return {
    entries: placed.map(({ kcal: _k, flexible: _f, ...e }) => e),
    skipped,
    excluded,
  };
}
