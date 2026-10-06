import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { parseNumber, slotLabel } from '@/lib/nutrition';
import { useQuickAdd } from '@/lib/queries';
import type { Slot } from '@/lib/types';

export default function QuickAddScreen() {
  const params = useLocalSearchParams<{ date: string; slot: Slot }>();
  const [slot, setSlot] = useState(params.slot);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const quickAdd = useQuickAdd();

  const kcalValue = parseNumber(kcal);
  const macros = [protein, carbs, fat].map((t) => parseNumber(t) ?? 0);
  const valid = kcalValue !== null && kcalValue >= 0 && macros.every((m) => m >= 0);

  const add = () => {
    if (!valid) return;
    const [p, c, f] = macros;
    quickAdd.mutate(
      { date: params.date, slot, quick: { name: name.trim() || undefined, kcal: kcalValue, protein: p, carbs: c, fat: f } },
      { onSuccess: () => router.dismissTo('/') },
    );
  };

  return (
    <FormScreen>
      <ThemedText type="small" themeColor="textSecondary">
        For when you know the numbers but not the food, like a meal out.
      </ThemedText>
      <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="Quick add" />
      <TextField label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
      <View style={styles.row}>
        <TextField label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
        <TextField label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
        <TextField label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
      </View>
      <SlotPicker value={slot} onChange={setSlot} />
      <ErrorText error={quickAdd.error} />
      <Button title={`Add to ${slotLabel(slot)}`} onPress={add} disabled={!valid} loading={quickAdd.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
