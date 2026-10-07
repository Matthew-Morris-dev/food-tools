import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayLabel } from '@/lib/dates';
import { useUnits, useWeights } from '@/lib/queries';
import { formatWeight } from '@/lib/units';

export default function WeightsScreen() {
  const { weightUnit } = useUnits();
  const { data, isPending, error } = useWeights();
  const newestFirst = [...(data ?? [])].reverse();

  return (
    <FormScreen>
      <Button title="Log weight" onPress={() => router.push('/weights/log')} />
      <ErrorText error={error} />
      {isPending ? (
        <Loading />
      ) : newestFirst.length === 0 ? (
        <ThemedText themeColor="textSecondary">No weigh-ins yet.</ThemedText>
      ) : (
        <View>
          {newestFirst.map((w) => (
            <Pressable
              key={w.date}
              onPress={() => router.push({ pathname: '/weights/log', params: { date: w.date } })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <ThemedText>{dayLabel(w.date)}</ThemedText>
              <View style={styles.values}>
                <ThemedText>{formatWeight(w.weightKg, weightUnit)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  trend {formatWeight(w.trendKg, weightUnit)}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two + 2 },
  values: { alignItems: 'flex-end', gap: Spacing.half },
  pressed: { opacity: 0.6 },
});
