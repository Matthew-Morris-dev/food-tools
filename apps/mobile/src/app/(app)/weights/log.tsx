import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { WeightInput } from '@/components/unit-inputs';
import { Button, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, dayLabel, today } from '@/lib/dates';
import { useDeleteWeight, useSaveWeight, useUnits, useWeights } from '@/lib/queries';
import type { WeightPoint } from '@/lib/types';

export default function LogWeightScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const weights = useWeights();
  if (weights.isPending) return <Loading />;
  return <LogWeightForm initialDate={params.date ?? today()} weights={weights.data ?? []} />;
}

function LogWeightForm({ initialDate, weights }: { initialDate: string; weights: WeightPoint[] }) {
  const { weightUnit } = useUnits();
  const [date, setDate] = useState(initialDate);
  const existing = weights.find((w) => w.date === date);
  // Start from the nearest earlier weigh-in so the number is close to right
  const previous = [...weights].reverse().find((w) => w.date <= date);
  const [kg, setKg] = useState<number | null>(existing?.weightKg ?? previous?.weightKg ?? null);
  const save = useSaveWeight();
  const remove = useDeleteWeight();

  const change = (next: string) => {
    setDate(next);
    const match = weights.find((w) => w.date === next);
    setKg(match?.weightKg ?? previous?.weightKg ?? null);
  };

  const valid = kg !== null && kg >= 20 && kg <= 500;

  return (
    <FormScreen>
      <View style={styles.dateRow}>
        <Pressable accessibilityLabel="Previous day" onPress={() => change(addDays(date, -1))} hitSlop={12}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{dayLabel(date)}</ThemedText>
        <Pressable
          accessibilityLabel="Next day"
          onPress={() => date < today() && change(addDays(date, 1))}
          hitSlop={12}
          disabled={date >= today()}>
          <ThemedText type="subtitle" themeColor={date >= today() ? 'textSecondary' : 'text'}>
            ›
          </ThemedText>
        </Pressable>
      </View>

      {/* Remount when the date changes so the boxes show that day's weight */}
      <WeightInput key={`${date}-${weightUnit}`} label="Weight" unit={weightUnit} initialKg={kg} onChangeKg={setKg} />
      <ThemedText type="small" themeColor="textSecondary">
        Weigh at a similar time of day if you can. The trend smooths out day-to-day swings.
      </ThemedText>

      <ErrorText error={save.error ?? remove.error} />
      <Button
        title={existing ? 'Update' : 'Save'}
        disabled={!valid}
        loading={save.isPending}
        onPress={() => kg !== null && save.mutate({ date, weightKg: Math.round(kg * 10) / 10 }, { onSuccess: () => router.back() })}
      />
      {existing && (
        <Button
          title="Delete"
          variant="secondary"
          loading={remove.isPending}
          onPress={() => remove.mutate(date, { onSuccess: () => router.back() })}
        />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
});
