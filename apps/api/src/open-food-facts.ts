import type { Serving } from "./db/schema";

// Open Food Facts asks apps to identify themselves
const USER_AGENT = "FoodTools/0.1 (https://github.com/Matthew-Morris-dev/food-tools)";
const FIELDS = "product_name,product_name_en,brands,serving_size,serving_quantity,nutriments";

export type OffProduct =
  | {
      complete: true;
      name: string;
      brand: string | null;
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
      sugars: number | null;
      fibre: number | null;
      saturates: number | null;
      salt: number | null;
      servings: Serving[];
    }
  // Found, but without enough nutrition data to log
  | { complete: false; name: string | null; brand: string | null };

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function parseProduct(p: Record<string, any>): OffProduct {
  const n = p.nutriments ?? {};
  const name: string | null = (p.product_name_en || p.product_name || "").trim() || null;
  const brands: string[] = Array.isArray(p.brands) ? p.brands : String(p.brands ?? "").split(",");
  const brand = brands[0]?.trim() || null;

  const kj = num(n["energy-kj_100g"]);
  const kcal = num(n["energy-kcal_100g"]) ?? (kj === null ? null : Math.round(kj / 4.184));
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (!name || kcal === null || protein === null || carbs === null || fat === null) {
    return { complete: false, name, brand };
  }

  const servingGrams = num(p.serving_quantity);
  const servings: Serving[] =
    servingGrams && servingGrams > 0 ? [{ label: String(p.serving_size || `${servingGrams} g`), grams: servingGrams }] : [];

  return {
    complete: true,
    name,
    brand,
    kcal,
    protein,
    carbs,
    fat,
    sugars: num(n.sugars_100g),
    fibre: num(n.fiber_100g),
    saturates: num(n["saturated-fat_100g"]),
    salt: num(n.salt_100g),
    servings,
  };
}

// Open Food Facts allows about 15 product reads a minute per IP
export async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);

  const body = (await res.json()) as { status: number; product?: Record<string, any> };
  if (body.status !== 1 || !body.product) return null;
  return parseProduct(body.product);
}

// Full-text search of UK products. Open Food Facts allows about 10 searches a minute
// per IP, so the app only calls this when asked, never as you type.
export async function searchProducts(query: string) {
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", `${query} countries_tags:"en:united-kingdom"`);
  url.searchParams.set("page_size", "25");
  url.searchParams.set("langs", "en");
  url.searchParams.set("fields", `code,${FIELDS}`);

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open Food Facts search returned ${res.status}`);
  const body = (await res.json()) as { hits: Record<string, any>[] };

  return body.hits.flatMap((hit) => {
    const product = parseProduct(hit);
    return product.complete && /^\d{6,14}$/.test(hit.code) ? [{ ...product, barcode: String(hit.code) }] : [];
  });
}
