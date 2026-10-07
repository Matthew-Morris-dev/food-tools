# Food Tools App — Product Spec

3 Oct 2026 · @Matthew

## Overview

Version 1 is a single mobile-first app that links three things: what you eat, what you plan to eat, and what you need to buy. You set a goal, the app turns it into daily targets, the meal planner fills a week against those targets, and the shopping list is generated from the plan.

**Who it's for:** one UK-based user (you) first, built so it could later support a household or other users.

**In v1:**

- Calorie and macro logging (search, barcode scan, quick-add, saved meals)
- Fitness goals that set calorie and protein targets, plus weight tracking
- A weekly meal planner built from your own recipes, with portions scaled to your targets
- A smart shopping list merged from the plan, with one-tap search links for Tesco, Sainsbury's and Ocado

**Not in v1:** the daily planner (journal, to-dos, wants, meetings), automatic basket filling, wearable sync, and social features. These sit on the roadmap.

The app is one shell with modules. Each tool is a tab in the same app, sharing one account, one database and one design, so the daily planner can slot in later without a rebuild.

## Core user journeys

Once a week you plan, build the list and shop (target: under 15 minutes); every day you confirm planned meals and add extras (target: under a minute); the weekly check-in feeds any target change back into next week's plan.

## Calorie counter

Logging a meal should take under 10 seconds for anything you've eaten before. Speed of repeat logging matters more than the size of the food database.

| Feature | What it does | Priority |
| --- | --- | --- |
| Today view | Calories and protein/carbs/fat eaten vs target, split by breakfast, lunch, dinner, snacks | Must |
| Food search | Search a food database plus your own foods; recent and frequent items shown first | Must |
| Barcode scan | Scan a packet to pull its nutrition per 100 g and per serving | Must |
| Log from plan | One tap logs whatever the meal planner scheduled for that slot | Must |
| Quick add | Enter calories and macros directly, no food needed | Must |
| Custom foods | Add a food by hand or from a photo of the nutrition label | Should |
| Saved meals | Group foods you eat together (e.g. your usual breakfast) and log them in one tap | Should |
| Copy a day | Repeat yesterday or any past day | Should |
| Water and notes | Simple water count and a free-text note per day | Could |
| Photo logging | Estimate a meal from a photo using AI, always shown as an editable estimate | Later |

**Units:** grams and millilitres by default, with household measures (slice, tbsp, cup) where the food data has them. Energy in kcal, with kJ as a setting.

## Fitness goals and targets

The goal is the single source of truth: it sets the daily calorie and macro targets that both the counter and the meal planner work to.

1. **Profile:** age, sex, height, current weight, activity level.
2. **Goal type:** lose, maintain, gain, or build muscle, with an optional target weight and date.
3. **Targets calculated:** estimated energy needs (Mifflin-St Jeor equation × activity factor), adjusted for the goal, then split into protein, carbs and fat.
4. **Weekly check-in:** log weight; the app compares the trend (a 7-day rolling average, not single weigh-ins) with the plan and suggests a target adjustment, which you approve.

Other goal features:

- Manual override of any target for people working with a coach or dietitian
- Training days vs rest days, with different calorie targets if wanted
- Exercise logged as a simple entry (activity, minutes, estimated kcal), with a setting for whether it adds to the day's allowance
- Progress view: weight trend, average intake vs target, protein hit rate

**Guard rails:** the app caps the planned rate of loss and never sets a target below a safe floor. The details are in the risks section.

## Meal planner

The planner fills a week of meals that hit your targets, using recipes you actually like, and scales portions rather than forcing new recipes.

| Feature | What it does | Priority |
| --- | --- | --- |
| Recipe library | Your recipes with ingredients, servings and method; nutrition calculated from the ingredients | Must |
| Recipe import | Paste a recipe URL or text and parse ingredients into the library | Must |
| Week grid | 7 days × meal slots; drag recipes in, each day shows its totals against target | Must |
| Portion scaling | Adjust a meal's portion so the day lands on target; shown as grams or servings | Must |
| Batch cooking and leftovers | Cook once, fill later slots from the same batch; the shopping list counts it once | Must |
| Auto-fill | Suggest a full week from your library, respecting targets, likes, dislikes and repeats | Should |
| Pantry | Mark staples you already have so they're left off the list | Should |
| Templates | Save a good week and reuse it | Should |
| Dietary rules | Allergies and exclusions (e.g. vegetarian, no nuts) applied everywhere | Should |
| Budget per week | Estimated cost of the plan, once price data is available | Later |

**Link to the counter:** each planned meal appears in the counter's day as a pending entry. You confirm it as eaten, adjust the portion, or swap it, so planned and actual stay separate.

## Smart shopping list and supermarkets

v1 builds the list automatically and gets you to each item on the supermarket site in one tap; it does not fill the basket itself. None of Tesco, Sainsbury's or Ocado offers a public basket API today: Tesco's old developer API, which could edit baskets, was switched off in January 2016.

How the list works:

1. Pull every ingredient from the week's plan, scaled to the planned portions.
2. Merge duplicates and convert units (2 × 200 g chicken + 300 g chicken = 700 g chicken).
3. Subtract pantry staples and anything already covered by a batch cook.
4. Round to how things are sold (700 g chicken → 2 × 400 g packs), using a pack-size table you can edit.
5. Group by aisle (produce, meat, dairy, tins, frozen) and let you tick items off in store.

Getting items into a basket:

| Option | How it works | Effort | Reliability |
| --- | --- | --- | --- |
| Search links (v1) | Each item opens a search for it on Tesco, Sainsbury's or Ocado in the app or browser | Low | High; only the search URL format can change |
| Remembered products (v1.1) | When you pick a product once, the app saves its link so next time it opens that exact product | Low | High |
| Whisk / Samsung Food (v2, to explore) | Samsung Food's shopping lists can already be sent to Tesco, Ocado, Sainsbury's and Amazon Fresh baskets in the UK; Whisk sells this to businesses, so access for a small app is unconfirmed | Medium | High if granted |
| Browser automation (v2, optional) | An assistant such as Claude in Chrome adds items in your own logged-in browser, on request | Medium | Breaks when sites change |
| Unofficial APIs (not recommended) | Community tools such as basketeer call Tesco's private site API directly | Medium | Fragile; may breach site terms and risk your account |

Tesco is also trialling an AI assistant in its own app that plans meals and adds ingredients to the basket, so watch for any partner access it opens up.

## Screens and navigation

Five bottom tabs, with Today as the home screen; a floating + button logs food from anywhere.

| Tab | Main screen | Key sub-screens |
| --- | --- | --- |
| Today | Calories and macros ring, meals for today (planned and logged), water | Food search, barcode scanner, food detail with portion picker, quick add |
| Plan | Week grid with daily totals vs target | Recipe picker, auto-fill suggestions, batch-cook setup, saved templates |
| Recipes | Your recipe library with search and tags | Recipe detail with nutrition, recipe editor, import from URL |
| Shop | This week's list grouped by aisle | Pantry, pack sizes, store picker (Tesco / Sainsbury's / Ocado) |
| Progress | Weight trend and intake vs target | Goal settings, weekly check-in, exercise log |

Settings (profile, units, dietary rules, data export) sit behind the avatar at the top of Today. When the daily planner arrives, it becomes its own tab and Today shows both food and the day's agenda.

## Data model

Everything hangs off a user, and nutrition is always stored per 100 g so any portion can be calculated.

| Entity | Key fields | Links to |
| --- | --- | --- |
| User | name, units, dietary rules, created date | Goal, everything below |
| Goal | type, start weight, target weight, target date, kcal/protein/carbs/fat targets, active from | User |
| WeightEntry | date, weight kg | User |
| Food | name, brand, barcode, source (database / custom), kcal and macros per 100 g, serving sizes | — |
| Recipe | name, servings, method, tags; nutrition derived from its ingredients | RecipeIngredient |
| RecipeIngredient | quantity, unit, grams equivalent | Recipe, Food |
| MealPlanEntry | date, slot (breakfast/lunch/dinner/snack), portion multiplier, batch id | Recipe or Food |
| FoodLogEntry | date, slot, grams, status (planned / eaten), kcal and macros snapshot | Food or Recipe, optional MealPlanEntry |
| ExerciseEntry | date, activity, minutes, kcal | User |
| PantryItem | food, always have (yes/no) | Food |
| ShoppingListItem | week, name, total quantity, pack size, aisle, ticked, saved store links | Food |
| StoreProduct | store, product URL, pack size, last chosen | Food |

Log entries keep a snapshot of the nutrition at the time of logging, so editing a food later doesn't rewrite your history.

## Food data sources

Use two free sources in v1: the UK government dataset for everyday generic foods, and Open Food Facts for barcodes. Both are free to use with attribution; a paid UK branded database can come later if gaps hurt.

| Source | What it covers | Cost and licence | Role in the app |
| --- | --- | --- | --- |
| CoFID (McCance and Widdowson) | Official UK reference data: 2,898 common foods and recipes, 185 nutrients; last updated 2021 | Free Excel download, Open Government Licence (credit the source) | Load into the app's own database as the generic food list (apple, chicken breast, boiled rice) |
| Open Food Facts | 3M+ packaged products worldwide, crowd-sourced, per-100 g nutrition | Free, no API key, Open Database Licence | Barcode lookups (one API call per real scan, as their rules ask); credit Open Food Facts on screen and send user corrections back |
| FatSecret Platform | 1.9M+ verified foods, branded and restaurant items | Free tiers cover the US dataset only, with attribution; UK data needs the paid Premier edition, priced on request | Optional upgrade if Open Food Facts gaps on UK brands become a problem |
| Your own foods | Anything missing, added by hand or from a label photo | Free | Fills gaps; becomes the most-used source over time |

Open Food Facts data is crowd-sourced, so show a quick "check this looks right" step on first scan and let you correct and save a product.

As built (6 Oct 2026): Open Food Facts is also searchable by text, filtered to UK products, behind an explicit "Search Open Food Facts" button because its API allows about 10 searches a minute. Every product fetched is cached in the server's database, so it shows up in local search afterwards. Contributing corrections and new products back to Open Food Facts is planned; it needs an Open Food Facts account for the server to write with.

## Tech stack

Decided (5 Oct 2026): a React Native app built with Expo, talking to a self-hosted TypeScript API and Postgres that run with `docker compose up` on a homelab. One TypeScript codebase gives you iOS and Android, native barcode scanning, and room to add the daily planner as another module later.

| Layer | Choice | Why | Alternative |
| --- | --- | --- | --- |
| App | React Native + Expo | iOS and Android from one codebase; camera and barcode scanning built in; over-the-air updates | Progressive web app (Next.js): quicker to start, but barcode scanning and notifications are weaker on iPhone |
| Connectivity | Online-only for now; the app calls the API directly | Simplest to build; people are usually connected | SQLite on the device with sync, if offline logging becomes a need |
| Backend | Postgres in Docker, Drizzle ORM for schema and migrations | Relational data fits this model well; one container, easy to back up | Self-hosted Supabase (around 10 containers) or PocketBase |
| Server logic and auth | Hono API on Node with Better Auth (email and password), in Docker | Food lookups, recipe import, list generation, and any AI calls run here so API keys never sit in the app; same language and types as the app | Hosted Supabase |
| Recipe import | Read schema.org Recipe data from the page, falling back to an AI parser | Most recipe sites publish structured recipe data | Manual entry only |
| AI (optional) | Claude API for recipe parsing, label photos, week auto-fill | Handles messy text and images well | Rule-based only |

**Build order:** shared shell and auth → calorie counter → goals → recipes → meal planner → shopping list. Each step is usable on its own, so you can start using the counter while the planner is being built.

## Roadmap

Ship the food tools first; the daily planner joins in v2.

| Phase | Includes | Gate to the next phase |
| --- | --- | --- |
| **v1** — Food tools MVP | Calorie counter and barcode scan · Goals, targets, weight trend · Recipe library and URL import · Week planner, portion scaling · Shopping list with store links | Logging feels effortless |
| **v1.1** — Polish | Remembered store products · Auto-fill a week · Pantry and saved templates · Food entry from label photos | Food tools in daily use |
| **v2** — Daily planner joins | Journal · To-dos and wants lists · Meetings via calendar sync · Today shows food and agenda · Explore Whisk basket access | Decide on public release |
| **Later** — When it earns its place | Household sharing · Apple Health / Health Connect · Weekly cost estimates · Photo meal logging | — |

Each phase starts only once the gate above it is met, so the daily planner waits until the food tools are part of your routine rather than being built in parallel.

## Risks, safeguards and open questions

The biggest product risk is the basket feature promising more than the supermarkets allow; the biggest user risk is a calorie app that encourages unhealthy restriction.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No official basket API | Auto-fill can't ship as first imagined | Search links in v1; explore Whisk partnership; keep automation optional and user-triggered |
| Supermarket search URLs change | Links break | Store URL patterns in config, not code; test them monthly |
| Crowd-sourced food data errors | Wrong totals | Confirm on first scan; let users correct; prefer CoFID for generic foods |
| Health data is sensitive | UK GDPR treats health data as special category | Explicit consent, encryption, data export and delete, no selling or ad tracking |
| Scope creep from the full utility vision | v1 never ships | Ship the counter first; planner waits until the food tools are in daily use |

**Wellbeing safeguards (built in from day one):**

- A minimum daily calorie target the app won't plan below without a manual override and a warning
- A cap on the planned rate of weight loss, in line with NHS guidance of roughly 0.5 to 1 kg a week
- No red "over" warnings, streak-loss shaming, or guilt language; going over target is shown neutrally
- An option to hide numbers and track habits or portions instead
- A support page linking to Beat, the UK eating disorder charity, reachable from settings

**Open questions:**

- [ ] Personal use only, or published on the App Store and Google Play? (Publishing adds privacy policy, accounts and review work.)
- [ ] Budget for a paid UK branded food database if Open Food Facts gaps are frequent?
- [ ] Which supermarket do you use most, so it becomes the default store?
- [ ] Is this for one person, or a household sharing a plan and list?

## Sources

- [Tesco API listing (switched off January 2016)](https://www.programmableweb.com/api/tesco), ProgrammableWeb
- [Integrated Stores](https://support.samsungfood.com/hc/en-us/articles/360042706091-Integrated-Stores), Samsung Food Help
- [basketeer](https://github.com/jonnyreeves/basketeer), GitHub
- [Tesco launches meal-planning, basket-building in-app AI assistant](https://www.thegrocer.co.uk/news/tesco-launches-meal-planning-basket-building-in-app-ai-assistant/717474.article), The Grocer
- [CoFID FAQ](https://fnnbri.quadram.ac.uk/help/), Food and Nutrition National Bioscience Research Infrastructure
- [Open Food Facts data and API](https://world.openfoodfacts.org/data)
- [fatsecret Platform Editions](https://platform.fatsecret.com/api-editions)

## As built: goals and targets (7 Oct 2026)

- **Energy:** Mifflin-St Jeor × activity factor (1.2 to 1.9). "Prefer not to say" uses the midpoint of the sex constants.
- **Pace:** lose 0.25 to 1 kg a week (capped at 1% of bodyweight), gain 0.25 or 0.5, build muscle 0.1 or 0.25; 7,700 kcal per kg.
- **Floor:** never below 1,200 kcal (female) or 1,500 kcal (otherwise). A manual target below the floor needs an explicit acknowledgement.
- **Macros:** protein 1.4 to 1.8 g per kg of the lower of current weight and BMI 25 weight; fat 30% of calories (minimum 0.6 g/kg); carbs the rest.
- **Training days:** chosen weekdays get extra calories (default +200, as carbs); any day can be switched from Today. Logged exercise only adds to the allowance if that setting is on.
- **Goals are versioned.** Each edit or accepted check-in adds a goal from its start date, so past days keep the targets that applied then.
- **Weight:** stored in kg; shown as kg, st + lb or lb. Targets and check-ins follow the 7-day average of weigh-ins, not single weigh-ins.
- **Weekly check-in:** due a week after the goal or last check-in. Needs 3 weigh-ins in the last week and some from the week before. Within 0.2 kg a week of plan is on track; otherwise suggest half the gap in calories, at most 200 kcal, never below the floor, and always upward when losing faster than 1 kg a week. The user approves or keeps current targets.
- **Not yet built:** option to hide numbers (tracked as a GitHub issue).

## As built: recipe library (8 Oct 2026)

- **A recipe** is a name, servings, method, tags, an optional cooked weight and source link, plus ingredients. Each ingredient has a food and a weight in grams; the amount as written ("2 tbsp") is kept for display. Nutrition is never typed in: it is calculated from the ingredients when read, so fixing a food corrects every recipe that uses it. Ingredients with no food chosen count as zero and mark the recipe "Incomplete".
- **Logging:** one diary entry per log, with a snapshot of the nutrition. Log some servings, or, if the recipe has a cooked weight, grams of the finished dish.
- **Import** reads the recipe data a web page publishes (or pasted text), then:
  - parses each ingredient line into amount, unit, name and note;
  - matches it to a food, mapping UK wording to CoFID names (chicken breast is "light meat", and so on) and preferring plain, raw and unflavoured versions;
  - works out grams: exact for weights, estimated from densities and typical weights for volumes and counts, flagged for the user to check.
  The result is a draft shown in the editor; nothing is saved until the user saves it. On the BBC Good Food chicken curry it lands on 354 kcal per serving, the same as the site.
- **Known gaps:** CoFID has no cumin, oregano, paprika or chickpeas, so those lines are left for the user to match (the food picker can search Open Food Facts). Sites that block scrapers need the text pasted.
- **Page fetching** is guarded: the server refuses private, local and link-local addresses, including hostnames that resolve to them and redirects to them, and caps time and size.
- **Optional Claude fallback:** with `ANTHROPIC_API_KEY` set, pages with no recipe data, and pasted text when "Tidy with Claude" is switched on, are read by Claude Haiku 4.5. Only the recipe text is sent. The result is a draft like any other. An API key is used rather than a subscription login, because Anthropic doesn't allow third-party products to offer claude.ai login.
