import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt, forGrams, parseNumber, SLOTS, sum } from '@/lib/nutrition';
import { pickFood } from '@/lib/pick-food';
import { useCreateRecipe, useRecipe, useUpdateRecipe } from '@/lib/queries';
import { takeDraft, type Draft } from '@/lib/recipe-draft';
import type { Food, Recipe, RecipePreference, Slot } from '@/lib/types';

type Row = {
  key: string;
  foodId: string | null;
  food: Food | null;
  name: string;
  gramsText: string;
  // The grams the row started with, to tell whether the weight was edited
  originalGrams: number | null;
  quantity: number | null;
  unit: string | null;
  note: string;
  alternatives: Food[];
  warning?: string;
};

let rowCounter = 0;
const newKey = () => `row-${rowCounter++}`;

type Initial = {
  id?: string;
  name: string;
  servings: number;
  cookedWeightG: number | null;
  tags: string[];
  method: string;
  sourceUrl: string | null;
  slots: Slot[];
  preference: RecipePreference;
  rows: Row[];
  warnings: string[];
  siteKcal: number | null;
};

function fromRecipe(r: Recipe): Initial {
  return {
    id: r.id,
    name: r.name,
    servings: r.servings,
    cookedWeightG: r.cookedWeightG,
    tags: r.tags,
    method: r.method,
    sourceUrl: r.sourceUrl,
    slots: r.slots,
    preference: r.preference,
    warnings: [],
    siteKcal: null,
    rows: r.ingredients.map((i) => ({
      key: newKey(),
      foodId: i.foodId,
      food: i.food ?? null,
      name: i.name,
      gramsText: String(i.grams),
      originalGrams: i.grams,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note ?? '',
      alternatives: [],
    })),
  };
}

function fromDraft(d: Draft): Initial {
  return {
    name: d.name,
    servings: d.servings,
    cookedWeightG: d.cookedWeightG,
    tags: d.tags,
    method: d.method,
    sourceUrl: d.sourceUrl,
    slots: d.slots ?? ['lunch', 'dinner'],
    preference: 'neutral',
    warnings: d.warnings ?? [],
    siteKcal: d.siteNutrition?.kcal ?? null,
    rows: d.ingredients.map((i) => ({
      key: newKey(),
      foodId: i.foodId,
      food: i.food ?? null,
      name: i.name,
      gramsText: i.grams > 0 ? String(i.grams) : '',
      originalGrams: i.grams > 0 ? i.grams : null,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note ?? '',
      alternatives: i.alternatives ?? [],
      warning: i.warning,
    })),
  };
}

const blank: Initial = {
  name: '',
  servings: 4,
  cookedWeightG: null,
  tags: [],
  method: '',
  sourceUrl: null,
  slots: ['lunch', 'dinner'],
  preference: 'neutral',
  rows: [],
  warnings: [],
  siteKcal: null,
};

export default function EditRecipeScreen() {
  const { id, draft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  const existing = useRecipe(id ?? '');
  // The draft is taken once, so going back and forward doesn't resurrect it
  const [initial] = useState<Initial | null>(() => {
    if (draft) {
      const d = takeDraft();
      return d ? fromDraft(d) : blank;
    }
    return id ? null : blank;
  });

  if (initial) return <Editor initial={initial} title={draft ? 'Review import' : 'New recipe'} />;
  if (existing.isPending) return <Loading />;
  if (!existing.data) return <ErrorText error={existing.error ?? 'This recipe no longer exists.'} />;
  return <Editor initial={fromRecipe(existing.data)} title="Edit recipe" />;
}

function Editor({ initial, title }: { initial: Initial; title: string }) {
  const [name, setName] = useState(initial.name);
  const [servingsText, setServingsText] = useState(String(initial.servings));
  const [cookedText, setCookedText] = useState(initial.cookedWeightG ? String(initial.cookedWeightG) : '');
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [method, setMethod] = useState(initial.method);
  const [slots, setSlots] = useState<Slot[]>(initial.slots);
  const [preference, setPreference] = useState<RecipePreference>(initial.preference);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const create = useCreateRecipe();
  const update = useUpdateRecipe();
  const saving = create.isPending || update.isPending;

  const servings = parseNumber(servingsText);
  const cooked = cookedText.trim() === '' ? null : parseNumber(cookedText);
  const patchRow = (key: string, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  const nutrition = sum(
    rows.flatMap((r) => {
      const g = parseNumber(r.gramsText);
      return r.food && g !== null ? [forGrams(r.food, g)] : [];
    }),
  );
  const perServing = servings && servings > 0 ? forGrams(nutrition, 100 / servings) : null;

  const choose = async (key?: string) => {
    const food = await pickFood();
    if (!food) return;
    if (key) {
      patchRow(key, { food, foodId: food.id, warning: undefined });
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: newKey(),
        foodId: food.id,
        food,
        name: food.name,
        gramsText: String(food.servings[0]?.grams ?? 100),
        originalGrams: null,
        quantity: null,
        unit: null,
        note: '',
        alternatives: [],
      },
    ]);
  };

  const incomplete = rows.some((r) => !r.food);
  const gramsValid = rows.every((r) => {
    const g = parseNumber(r.gramsText);
    return g !== null && g >= 0 && g <= 20000;
  });
  const valid =
    name.trim() !== '' &&
    servings !== null &&
    servings >= 0.5 &&
    servings <= 100 &&
    (cooked === null || (cooked >= 10 && cooked <= 50000)) &&
    rows.every((r) => r.name.trim() !== '') &&
    gramsValid;

  const save = () => {
    if (!valid || servings === null) return;
    const input = {
      name: name.trim(),
      servings,
      method,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      cookedWeightG: cooked,
      slots,
      preference,
      sourceUrl: initial.sourceUrl,
      ingredients: rows.map((r) => {
        const grams = parseNumber(r.gramsText)!;
        // Typing a new weight makes the written amount just grams
        const edited = r.quantity === null || r.originalGrams !== grams;
        return {
          foodId: r.foodId,
          name: r.name.trim(),
          quantity: edited ? grams : r.quantity,
          unit: edited ? 'g' : r.unit,
          grams,
          note: r.note.trim() || null,
        };
      }),
    };
    if (initial.id) {
      update.mutate({ id: initial.id, ...input }, { onSuccess: () => router.back() });
    } else {
      create.mutate(input, {
        onSuccess: (recipe) => router.replace({ pathname: '/recipes/[id]', params: { id: recipe.id } }),
      });
    }
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title }} />
      {initial.warnings.map((w) => (
        <ThemedText key={w} type="small" themeColor="textSecondary">
          {w}
        </ThemedText>
      ))}

      <TextField label="Name" value={name} onChangeText={setName} />
      <View style={styles.row}>
        <TextField label="Servings" value={servingsText} onChangeText={setServingsText} keyboardType="decimal-pad" />
        <TextField label="Cooked weight (g, optional)" value={cookedText} onChangeText={setCookedText} keyboardType="decimal-pad" />
      </View>
      <TextField label="Tags (comma separated)" value={tagsText} onChangeText={setTagsText} autoCapitalize="none" placeholder="dinner, quick" />

      <ThemedText type="smallBold">Suits</ThemedText>
      <ChipRow>
        {SLOTS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={slots.includes(o.value)}
            onPress={() => setSlots((prev) => (prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value]))}
          />
        ))}
      </ChipRow>
      <ThemedText type="small" themeColor="textSecondary">
        The meal planner only suggests this recipe for the meals you pick.
      </ThemedText>
      <ChipRow>
        {(['like', 'neutral', 'dislike'] as const).map((p) => (
          <Chip key={p} label={{ like: 'Like it', neutral: 'It’s OK', dislike: 'Avoid' }[p]} selected={preference === p} onPress={() => setPreference(p)} />
        ))}
      </ChipRow>

      <ThemedText type="smallBold">Per serving</ThemedText>
      {perServing && <NutritionSummary {...perServing} />}
      {initial.siteKcal !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          The website lists {fmt(initial.siteKcal)} kcal per serving. If ours is far off, check the weights below.
        </ThemedText>
      )}
      {incomplete && (
        <ThemedText type="small" themeColor="textSecondary">
          Ingredients without a food don&apos;t count towards the numbers yet.
        </ThemedText>
      )}

      <ThemedText type="smallBold">Ingredients</ThemedText>
      {rows.map((r) => (
        <Card key={r.key}>
          <TextField label="Ingredient" value={r.name} onChangeText={(v) => patchRow(r.key, { name: v })} />
          <Pressable onPress={() => choose(r.key)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="textSecondary">
              Food
            </ThemedText>
            <ThemedText type={r.food ? 'default' : 'linkPrimary'} numberOfLines={2}>
              {r.food ? `${r.food.name}${r.food.brand ? ` (${r.food.brand})` : ''}` : 'Choose a food'}
            </ThemedText>
          </Pressable>
          {r.alternatives.length > 0 && (
            <ChipRow>
              {r.alternatives.map((f) => (
                <Chip
                  key={f.id}
                  label={f.name.length > 28 ? `${f.name.slice(0, 27)}…` : f.name}
                  selected={r.foodId === f.id}
                  onPress={() => patchRow(r.key, { food: f, foodId: f.id, warning: undefined })}
                />
              ))}
            </ChipRow>
          )}
          <View style={styles.row}>
            <TextField label="Grams" value={r.gramsText} onChangeText={(v) => patchRow(r.key, { gramsText: v })} keyboardType="decimal-pad" />
            <TextField label="Note" value={r.note} onChangeText={(v) => patchRow(r.key, { note: v })} placeholder="chopped" />
          </View>
          {r.quantity !== null && r.unit !== null && r.unit !== 'g' && (
            <ThemedText type="small" themeColor="textSecondary">
              Written as {fmt(r.quantity)} {r.unit}
            </ThemedText>
          )}
          {r.warning && (
            <ThemedText type="small" themeColor="textSecondary">
              {r.warning}
            </ThemedText>
          )}
          <Pressable onPress={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Remove
            </ThemedText>
          </Pressable>
        </Card>
      ))}
      <Button title="+ Add ingredient" variant="secondary" onPress={() => choose()} />

      <TextField label="Method" value={method} onChangeText={setMethod} multiline style={styles.method} />

      <ErrorText error={create.error ?? update.error} />
      <Button title="Save recipe" onPress={save} disabled={!valid} loading={saving} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  method: { minHeight: 140, textAlignVertical: 'top' },
  pressed: { opacity: 0.6 },
});
