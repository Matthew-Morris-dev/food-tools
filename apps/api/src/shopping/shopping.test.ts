import { describe, expect, it } from "vitest";

import { aisleFor } from "./aisle";
import { shoppingText } from "./format";
import { isProductUrl, searchUrl } from "./links";
import { customPack, defaultPack, formatGrams, planPacks } from "./packs";

describe("aisleFor", () => {
  it.each([
    ["onion", "Fruit and veg"],
    ["garlic cloves", "Fruit and veg"],
    ["sweet potato", "Fruit and veg"],
    ["chicken breast", "Meat and fish"],
    ["beef mince", "Meat and fish"],
    ["salmon fillets", "Meat and fish"],
    ["semi-skimmed milk", "Dairy and eggs"],
    ["eggs", "Dairy and eggs"],
    ["cheddar cheese", "Dairy and eggs"],
    ["wholemeal bread", "Bakery"],
    ["tortilla wraps", "Bakery"],
    ["basmati rice", "Rice, pasta and dry goods"],
    ["spaghetti", "Rice, pasta and dry goods"],
    ["plain flour", "Rice, pasta and dry goods"],
    ["chopped tomatoes", "Tins and jars"],
    ["tinned chickpeas", "Tins and jars"],
    ["olive oil", "Oils and sauces"],
    ["tomato puree", "Oils and sauces"],
    ["curry paste", "Oils and sauces"],
    ["ground cumin", "Herbs and spices"],
    ["fresh coriander", "Herbs and spices"],
    ["frozen peas", "Frozen"],
    ["orange juice", "Drinks"],
    ["bin bags", "Household"],
    ["something unusual", "Other"],
  ])("%s -> %s", (name, aisle) => {
    expect(aisleFor(name)).toBe(aisle);
  });
});

describe("packs", () => {
  it("rounds up to whole packs", () => {
    expect(planPacks({ grams: 700, count: null }, { grams: 400, label: "400 g" })).toEqual({ packs: 2, packLabel: "400 g", buyGrams: 800, buyCount: null });
  });

  it("doesn't buy another pack for a hair over (5%)", () => {
    expect(planPacks({ grams: 415, count: null }, { grams: 400, label: "400 g" })?.packs).toBe(1);
    expect(planPacks({ grams: 430, count: null }, { grams: 400, label: "400 g" })?.packs).toBe(2);
  });

  it("always buys at least one pack of something needed", () => {
    expect(planPacks({ grams: 5, count: null }, { grams: 1000, label: "1 kg" })?.packs).toBe(1);
  });

  it("counts eggs by number when counted", () => {
    const eggs = defaultPack("eggs")!;
    expect(planPacks({ grams: 440, count: 8 }, eggs)).toMatchObject({ packs: 2, buyCount: 12 });
    expect(planPacks({ grams: 110, count: null }, eggs)).toMatchObject({ packs: 1 });
  });

  it("has defaults for common foods and none for the rest", () => {
    expect(defaultPack("beef mince")?.grams).toBe(500);
    expect(defaultPack("chopped tomatoes")?.label).toBe("400 g tin");
    expect(defaultPack("basmati rice")?.grams).toBe(1000);
    expect(defaultPack("unicorn")).toBeNull();
  });

  it("uses your own pack size", () => {
    expect(planPacks({ grams: 900, count: null }, customPack(250))).toMatchObject({ packs: 4, packLabel: "250 g" });
  });

  it("formats weights", () => {
    expect([80, 1000, 1500, 2250, 400].map(formatGrams)).toEqual(["80 g", "1 kg", "1.5 kg", "2.25 kg", "400 g"]);
  });
});

describe("links", () => {
  it("builds encoded search addresses", () => {
    expect(searchUrl("tesco", "chicken breast")).toBe("https://www.tesco.com/shop/en-GB/search?query=chicken%20breast");
    expect(searchUrl("sainsburys", "mac & cheese")).toBe("https://www.sainsburys.co.uk/groceries/search?searchTerm=mac%20%26%20cheese");
    expect(searchUrl("ocado", " milk ")).toBe("https://www.ocado.com/search?q=milk");
  });

  it("accepts a product page on the supermarket's own site", () => {
    expect(isProductUrl("tesco", "https://www.tesco.com/groceries/en-GB/products/254211377")).toBe(true);
    expect(isProductUrl("sainsburys", "https://www.sainsburys.co.uk/gol-ui/product/chicken")).toBe(true);
    expect(isProductUrl("ocado", "https://www.ocado.com/products/heinz-beans-12345")).toBe(true);
  });

  it.each([
    ["tesco", "http://www.tesco.com/groceries/en-GB/products/1"],
    ["tesco", "https://tesco.com.evil.example/products/1"],
    ["tesco", "https://eviltesco.com/products/1"],
    ["tesco", "https://www.ocado.com/products/1"],
    ["tesco", "https://user:pass@www.tesco.com/x"],
    ["tesco", "javascript:alert(1)"],
    ["tesco", "not a url"],
  ] as const)("refuses %s %s", (store, url) => {
    expect(isProductUrl(store, url)).toBe(false);
  });
});

describe("shoppingText", () => {
  it("lists aisles with ticks and pack suggestions", () => {
    const text = shoppingText("Shopping list, 12 Oct", [
      { aisle: "Meat and fish", items: [{ name: "chicken", amount: "700 g", buy: "2 × 400 g", ticked: false }] },
      { aisle: "Empty", items: [] },
      { aisle: "Fruit and veg", items: [{ name: "onions", amount: "3", buy: null, ticked: true }] },
    ]);
    expect(text).toBe("Shopping list, 12 Oct\n\nMeat and fish\n[ ] 700 g chicken (buy 2 × 400 g)\n\nFruit and veg\n[x] 3 onions\n");
  });
});
