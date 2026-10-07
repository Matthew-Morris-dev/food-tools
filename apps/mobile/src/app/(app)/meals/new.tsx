import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt, slotLabel } from '@/lib/nutrition';
import { useCreateSavedMeal, useDayLog } from '@/lib/queries';
import type { Slot } from '@/lib/types';

// Saves the entries in one meal slot as a meal to log again later
export default function NewMealScreen() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: Slot }>();
  const { data, isPending, error } = useDayLog(date);
  const entries = (data ?? []).filter((e) => e.slot === slot);
  const [name, setName] = useState(`My ${slotLabel(slot).toLowerCase()}`);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const create = useCreateSavedMeal();

  const selected = entries.filter((e) => !excluded.has(e.id));
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    create.mutate(
      { name: name.trim(), entryIds: selected.map((e) => e.id) },
      { onSuccess: () => router.back() },
    );

  if (isPending) return <Loading />;

  return (
    <FormScreen>
      <ThemedText type="small" themeColor="textSecondary">
        Save these foods as a meal, then log them together in one tap from Add food.
      </ThemedText>
      <TextField label="Name" value={name} onChangeText={setName} selectTextOnFocus />
      <View>
        {entries.map((entry) => {
          const on = !excluded.has(entry.id);
          return (
            <Pressable key={entry.id} onPress={() => toggle(entry.id)} style={styles.row}>
              <ThemedText style={styles.check}>{on ? '☑' : '☐'}</ThemedText>
              <View style={styles.text}>
                <ThemedText themeColor={on ? 'text' : 'textSecondary'} numberOfLines={1}>
                  {entry.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.grams === null ? 'Quick add' : `${fmt(entry.grams)} g`}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {fmt(entry.kcal)} kcal
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ErrorText error={error ?? create.error} />
      <Button
        title="Save meal"
        onPress={save}
        disabled={name.trim() === '' || selected.length === 0}
        loading={create.isPending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  check: { fontSize: 20 },
  text: { flex: 1, gap: Spacing.half },
});
