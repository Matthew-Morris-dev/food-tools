// A keyword check of ingredient names against diets and excluded words. It is not an
// allergen guarantee: it can't see inside packaged foods, so labels still need reading.

// `skipIf` drops an ingredient from the rule altogether, e.g. "gluten-free pasta"
type Rule = { words: string; except?: string; skipIf?: string };

const MEAT = "beef|pork|lamb|mutton|chicken|turkey|duck|goose|bacon|ham|sausage|mince|steak|veal|venison|rabbit|gammon|chorizo|salami|pepperoni|prosciutto|liver|kidney|oxtail|brisket|meatball|lard|suet|gelatine|gelatin|pate|burger";
const FISH = "fish|salmon|tuna|cod|haddock|trout|mackerel|sardine|anchovy|anchovies|prawn|shrimp|crab|lobster|mussel|oyster|squid|scallop|herring|plaice|bass|bream|kipper|pollock|whitebait|seafood|clam|crayfish";
const DAIRY = "milk|cheese|butter|cream|yoghurt|yogurt|ghee|whey|casein|custard|paneer|halloumi|mozzarella|cheddar|parmesan|feta|ricotta|mascarpone|brie|creme fraiche|kefir|buttermilk";
const DAIRY_EXCEPT = "coconut milk|coconut cream|almond milk|oat milk|soya milk|soy milk|rice milk|cashew milk|peanut butter|nut butter|almond butter|butternut|cocoa butter|coconut butter|shea butter|cream of tartar|coconut yoghurt|coconut yogurt|plant milk|dairy[- ]free";

export const DIET_PRESETS: Record<string, { label: string; rules: Rule[] }> = {
  vegetarian: { label: "Vegetarian", rules: [{ words: MEAT }, { words: FISH }] },
  pescatarian: { label: "Pescatarian", rules: [{ words: MEAT }] },
  vegan: {
    label: "Vegan",
    rules: [{ words: MEAT }, { words: FISH }, { words: `${DAIRY}|egg|eggs|mayonnaise|mayo|honey|meringue`, except: DAIRY_EXCEPT }],
  },
  "dairy-free": { label: "Dairy-free", rules: [{ words: DAIRY, except: DAIRY_EXCEPT, skipIf: "dairy[- ]free" }] },
  "gluten-free": {
    label: "Gluten-free",
    rules: [
      {
        words: "wheat|flour|bread|pasta|spaghetti|noodle|noodles|couscous|barley|rye|semolina|bulgur|spelt|farro|seitan|biscuit|cracker|breadcrumb|breadcrumbs|pizza|tortilla|pitta|naan|pastry|beer",
        except: "cornflour|corn flour|rice flour|potato flour|chickpea flour|gram flour|almond flour|coconut flour|buckwheat flour|rice noodle|rice noodles|corn tortilla",
        skipIf: "gluten[- ]free",
      },
    ],
  },
  "nut-free": {
    label: "Nut-free",
    rules: [
      {
        words: "almond|almonds|walnut|walnuts|cashew|cashews|pecan|pecans|pistachio|pistachios|hazelnut|hazelnuts|peanut|peanuts|macadamia|brazil nut|brazil nuts|pine nut|pine nuts|chestnut|chestnuts|praline|marzipan|nuts|nut",
        except: "nutmeg|butternut|coconut|water chestnut|water chestnuts",
        skipIf: "nut[- ]free",
      },
    ],
  },
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRegex = (alternation: string) => new RegExp(`\\b(?:${alternation})(?:s|es)?\\b`, "gi");

// The words in the ingredients that break a diet or your own exclusions, empty if none
export function dietViolations(ingredientNames: string[], diets: string[], excludedWords: string[]): string[] {
  const found = new Set<string>();
  for (const name of ingredientNames) {
    const lower = name.toLowerCase();
    for (const diet of diets) {
      for (const rule of DIET_PRESETS[diet]?.rules ?? []) {
        if (rule.skipIf && new RegExp(rule.skipIf, "i").test(lower)) continue;
        const text = rule.except ? lower.replace(wordRegex(rule.except), " ") : lower;
        for (const m of text.matchAll(wordRegex(rule.words))) found.add(m[0].toLowerCase());
      }
    }
    for (const word of excludedWords) {
      const w = word.trim().toLowerCase();
      if (w && wordRegex(escape(w)).test(lower)) found.add(w);
    }
  }
  return [...found];
}
