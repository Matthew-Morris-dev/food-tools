import { date, index, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export type Serving = { label: string; grams: number };

export const foodSource = pgEnum("food_source", ["cofid", "off", "custom"]);
export const mealSlot = pgEnum("meal_slot", ["breakfast", "lunch", "dinner", "snack"]);
export const logStatus = pgEnum("log_status", ["planned", "eaten"]);

// Nutrition is always per 100 g so any portion can be calculated
export const foods = pgTable(
  "food",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: foodSource().notNull(),
    // CoFID food code or Open Food Facts barcode; null for custom foods
    sourceId: text(),
    // Set for custom foods, which only their owner can see
    ownerId: text().references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    brand: text(),
    barcode: text(),
    kcal: real().notNull(),
    protein: real().notNull(),
    carbs: real().notNull(),
    fat: real().notNull(),
    sugars: real(),
    fibre: real(),
    saturates: real(),
    salt: real(),
    servings: jsonb().$type<Serving[]>().notNull().default([]),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("food_source_source_id_idx").on(t.source, t.sourceId),
    index("food_barcode_idx").on(t.barcode),
    index("food_owner_id_idx").on(t.ownerId),
  ],
);

// Entries keep a snapshot of the nutrition at the time of logging, so editing a
// food later doesn't rewrite history
export const foodLogEntries = pgTable(
  "food_log_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    slot: mealSlot().notNull(),
    status: logStatus().notNull().default("eaten"),
    foodId: uuid().references(() => foods.id, { onDelete: "set null" }),
    name: text().notNull(),
    brand: text(),
    // Null for quick-add entries
    grams: real(),
    kcal: real().notNull(),
    protein: real().notNull(),
    carbs: real().notNull(),
    fat: real().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("food_log_entry_user_date_idx").on(t.userId, t.date)],
);
