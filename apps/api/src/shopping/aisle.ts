// Which supermarket aisle an item is in, from keywords. People can override any item.

export const AISLES = [
  "Fruit and veg",
  "Meat and fish",
  "Dairy and eggs",
  "Bakery",
  "Rice, pasta and dry goods",
  "Tins and jars",
  "Oils and sauces",
  "Herbs and spices",
  "Frozen",
  "Drinks",
  "Snacks and sweets",
  "Household",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

// Checked in order, so specific rules come before general ones
const RULES: [Aisle, RegExp][] = [
  ["Frozen", /\b(frozen|ice cream|fish fingers)\b/],
  ["Household", /\b(bin bags?|foil|cling film|kitchen roll|toilet|washing|sponge|bleach|batteries|bags?)\b/],
  ["Drinks", /\b(juice|squash|cola|lemonade|beer|wine|tea|coffee|water|cordial)\b/],
  ["Oils and sauces", /\b(oil|vinegar|ketchup|mayonnaise|mayo|mustard|soy sauce|sauce|dressing|puree|paste|stock|gravy|honey|syrup|jam|marmite|peanut butter)\b/],
  ["Tins and jars", /\b(canned|tinned|tin|chopped tomatoes|chickpeas?|beans?|lentils?|coconut milk|sweetcorn|tuna|passata|olives?|pickles?|jar)\b/],
  ["Meat and fish", /\b(chicken|beef|pork|lamb|turkey|duck|bacon|ham|sausages?|mince|steak|gammon|chorizo|salmon|cod|haddock|tuna steak|prawns?|fish|trout|mackerel|sardines?|seafood)\b/],
  ["Dairy and eggs", /\b(milk|cheese|butter|cream|yoghurt|yogurt|eggs?|cheddar|mozzarella|parmesan|feta|halloumi|ricotta|custard|creme fraiche)\b/],
  ["Bakery", /\b(bread|rolls?|baguette|wraps?|tortillas?|pitta|naan|bagels?|crumpets?|croissants?|buns?|sourdough|pastry)\b/],
  ["Herbs and spices", /\b(salt|pepper|cumin|paprika|turmeric|cinnamon|oregano|thyme|rosemary|basil|coriander|parsley|mint|chilli powder|curry powder|garam masala|nutmeg|ginger|spice|mixed herbs|bay leaf|bay leaves|chives|dill)\b/],
  ["Fruit and veg", /\b(onions?|garlic|carrots?|potato(?:es)?|tomato(?:es)?|peppers?|courgettes?|aubergines?|mushrooms?|broccoli|cauliflower|spinach|lettuce|cucumber|celery|leeks?|cabbage|kale|apples?|bananas?|lemons?|limes?|oranges?|berries|strawberries|grapes|avocados?|sweet potato|squash|spring onions?|salad|beetroot|peas|runner beans|green beans|fruit|veg)\b/],
  ["Rice, pasta and dry goods", /\b(rice|pasta|spaghetti|penne|fusilli|noodles?|flour|sugar|oats|porridge|cereal|couscous|quinoa|breadcrumbs|cornflour|baking powder|yeast|lentils|stuffing|crackers)\b/],
  ["Snacks and sweets", /\b(crisps|chocolate|biscuits?|sweets|nuts|cake|popcorn|snack|bar)\b/],
];

export function aisleFor(name: string): Aisle {
  const lower = name.toLowerCase();
  return RULES.find(([, re]) => re.test(lower))?.[0] ?? "Other";
}

export const isAisle = (value: string): value is Aisle => (AISLES as readonly string[]).includes(value);
