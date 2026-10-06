import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { parseNumber } from '@/lib/nutrition';
import { useDayLog, useDeleteEntry, useUpdateEntry } from '@/lib/queries';
import type { LogEntry } from '@/lib/types';

export default function EntryScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const { data, isPending, error } = useDayLog(date);
  const entry = data?.find((e) => e.id === id);

  if (isPending) return <Loading />;
  if (!entry) return <ErrorText error={error ?? 'This entry no longer exists.'} />;
  return <EntryEditor entry={entry} />;
}

function EntryEditor({ entry }: { entry: LogEntry }) {
  const [slot, setSlot] = useState(entry.slot);
  const [gramsText, setGramsText] = useState(entry.grams === null ? '' : String(entry.grams));
  const grams = parseNumber(gramsText);
  const update = useUpdateEntry();
  const remove = useDeleteEntry();

  const hasGrams = entry.grams !== null && entry.grams > 0;
  const valid = !hasGrams || (grams !== null && grams > 0 && grams <= 5000);
  // Preview scales the logged snapshot, the same way the server will
  const scale = hasGrams && valid && grams !== null ? grams / entry.grams! : 1;

  const save = () =>
    update.mutate(
      { id: entry.id, slot, ...(hasGrams && grams !== null ? { grams } : {}) },
      { onSuccess: () => router.back() },
    );

  return (
    <FormScreen>
      <ThemedText type="smallBold" style={styles.name}>
        {entry.name}
      </ThemedText>
      {entry.brand && (
        <ThemedText type="small" themeColor="textSecondary">
          {entry.brand}
        </ThemedText>
      )}
      {hasGrams && (
        <TextField label="Amount (g)" value={gramsText} onChangeText={setGramsText} keyboardType="decimal-pad" selectTextOnFocus />
      )}
      <NutritionSummary
        kcal={entry.kcal * scale}
        protein={entry.protein * scale}
        carbs={entry.carbs * scale}
        fat={entry.fat * scale}
      />
      <SlotPicker value={slot} onChange={setSlot} />
      <ErrorText error={update.error ?? remove.error} />
      <Button title="Save" onPress={save} disabled={!valid} loading={update.isPending} />
      <Button
        title="Delete"
        variant="secondary"
        onPress={() => remove.mutate(entry.id, { onSuccess: () => router.back() })}
        loading={remove.isPending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, lineHeight: 24 },
});
