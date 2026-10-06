import { readFileSync } from "node:fs";

import { count, eq } from "drizzle-orm";

import { db } from "./db";
import { foods } from "./db/schema";

type CofidFood = {
  code: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  fibre: number | null;
  saturates: number | null;
  salt: number | null;
};

// Loads the CoFID generic food list, adding any foods that aren't there yet
export async function seedCofid() {
  const data: CofidFood[] = JSON.parse(readFileSync(new URL("../data/cofid.json", import.meta.url), "utf8"));
  const [{ n }] = await db.select({ n: count() }).from(foods).where(eq(foods.source, "cofid"));
  if (n >= data.length) return;

  const rows = data.map(({ code, ...rest }) => ({ ...rest, source: "cofid" as const, sourceId: code }));
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(foods).values(rows.slice(i, i + 500)).onConflictDoNothing();
    }
  });
  console.log(`Loaded ${rows.length - n} CoFID foods`);
}
