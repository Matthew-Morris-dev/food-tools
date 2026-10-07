// Turns an ingredient line as written ("2 tbsp sunflower oil", "1 onion thinly sliced",
// "400g can chopped tomatoes") into a quantity, unit, name and note.

export type ParsedIngredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  size: "small" | "medium" | "large" | null;
};

const FRACTIONS: Record<string, string> = {
  "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

// Unit words (lowercase) to a canonical unit
const UNITS: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbs: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  pint: "pint", pints: "pint",
  pinch: "pinch", pinches: "pinch", dash: "dash", dashes: "dash",
  handful: "handful", handfuls: "handful",
  clove: "clove", cloves: "clove",
  slice: "slice", slices: "slice",
  can: "can", cans: "can", tin: "can", tins: "can",
  pack: "pack", packs: "pack", packet: "pack", packets: "pack",
  bunch: "bunch", bunches: "bunch", sprig: "sprig", sprigs: "sprig",
  stick: "stick", sticks: "stick", stalk: "stalk", stalks: "stalk",
  piece: "piece", pieces: "piece", knob: "knob", knobs: "knob",
  rasher: "rasher", rashers: "rasher", fillet: "fillet", fillets: "fillet",
  head: "head", heads: "head",
};

const CONTAINERS = new Set(["can", "cans", "tin", "tins", "jar", "jars", "pack", "packs", "packet", "packets", "bag", "bags", "pot", "pots", "carton", "cartons", "bottle", "bottles"]);

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };

// Units that, with no number in front, mean one
const ONE_OF = new Set(["piece", "knob", "pinch", "dash", "handful", "bunch", "sprig", "stick", "slice", "clove"]);

const SIZES = new Set(["small", "medium", "large"]);
// Words that describe the amount rather than the ingredient
const AMOUNT_ADJECTIVES = new Set(["heaped", "heaping", "level", "rounded", "generous", "good", "thumb-sized", "thumb", "big", "scant"]);

const PREP = "chopped|sliced|diced|grated|crushed|minced|peeled|shredded|cubed|halved|quartered|torn|trimmed|melted|softened|beaten|drained|rinsed|toasted|crumbled|mashed|deseeded|seeded|cored|zested|juiced|sifted|cooked|defrosted|thawed|chilled|warmed";
const PREP_ADVERB = "finely|roughly|thinly|coarsely|freshly|lightly|thickly|very|well|ready|pre";
const PREP_SUFFIX = new RegExp(`\\s+((?:(?:${PREP_ADVERB})[\\s-]+)*(?:${PREP})(?:\\s+(?:and|or|&)\\s+(?:(?:${PREP_ADVERB})\\s+)*(?:${PREP}))*)$`, "i");

const NUM = String.raw`(\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)`;

function toNumber(text: string) {
  const t = text.replace(",", ".").trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

function clean(line: string) {
  let s = line.replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (m) => ` ${FRACTIONS[m]} `);
  s = s.replace(/(\d)\s+(\d\/\d)/g, "$1 $2");
  s = s.replace(/^[\s\-•*·▢☐□✓]+/, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  return s;
}

export function parseIngredient(line: string): ParsedIngredient {
  let s = clean(line);
  const notes: string[] = [];

  // Brackets: weights like "(14oz)" are dropped, anything else becomes a note
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (!/^\s*\d+(?:\.\d+)?\s*(?:oz|g|ml|lb|fl\s*oz|cm|inch|in)\b\s*$/i.test(inner) && inner.trim()) notes.push(inner.trim());
    return " ";
  });
  s = s.replace(/\s+/g, " ").trim();

  let quantity: number | null = null;
  let unit: string | null = null;
  let size: ParsedIngredient["size"] = null;

  // "2 x 400g tins"
  const multi = s.match(/^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)\b\s*/i);
  if (multi) {
    quantity = Number(multi[1]) * Number(multi[2]);
    unit = UNITS[multi[3].toLowerCase()];
    s = s.slice(multi[0].length).replace(/^(?:tins?|cans?|packs?|packets?|jars?|bags?|pots?|cartons?|bottles?)\s+/i, "");
  } else {
    // "400g", "1 1/2 cups", "2-3 cloves"
    const m = s.match(new RegExp(`^${NUM}(?:\\s*-\\s*${NUM})?\\s*`));
    if (m) {
      const first = toNumber(m[1]);
      const second = m[2] ? toNumber(m[2]) : null;
      quantity = second !== null && second > first ? (first + second) / 2 : first;
      s = s.slice(m[0].length);
    } else {
      const word = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+(?=\w)/i);
      // "a pinch of", "a bunch of", "half a ..."; a bare "a" before an ingredient isn't a quantity
      if (word) {
        quantity = NUMBER_WORDS[word[1].toLowerCase()];
        s = s.slice(word[0].length).replace(/^a\s+/i, "");
      }
    }

    // Sizes and amount adjectives can come before the unit
    for (let guard = 0; guard < 3; guard++) {
      const w = s.match(/^([\w-]+)\s+/);
      if (!w) break;
      const lower = w[1].toLowerCase();
      if (SIZES.has(lower)) size = lower as NonNullable<ParsedIngredient["size"]>;
      else if (!AMOUNT_ADJECTIVES.has(lower)) break;
      s = s.slice(w[0].length);
    }

    const u = s.match(/^([a-zA-Z]+)\b\.?\s*/);
    if (u && UNITS[u[1].toLowerCase()]) {
      unit = UNITS[u[1].toLowerCase()];
      s = s.slice(u[0].length);
      // "400g can chopped tomatoes": the can is just the container
      const container = s.match(/^([a-zA-Z]+)\s+/);
      if (container && CONTAINERS.has(container[1].toLowerCase()) && (unit === "g" || unit === "ml" || unit === "kg" || unit === "oz")) {
        s = s.slice(container[0].length);
      }
    }
    // "a pinch of", "piece of ginger": a unit on its own means one of them
    if (unit !== null && quantity === null && ONE_OF.has(unit)) quantity = 1;
  }

  s = s.replace(/^of\s+/i, "").trim();

  // After the first comma is a note ("onion, finely chopped")
  const comma = s.indexOf(",");
  if (comma > 0) {
    notes.unshift(s.slice(comma + 1).trim());
    s = s.slice(0, comma).trim();
  }
  // "onion thinly sliced": preparation words on the end
  const suffix = s.match(PREP_SUFFIX);
  if (suffix && suffix.index! > 0) {
    notes.unshift(suffix[1].trim());
    s = s.slice(0, suffix.index).trim();
  }
  // "to taste", "to serve", "optional" are notes, not ingredients
  const tail = s.match(/\s+(to taste|to serve|for serving|for frying|for dusting|optional)$/i);
  if (tail) {
    notes.unshift(tail[1].toLowerCase());
    s = s.slice(0, tail.index).trim();
  }

  const note = notes.filter(Boolean).join(", ") || null;
  return { quantity, unit, name: s || line.trim(), note, size };
}
