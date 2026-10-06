import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt, forGrams, parseNumber, slotLabel } from '@/lib/nutrition';
import { useFood, useLogFood } from '@/lib/queries';
import type { Food, Slot } from '@/lib/types';

const SOURCE_NOTE: Record<Food['source'], string> = {
  cofid: "UK government data (McCance and Widdowson's CoFID).",
  off: 'Data from Open Food Facts, a free, crowd-sourced database. Check it matches the label.',
  custom: 'Your own food.',
};

export default function FoodScreen() {
  const params = useLocalSearchParams<{ id: string; date: string; slot: Slot }>();
  const { data: food, isPending, error } = useFood(params.id);

  if (isPending) return <Loading />;
  if (!food) return <ErrorText error={error} />;
  return <FoodDetail food={food} date={params.date} initialSlot={params.slot} />;
}

function FoodDetail({ food, date, initialSlot }: { food: Food; date: string; initialSlot: Slot }) {
  const [slot, setSlot] = useState(initialSlot);
  const [gramsText, setGramsText] = useState(String(food.servings[0]?.grams ?? 100));
  const grams = parseNumber(gramsText);
  const valid = grams !== null && grams > 0 && grams <= 5000;
  const logFood = useLogFood();

  const add = () => {
    if (!valid) return;
    logFood.mutate({ date, slot, foodId: food.id, grams }, { onSuccess: () => router.dismissTo('/') });
  };

  const amounts = [...food.servings, { label: '100 g', grams: 100 }];

  return (
    <FormScreen>
      <Stack.Screen options={{ title: food.brand ?? 'Food' }} />
      <ThemedText type="smallBold" style={styles.name}>
        {food.name}
      </ThemedText>

      <TextField label="Amount (g)" value={gramsText} onChangeText={setGramsText} keyboardType="decimal-pad" selectTextOnFocus />
      <ChipRow>
        {amounts.map((a) => (
          <Chip
            key={a.label}
            label={a.label === '100 g' ? a.label : `${a.label} (${fmt(a.grams)} g)`}
            selected={grams === a.grams}
            onPress={() => setGramsText(String(a.grams))}
          />
        ))}
      </ChipRow>

      <NutritionSummary {...forGrams(food, valid ? grams : 0)} />

      <SlotPicker value={slot} onChange={setSlot} />
      <ErrorText error={logFood.error} />
      <Button title={`Add to ${slotLabel(slot)}`} onPress={add} disabled={!valid} loading={logFood.isPending} />

      <Per100g food={food} />
      <ThemedText type="small" themeColor="textSecondary">
        {SOURCE_NOTE[food.source]}
      </ThemedText>
    </FormScreen>
  );
}

// UK label order
function Per100g({ food }: { food: Food }) {
  const rows: [string, number | null, string][] = [
    ['Energy', food.kcal, 'kcal'],
    ['Fat', food.fat, 'g'],
    ['of which saturates', food.saturates, 'g'],
    ['Carbohydrate', food.carbs, 'g'],
    ['of which sugars', food.sugars, 'g'],
    ['Fibre', food.fibre, 'g'],
    ['Protein', food.protein, 'g'],
    ['Salt', food.salt, 'g'],
  ];
  return (
    <Card>
      <ThemedText type="smallBold">Per 100 g</ThemedText>
      {rows.map(([label, value, unit]) => (
        <View key={label} style={styles.nutrientRow}>
          <ThemedText type="small" themeColor={label.startsWith('of which') ? 'textSecondary' : 'text'}>
            {label}
          </ThemedText>
          <ThemedText type="small">{value === null ? '–' : `${fmt(value)} ${unit}`}</ThemedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, lineHeight: 24 },
  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
});
