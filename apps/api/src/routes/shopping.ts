import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { db } from "../db";
import { foods, shoppingItemPrefs, shoppingManualItems, shoppingTicks, storeProducts } from "../db/schema";
import { weekStart as mondayOf } from "../dates";
import { requireSession, type AuthEnv } from "../middleware";
import { loadEntries, loadRecipes } from "../planner/service";
import { AISLES, aisleFor, isAisle } from "../shopping/aisle";
import { buildNeeds, type Need } from "../shopping/build";
import { shoppingText } from "../shopping/format";
import { STORES, STORE_IDS, isProductUrl, searchUrl, type StoreId } from "../shopping/links";
import { customPack, defaultPack, formatGrams, planPacks } from "../shopping/packs";
import { visibleTo } from "./foods";

const day = z.iso.date();
const storeEnum = z.enum(STORE_IDS as [StoreId, ...StoreId[]]);
const idParam = zValidator("param", z.object({ id: z.uuid() }));
const listQuery = zValidator("query", z.object({ date: day, from: day.optional() }));
const aisleSchema = z.string().refine(isAisle, "Not an aisle");

type Pref = typeof shoppingItemPrefs.$inferSelect;

function amountText(need: Need) {
  if (need.count !== null) return String(need.count);
  if (need.grams > 0) return formatGrams(need.grams);
  return need.written ?? "";
}

// The week's list, worked out from the plan now, with what the user has decided layered on
async function loadList(userId: string, date: string, from?: string) {
  const weekStart = mondayOf(date);
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const end = weekEnd.toISOString().slice(0, 10);

  const [entries, recipes] = await Promise.all([loadEntries(userId, weekStart, end), loadRecipes(userId)]);
  const foodIds = [...new Set(entries.flatMap((e) => (e.foodId ? [e.foodId] : [])))];
  const foodRows = foodIds.length ? await db.select({ id: foods.id, name: foods.name }).from(foods).where(and(inArray(foods.id, foodIds), visibleTo(userId))) : [];
  const foodNames = new Map(foodRows.map((f) => [f.id, f.name]));

  const needs = buildNeeds(
    entries.map((e) => ({
      id: e.id,
      date: e.date,
      recipeId: e.recipeId,
      foodId: e.foodId,
      foodName: e.foodId ? (foodNames.get(e.foodId) ?? null) : null,
      servings: e.servings,
      grams: e.grams,
      leftoverOfId: e.leftoverOfId,
      confirmed: e.confirmed,
    })),
    new Map([...recipes.values()].map((r) => [r.id, { id: r.id, name: r.name, servings: r.servings, ingredients: r.ingredients }])),
    { from },
  );

  const keys = needs.map((n) => n.key);
  const [prefRows, tickRows, manual, productRows] = await Promise.all([
    keys.length ? db.select().from(shoppingItemPrefs).where(and(eq(shoppingItemPrefs.userId, userId), inArray(shoppingItemPrefs.key, keys))) : Promise.resolve([] as Pref[]),
    db.select().from(shoppingTicks).where(and(eq(shoppingTicks.userId, userId), eq(shoppingTicks.weekStart, weekStart))),
    db.select().from(shoppingManualItems).where(and(eq(shoppingManualItems.userId, userId), eq(shoppingManualItems.weekStart, weekStart))),
    keys.length ? db.select().from(storeProducts).where(and(eq(storeProducts.userId, userId), inArray(storeProducts.key, keys))) : Promise.resolve([]),
  ]);
  const prefs = new Map(prefRows.map((p) => [p.key, p]));
  const ticks = new Map(tickRows.map((t) => [t.key, t.ticked]));
  const products = Map.groupBy(productRows, (p) => p.key);

  const links = (key: string, name: string) =>
    Object.fromEntries(
      STORE_IDS.map((s) => {
        const saved = products.get(key)?.find((p) => p.store === s)?.url ?? null;
        return [s, { label: STORES[s].label, url: saved ?? searchUrl(s, name), saved: saved !== null }];
      }),
    );

  const fromNeeds = needs.map((need) => {
    const pref = prefs.get(need.key);
    const pack = pref?.packGrams ? customPack(pref.packGrams) : defaultPack(need.name);
    const plan = pack ? planPacks(need, pack) : null;
    return {
      key: need.key,
      manualId: null as string | null,
      name: need.name,
      aisle: pref?.aisle && isAisle(pref.aisle) ? pref.aisle : aisleFor(need.name),
      amount: amountText(need),
      buy: plan ? `${plan.packs} × ${plan.packLabel}` : null,
      packGrams: pref?.packGrams ?? null,
      defaultPackLabel: pack && !pref?.packGrams ? pack.label : null,
      ticked: ticks.get(need.key) ?? false,
      inPantry: pref?.inPantry ?? false,
      sources: need.sources,
      links: links(need.key, need.name),
    };
  });

  const ownItems = manual.map((m) => ({
    key: `manual:${m.id}`,
    manualId: m.id,
    name: m.name,
    aisle: m.aisle && isAisle(m.aisle) ? m.aisle : aisleFor(m.name),
    amount: "",
    buy: null as string | null,
    packGrams: null as number | null,
    defaultPackLabel: null as string | null,
    ticked: m.ticked,
    inPantry: false,
    sources: [] as Need["sources"],
    links: links(`manual:${m.id}`, m.name),
  }));

  const all = [...fromNeeds, ...ownItems];
  const shown = all.filter((i) => !i.inPantry);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const aisles = AISLES.map((aisle) => ({
    aisle,
    items: shown
      .filter((i) => i.aisle === aisle)
      // Ticked items sink to the bottom of their aisle
      .sort((a, b) => Number(a.ticked) - Number(b.ticked) || byName(a, b)),
  })).filter((a) => a.items.length > 0);

  return {
    weekStart,
    from: from ?? null,
    aisles,
    pantry: all.filter((i) => i.inPantry).sort(byName),
    totals: { total: shown.length, ticked: shown.filter((i) => i.ticked).length },
  };
}

export const shoppingRoutes = new Hono<AuthEnv>()
  .use(requireSession)

  .get("/", listQuery, async (c) => c.json(await loadList(c.get("session").user.id, c.req.valid("query").date, c.req.valid("query").from)))

  .get("/text", listQuery, async (c) => {
    const list = await loadList(c.get("session").user.id, c.req.valid("query").date, c.req.valid("query").from);
    return c.json({
      text: shoppingText(
        `Shopping list, week of ${list.weekStart}`,
        list.aisles.map((a) => ({
          aisle: a.aisle,
          items: a.items.map((i) => ({ name: i.name, amount: i.amount, buy: i.buy, ticked: i.ticked })),
        })),
      ),
    });
  })

  .put("/ticks", zValidator("json", z.object({ date: day, key: z.string().min(1).max(200), ticked: z.boolean() })), async (c) => {
    const userId = c.get("session").user.id;
    const { date, key, ticked } = c.req.valid("json");
    await db
      .insert(shoppingTicks)
      .values({ userId, weekStart: mondayOf(date), key, ticked })
      .onConflictDoUpdate({ target: [shoppingTicks.userId, shoppingTicks.weekStart, shoppingTicks.key], set: { ticked } });
    return c.body(null, 204);
  })

  .post("/ticks/clear", zValidator("json", z.object({ date: day })), async (c) => {
    const userId = c.get("session").user.id;
    const weekStart = mondayOf(c.req.valid("json").date);
    await db.delete(shoppingTicks).where(and(eq(shoppingTicks.userId, userId), eq(shoppingTicks.weekStart, weekStart)));
    await db.update(shoppingManualItems).set({ ticked: false }).where(and(eq(shoppingManualItems.userId, userId), eq(shoppingManualItems.weekStart, weekStart)));
    return c.body(null, 204);
  })

  // Pantry, pack size and aisle for an item; only the fields sent are changed
  .put(
    "/prefs",
    zValidator(
      "json",
      z.object({
        key: z.string().min(1).max(200).refine((k) => !k.startsWith("manual:"), "Your own items don't have preferences"),
        name: z.string().trim().min(1).max(200),
        aisle: aisleSchema.nullable().optional(),
        packGrams: z.number().min(1).max(50000).nullable().optional(),
        inPantry: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const userId = c.get("session").user.id;
      const { key, name, ...changes } = c.req.valid("json");
      await db
        .insert(shoppingItemPrefs)
        .values({ userId, key, name, aisle: changes.aisle ?? null, packGrams: changes.packGrams ?? null, inPantry: changes.inPantry ?? false })
        .onConflictDoUpdate({ target: [shoppingItemPrefs.userId, shoppingItemPrefs.key], set: { name, ...changes } });
      return c.body(null, 204);
    },
  )

  .post("/items", zValidator("json", z.object({ date: day, name: z.string().trim().min(1).max(120), aisle: aisleSchema.optional() })), async (c) => {
    const { date, name, aisle } = c.req.valid("json");
    const [item] = await db
      .insert(shoppingManualItems)
      .values({ userId: c.get("session").user.id, weekStart: mondayOf(date), name, aisle: aisle ?? null })
      .returning();
    return c.json(item, 201);
  })

  .patch("/items/:id", idParam, zValidator("json", z.object({ name: z.string().trim().min(1).max(120).optional(), aisle: aisleSchema.nullable().optional(), ticked: z.boolean().optional() })), async (c) => {
    const changes = c.req.valid("json");
    if (Object.keys(changes).length === 0) throw new HTTPException(400, { message: "Nothing to change" });
    const [item] = await db
      .update(shoppingManualItems)
      .set(changes)
      .where(and(eq(shoppingManualItems.id, c.req.valid("param").id), eq(shoppingManualItems.userId, c.get("session").user.id)))
      .returning();
    if (!item) throw new HTTPException(404, { message: "Item not found" });
    return c.json(item);
  })

  .delete("/items/:id", idParam, async (c) => {
    const [deleted] = await db
      .delete(shoppingManualItems)
      .where(and(eq(shoppingManualItems.id, c.req.valid("param").id), eq(shoppingManualItems.userId, c.get("session").user.id)))
      .returning({ id: shoppingManualItems.id });
    if (!deleted) throw new HTTPException(404, { message: "Item not found" });
    return c.body(null, 204);
  })

  // Remember a product page for an item at a supermarket, or clear it with url: null
  .put(
    "/products",
    zValidator("json", z.object({ key: z.string().min(1).max(200), store: storeEnum, url: z.string().trim().max(2000).nullable() })),
    async (c) => {
      const userId = c.get("session").user.id;
      const { key, store, url } = c.req.valid("json");
      if (url === null) {
        await db.delete(storeProducts).where(and(eq(storeProducts.userId, userId), eq(storeProducts.key, key), eq(storeProducts.store, store)));
        return c.body(null, 204);
      }
      if (!isProductUrl(store, url)) {
        throw new HTTPException(400, { message: `That doesn't look like a ${STORES[store].label} product link. Copy the address of a product page on their website.` });
      }
      await db
        .insert(storeProducts)
        .values({ userId, key, store, url })
        .onConflictDoUpdate({ target: [storeProducts.userId, storeProducts.key, storeProducts.store], set: { url } });
      return c.body(null, 204);
    },
  );

