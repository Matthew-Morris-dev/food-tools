import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { today } from '@/lib/dates';
import { fmt, parseNumber, slotForNow, slotLabel } from '@/lib/nutrition';
import { useDeleteRecipe, useLogRecipe, useRecipe } from '@/lib/queries';
import type { Recipe, RecipeIngredient, Slot } from '@/lib/types';

export default function RecipeScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string; slot?: Slot }>();
  const { data, isPending, error } = useRecipe(params.id);
  if (isPending) return <Loading />;
  if (!data) return <ErrorText error={error ?? 'This recipe no longer exists.'} />;
  return <RecipeDetail recipe={data} date={params.date ?? today()} initialSlot={params.slot ?? slotForNow()} />;
}

function amount(ing: RecipeIngredient, scale: number) {
  const grams = `${fmt(ing.grams * scale)} g`;
  if (ing.quantity === null || ing.unit === 'g') return grams;
  return `${fmt(ing.quantity * scale)}${ing.unit ? ` ${ing.unit}` : ''} (${grams})`;
}

function RecipeDetail({ recipe, date, initialSlot }: { recipe: Recipe; date: string; initialSlot: Slot }) {
  const [slot, setSlot] = useState(initialSlot);
  const [by, setBy] = useState<'servings' | 'grams'>('servings');
  const [servingsText, setServingsText] = useState('1');
  const [gramsText, setGramsText] = useState(
    recipe.cookedWeightG ? String(Math.round(recipe.cookedWeightG / recipe.servings)) : '',
  );
  const [makeFor, setMakeFor] = useState(recipe.servings);
  const log = useLogRecipe();
  const remove = useDeleteRecipe();

  const servings = parseNumber(servingsText);
  const grams = parseNumber(gramsText);
  const valid = by === 'servings' ? servings !== null && servings >= 0.1 && servings <= 100 : grams !== null && grams >= 1;
  const scale = makeFor / recipe.servings;

  const add = () => {
    if (!valid) return;
    const amountBody = by === 'servings' ? { servings: servings! } : { grams: grams! };
    log.mutate({ id: recipe.id, date, slot, ...amountBody }, { onSuccess: () => router.dismissTo('/') });
  };

  return (
    <FormScreen>
      <ThemedText type="subtitle">{recipe.name}</ThemedText>
      {recipe.tags.length > 0 && (
        <ChipRow>
          {recipe.tags.map((t) => (
            <Chip key={t} label={t} onPress={() => {}} />
          ))}
        </ChipRow>
      )}

      <ThemedText type="smallBold">Per serving</ThemedText>
      <NutritionSummary {...recipe.perServing} />
      {recipe.per100gCooked && (
        <ThemedText type="small" themeColor="textSecondary">
          {fmt(recipe.per100gCooked.kcal)} kcal per 100 g of the cooked dish
        </ThemedText>
      )}
      {recipe.incomplete && (
        <ThemedText type="small" themeColor="textSecondary">
          Some ingredients have no food chosen yet, so these numbers are too low. Edit the recipe to match them.
        </ThemedText>
      )}

      <Card>
        <ThemedText type="smallBold">Log this</ThemedText>
        {recipe.cookedWeightG && (
          <ChipRow>
            <Chip label="Servings" selected={by === 'servings'} onPress={() => setBy('servings')} />
            <Chip label="Grams" selected={by === 'grams'} onPress={() => setBy('grams')} />
          </ChipRow>
        )}
        {by === 'servings' ? (
          <TextField label="Servings" value={servingsText} onChangeText={setServingsText} keyboardType="decimal-pad" selectTextOnFocus />
        ) : (
          <TextField label="Grams of the cooked dish" value={gramsText} onChangeText={setGramsText} keyboardType="decimal-pad" selectTextOnFocus />
        )}
        <SlotPicker value={slot} onChange={setSlot} />
        <ErrorText error={log.error} />
        <Button title={`Add to ${slotLabel(slot)}`} onPress={add} disabled={!valid} loading={log.isPending} />
      </Card>

      <View style={styles.ingredientsHeader}>
        <ThemedText type="smallBold">Ingredients</ThemedText>
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Fewer servings" hitSlop={10} onPress={() => setMakeFor(Math.max(1, makeFor - 1))}>
            <ThemedText type="subtitle">−</ThemedText>
          </Pressable>
          <ThemedText type="small">For {fmt(makeFor)}</ThemedText>
          <Pressable accessibilityLabel="More servings" hitSlop={10} onPress={() => setMakeFor(makeFor + 1)}>
            <ThemedText type="subtitle">+</ThemedText>
          </Pressable>
        </View>
      </View>
      <View>
        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={styles.ingredient}>
            <View style={styles.ingredientText}>
              <ThemedText>{ing.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[amount(ing, scale), ing.note, ing.food ? null : 'No food chosen'].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {fmt((ing.kcal ?? 0) * scale)} kcal
            </ThemedText>
          </View>
        ))}
      </View>

      {recipe.method.trim() !== '' && (
        <View style={styles.method}>
          <ThemedText type="smallBold">Method</ThemedText>
          <ThemedText>{recipe.method}</ThemedText>
        </View>
      )}

      {recipe.sourceUrl && (
        <Pressable onPress={() => Linking.openURL(recipe.sourceUrl!)}>
          <ThemedText type="linkPrimary" numberOfLines={1}>
            Source: {recipe.sourceUrl}
          </ThemedText>
        </Pressable>
      )}

      <Button title="Edit recipe" variant="secondary" onPress={() => router.push({ pathname: '/recipes/edit', params: { id: recipe.id } })} />
      <ErrorText error={remove.error} />
      <Button
        title="Delete recipe"
        variant="secondary"
        loading={remove.isPending}
        onPress={() => remove.mutate(recipe.id, { onSuccess: () => router.dismissTo('/recipes') })}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  ingredientsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  ingredientText: { flex: 1, gap: Spacing.half },
  method: { gap: Spacing.one },
});
