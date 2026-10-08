import { boolean, date, index, pgEnum, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const store = pgEnum("store", ["tesco", "sainsburys", "ocado"]);

const owner = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// What you've decided about an item, kept across weeks. The key is `food:<id>` for a
// matched food, else `name:<normalised name>`, so the same food merges across recipes.
export const shoppingItemPrefs = pgTable(
  "shopping_item_pref",
  {
    userId: owner(),
    key: text().notNull(),
    name: text().notNull(),
    aisle: text(),
    // Your own pack size, overriding the built-in table
    packGrams: real(),
    inPantry: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// Ticks for one week's list (the list itself is worked out from the plan each time)
export const shoppingTicks = pgTable(
  "shopping_tick",
  {
    userId: owner(),
    weekStart: date({ mode: "string" }).notNull(),
    key: text().notNull(),
    ticked: boolean().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart, t.key] })],
);

// Things you add yourself (bin bags, a birthday card)
export const shoppingManualItems = pgTable(
  "shopping_manual_item",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    weekStart: date({ mode: "string" }).notNull(),
    name: text().notNull(),
    aisle: text(),
    ticked: boolean().notNull().default(false),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("shopping_manual_item_user_week_idx").on(t.userId, t.weekStart)],
);

// A product page you've saved for an item, so it opens that exact product
export const storeProducts = pgTable(
  "store_product",
  {
    userId: owner(),
    key: text().notNull(),
    store: store().notNull(),
    url: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key, t.store] })],
);
