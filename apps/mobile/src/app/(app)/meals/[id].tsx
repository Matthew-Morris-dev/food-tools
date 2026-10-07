import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt, slotLabel, sum } from '@/lib/nutrition';
import { useDeleteSavedMeal, useLogSavedMeal, useRenameSavedMeal, useSavedMeals } from '@/lib/queries';
import type { SavedMeal, Slot } from '@/lib/types';

export default function MealScreen() {
  const params = useLocalSearchParams<{ id: string; date: string; slot: Slot }>();
  const { data, isPending, error } = useSavedMeals();
  const meal = data?.find((m) => m.id === params.id);

  if (isPending) return <Loading />;
  if (!meal) return <ErrorText error={error ?? 'This meal no longer exists.'} />;
  return <MealDetail meal={meal} date={params.date} initialSlot={params.slot} />;
}

function MealDetail({ meal, date, initialSlot }: { meal: SavedMeal; date: string; initialSlot: Slot }) {
  const [slot, setSlot] = useState(initialSlot);
  const [name, setName] = useState(meal.name);
  const log = useLogSavedMeal();
  const rename = useRenameSavedMeal();
  const remove = useDeleteSavedMeal();

  const renamed = name.trim() !== '' && name.trim() !== meal.name;

  return (
    <FormScreen>
      <View style={styles.nameRow}>
        <TextField label="Name" value={name} onChangeText={setName} />
        {renamed && (
          <Button
            title="Rename"
            variant="secondary"
            onPress={() => rename.mutate({ id: meal.id, name: name.trim() })}
            loading={rename.isPending}
          />
        )}
      </View>

      <View>
        {meal.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemText}>
              <ThemedText numberOfLines={1}>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[item.brand, item.grams === null ? 'Quick add' : `${fmt(item.grams)} g`].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {fmt(item.kcal)} kcal
            </ThemedText>
          </View>
        ))}
      </View>

      <NutritionSummary {...sum(meal.items)} />

      <SlotPicker value={slot} onChange={setSlot} />
      <ErrorText error={log.error ?? rename.error ?? remove.error} />
      <Button
        title={`Add to ${slotLabel(slot)}`}
        onPress={() => log.mutate({ id: meal.id, date, slot }, { onSuccess: () => router.dismissTo('/') })}
        loading={log.isPending}
      />
      <Button
        title="Delete meal"
        variant="secondary"
        onPress={() => remove.mutate(meal.id, { onSuccess: () => router.back() })}
        loading={remove.isPending}
      />
      <ThemedText type="small" themeColor="textSecondary">
        To change what&apos;s in a meal, log it, adjust the entries, then save it again from Today.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  itemText: { flex: 1, gap: Spacing.half },
});
