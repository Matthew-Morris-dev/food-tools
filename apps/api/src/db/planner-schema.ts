import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, real, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { foodLogEntries, foods, mealSlot, recipes } from "./food-schema";

const owner = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// What's planned to be eaten, separate from what was eaten. Confirming an entry creates
// a normal diary entry and links it back through logEntryId.
export const mealPlanEntries = pgTable(
  "meal_plan_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    date: date({ mode: "string" }).notNull(),
    slot: mealSlot().notNull(),
    // Exactly one of these is set
    recipeId: uuid().references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid().references(() => foods.id, { onDelete: "cascade" }),
    // Portions of a recipe
    servings: real(),
    // Weight of a food
    grams: real(),
    // This meal is eaten from the cook of another entry
    leftoverOfId: uuid().references((): AnyPgColumn => mealPlanEntries.id, { onDelete: "set null" }),
    // Fitting a day to its target leaves locked entries alone
    locked: boolean().notNull().default(false),
    logEntryId: uuid().references(() => foodLogEntries.id, { onDelete: "set null" }),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("meal_plan_entry_user_date_idx").on(t.userId, t.date),
    check("meal_plan_entry_one_item", sql`(${t.recipeId} IS NULL) <> (${t.foodId} IS NULL)`),
  ],
);

export const planTemplates = pgTable(
  "plan_template",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    name: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("plan_template_user_id_idx").on(t.userId)],
);

export const planTemplateEntries = pgTable(
  "plan_template_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    templateId: uuid()
      .notNull()
      .references(() => planTemplates.id, { onDelete: "cascade" }),
    // 0 = Monday ... 6 = Sunday
    dayOffset: integer().notNull(),
    slot: mealSlot().notNull(),
    recipeId: uuid().references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid().references(() => foods.id, { onDelete: "cascade" }),
    servings: real(),
    grams: real(),
    leftoverOfId: uuid().references((): AnyPgColumn => planTemplateEntries.id, { onDelete: "set null" }),
    locked: boolean().notNull().default(false),
  },
  (t) => [index("plan_template_entry_template_id_idx").on(t.templateId)],
);

export const plannerSettings = pgTable("planner_settings", {
  userId: owner().primaryKey(),
  // Presets such as "vegetarian" or "nut-free"
  diets: text().array().notNull().default([]),
  // Your own words to keep out of the plan
  excludedWords: text().array().notNull().default([]),
});
