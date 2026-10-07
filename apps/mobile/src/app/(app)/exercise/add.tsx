import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipRow, ErrorText, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ACTIVITIES, fmt, parseNumber } from '@/lib/nutrition';
import { useAddExercise, useExerciseEstimate } from '@/lib/queries';
import type { ExerciseActivity } from '@/lib/types';

export default function AddExerciseScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [activity, setActivity] = useState<ExerciseActivity>('walking');
  const [minutesText, setMinutesText] = useState('30');
  const [kcalText, setKcalText] = useState('');
  const add = useAddExercise();

  const minutes = parseNumber(minutesText);
  const estimate = useExerciseEstimate(date, activity, minutes);
  const kcalOverride = parseNumber(kcalText);
  const estimated = estimate.data?.kcal ?? null;
  const needsKcal = activity === 'other' || estimated === null;
  const validMinutes = minutes !== null && Number.isInteger(minutes) && minutes > 0 && minutes <= 600;
  const valid = validMinutes && (kcalOverride !== null ? kcalOverride >= 0 : !needsKcal);

  const save = () => {
    if (!validMinutes) return;
    add.mutate(
      { date, activity, minutes, ...(kcalOverride !== null ? { kcal: kcalOverride } : {}) },
      { onSuccess: () => router.dismissTo('/') },
    );
  };

  return (
    <FormScreen>
      <ChipRow>
        {ACTIVITIES.map((a) => (
          <Chip key={a.value} label={a.label} selected={activity === a.value} onPress={() => setActivity(a.value)} />
        ))}
      </ChipRow>

      <View style={styles.row}>
        <TextField label="Minutes" value={minutesText} onChangeText={setMinutesText} keyboardType="number-pad" />
        <TextField
          label="Calories burned"
          value={kcalText}
          onChangeText={setKcalText}
          keyboardType="decimal-pad"
          placeholder={estimated === null ? 'Enter' : String(estimated)}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {activity === 'other'
          ? 'Enter the calories from your watch or machine.'
          : estimated === null
            ? 'Log a weigh-in to get an estimate, or enter the calories yourself.'
            : `Estimated ${fmt(estimated)} kcal above resting for your weight. Enter your own number if you have one from a watch.`}
      </ThemedText>

      <ErrorText error={add.error} />
      <Button title="Add exercise" onPress={save} disabled={!valid} loading={add.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
