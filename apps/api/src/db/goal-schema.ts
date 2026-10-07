import { boolean, date, index, integer, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const sex = pgEnum("sex", ["male", "female", "unspecified"]);
export const activityLevel = pgEnum("activity_level", ["sedentary", "light", "moderate", "active", "very_active"]);
export const goalType = pgEnum("goal_type", ["lose", "maintain", "gain", "build"]);
export const goalReason = pgEnum("goal_reason", ["setup", "edit", "check_in"]);
export const weightUnit = pgEnum("weight_unit", ["kg", "st_lb", "lb"]);
export const heightUnit = pgEnum("height_unit", ["cm", "ft_in"]);

const owner = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const profiles = pgTable("profile", {
  userId: owner().primaryKey(),
  birthYear: integer().notNull(),
  sex: sex().notNull(),
  heightCm: real().notNull(),
  activityLevel: activityLevel().notNull(),
  weightUnit: weightUnit().notNull().default("kg"),
  heightUnit: heightUnit().notNull().default("cm"),
});

// Goals are versioned: a date's targets come from the latest goal active on or before it
export const goals = pgTable(
  "goal",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    type: goalType().notNull(),
    ratePerWeekKg: real().notNull().default(0),
    startWeightKg: real().notNull(),
    targetWeightKg: real(),
    kcal: real().notNull(),
    protein: real().notNull(),
    carbs: real().notNull(),
    fat: real().notNull(),
    manual: boolean().notNull().default(false),
    // ISO weekdays, 1 = Monday ... 7 = Sunday
    trainingWeekdays: integer().array().notNull().default([]),
    trainingDayExtraKcal: real().notNull().default(200),
    exerciseAddsToAllowance: boolean().notNull().default(false),
    activeFrom: date({ mode: "string" }).notNull(),
    reason: goalReason().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("goal_user_active_from_idx").on(t.userId, t.activeFrom)],
);

export const weightEntries = pgTable(
  "weight_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    date: date({ mode: "string" }).notNull(),
    weightKg: real().notNull(),
  },
  (t) => [uniqueIndex("weight_entry_user_date_idx").on(t.userId, t.date)],
);

export const exerciseEntries = pgTable(
  "exercise_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    date: date({ mode: "string" }).notNull(),
    activity: text().notNull(),
    minutes: integer().notNull(),
    kcal: real().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("exercise_entry_user_date_idx").on(t.userId, t.date)],
);

// Per-day overrides. trainingDay null means "follow the weekly schedule"
export const days = pgTable(
  "day",
  {
    userId: owner(),
    date: date({ mode: "string" }).notNull(),
    trainingDay: boolean(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const checkIns = pgTable(
  "check_in",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: owner(),
    date: date({ mode: "string" }).notNull(),
    observedRateKg: real(),
    suggestedKcal: real(),
    accepted: boolean().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("check_in_user_date_idx").on(t.userId, t.date)],
);
