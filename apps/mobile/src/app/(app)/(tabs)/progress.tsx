import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WeightChart } from '@/components/weight-chart';
import { Button, Card, Chip, ChipRow, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { today } from '@/lib/dates';
import { fmt } from '@/lib/nutrition';
import { useProgress, useUnits } from '@/lib/queries';
import type { CheckIn, ProgressRange } from '@/lib/types';
import { formatWeight, formatWeightChange } from '@/lib/units';

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: '4w', label: '4 weeks' },
  { value: '12w', label: '12 weeks' },
  { value: 'all', label: 'All' },
];

const TYPE_LABEL = { lose: 'Losing weight', maintain: 'Maintaining', gain: 'Gaining weight', build: 'Building muscle' } as const;

export default function ProgressScreen() {
  const { weightUnit } = useUnits();
  const [range, setRange] = useState<ProgressRange>('12w');
  const { data, isPending, error } = useProgress(today(), range);

  return (
    <Screen title="Progress">
      <ErrorText error={error} />
      {isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <CheckInCard checkIn={data.checkIn} />

            <Card>
              <ThemedText type="smallBold">Weight</ThemedText>
              {data.latest ? (
                <>
                  <ThemedText type="subtitle">{formatWeight(data.latest.trendKg, weightUnit)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    7-day trend
                    {data.changeSinceStartKg !== null && ` · ${formatWeightChange(data.changeSinceStartKg, weightUnit)} since you started`}
                  </ThemedText>
                </>
              ) : (
                <ThemedText themeColor="textSecondary">No weigh-ins yet.</ThemedText>
              )}
              <ChipRow>
                {RANGES.map((r) => (
                  <Chip key={r.value} label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />
                ))}
              </ChipRow>
              <WeightChart points={data.weights} unit={weightUnit} />
              <Button title="Log weight" onPress={() => router.push('/weights/log')} />
              <Button title="All weigh-ins" variant="secondary" onPress={() => router.push('/weights')} />
            </Card>

            {data.goal ? (
              <>
                <Card>
                  <ThemedText type="smallBold">Eating</ThemedText>
                  {data.intake ? (
                    <ThemedText>
                      Averaging {fmt(data.intake.avgKcal)} kcal a day against a target of {fmt(data.intake.avgTargetKcal)}
                      <ThemedText type="small" themeColor="textSecondary">{`  (${data.intake.days} ${data.intake.days === 1 ? 'day' : 'days'} logged this week)`}</ThemedText>
                    </ThemedText>
                  ) : (
                    <ThemedText themeColor="textSecondary">Nothing logged in the last 7 days.</ThemedText>
                  )}
                  {data.proteinHitRate && (
                    <ThemedText>
                      Protein target met on {data.proteinHitRate.hit} of {data.proteinHitRate.days} logged{' '}
                      {data.proteinHitRate.days === 1 ? 'day' : 'days'}
                    </ThemedText>
                  )}
                </Card>

                <Card>
                  <ThemedText type="smallBold">{TYPE_LABEL[data.goal.type]}</ThemedText>
                  <ThemedText type="subtitle">{fmt(data.goal.kcal)} kcal</ThemedText>
                  <View style={styles.macros}>
                    {(
                      [
                        ['Protein', data.goal.protein],
                        ['Carbs', data.goal.carbs],
                        ['Fat', data.goal.fat],
                      ] as const
                    ).map(([label, g]) => (
                      <View key={label}>
                        <ThemedText type="smallBold">{fmt(g)} g</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {label}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                  {data.goal.targetWeightKg !== null && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Target weight {formatWeight(data.goal.targetWeightKg, weightUnit)}
                    </ThemedText>
                  )}
                  <Button title="Edit goal" variant="secondary" onPress={() => router.push('/goal/setup')} />
                </Card>
              </>
            ) : (
              <Card>
                <ThemedText type="smallBold">No goal yet</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Set a goal to get daily calorie and macro targets, and a weekly check-in.
                </ThemedText>
                <Button title="Set a goal" onPress={() => router.push('/goal/setup')} />
              </Card>
            )}

            <Link href="/support">
              <ThemedText type="small" themeColor="textSecondary">
                Support with food and eating
              </ThemedText>
            </Link>
          </>
        )
      )}
    </Screen>
  );
}

function CheckInCard({ checkIn }: { checkIn: CheckIn }) {
  if (checkIn.status === 'on_track' || checkIn.status === 'adjust') {
    return (
      <Card>
        <ThemedText type="smallBold">Weekly check-in</ThemedText>
        <ThemedText>
          {checkIn.status === 'adjust'
            ? 'Your weight trend suggests a small change to your targets.'
            : 'Your weight trend is in line with your plan.'}
        </ThemedText>
        <Button title="Review" onPress={() => router.push('/check-in')} />
      </Card>
    );
  }
  if (checkIn.status === 'insufficient') {
    return (
      <Card>
        <ThemedText type="smallBold">Weekly check-in</ThemedText>
        <ThemedText themeColor="textSecondary">{checkIn.message}</ThemedText>
      </Card>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  macros: { flexDirection: 'row', gap: Spacing.five },
});
