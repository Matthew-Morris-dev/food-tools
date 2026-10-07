import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayLabel, weekLabel, weekStart } from '@/lib/dates';
import { SLOTS, slotLabel } from '@/lib/nutrition';
import { useAutofillPlan, useDeletePlanEntries } from '@/lib/queries';
import type { Slot } from '@/lib/types';

export default function AutofillScreen() {
  const { anchor } = useLocalSearchParams<{ anchor: string }>();
  const [slots, setSlots] = useState<Slot[]>(['breakfast', 'lunch', 'dinner']);
  const [leftovers, setLeftovers] = useState(true);
  const [replace, setReplace] = useState(false);
  const run = useAutofillPlan();
  const undo = useDeletePlanEntries();
  const [undone, setUndone] = useState(false);

  const toggle = (s: Slot) => setSlots((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const result = run.data;

  return (
    <FormScreen>
      <ThemedText>
        Fills the empty meals for {weekLabel(weekStart(anchor))} from your recipes, aiming each day at its calorie target. It
        only uses recipes that suit the meal, aren&apos;t marked &quot;Avoid&quot;, are complete and fit your diet settings.
      </ThemedText>

      <ThemedText type="smallBold">Meals to fill</ThemedText>
      <ChipRow>
        {SLOTS.map((s) => (
          <Chip key={s.value} label={s.label} selected={slots.includes(s.value)} onPress={() => toggle(s.value)} />
        ))}
      </ChipRow>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <ThemedText>Dinners also cover the next day&apos;s lunch</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Cook once, eat twice, when a recipe makes enough.
          </ThemedText>
        </View>
        <Switch value={leftovers} onValueChange={setLeftovers} />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <ThemedText>Replace what&apos;s already planned</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Clears unlocked meals in those slots first. Logged and locked meals stay. This can&apos;t be undone.
          </ThemedText>
        </View>
        <Switch value={replace} onValueChange={setReplace} />
      </View>

      <ErrorText error={run.error ?? undo.error} />
      <Button
        title="Fill my week"
        disabled={slots.length === 0}
        loading={run.isPending}
        onPress={() => {
          setUndone(false);
          run.mutate({ date: anchor, slots, leftovers, replace });
        }}
      />

      {result && (
        <Card>
          <ThemedText type="smallBold">
            {undone ? 'Undone' : result.added === 0 ? 'Nothing to add' : `Added ${result.added} ${result.added === 1 ? 'meal' : 'meals'}`}
          </ThemedText>
          {!undone && result.added > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {result.leftovers > 0 ? `${result.leftovers} of them are leftovers. ` : ''}
              {result.replaced > 0 ? `${result.replaced} planned meals were replaced. ` : ''}
              Open the Plan tab to adjust, or use &quot;Fit to target&quot; on any day.
            </ThemedText>
          )}
          {result.added === 0 && result.skipped.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Every chosen meal already has something planned.
            </ThemedText>
          )}
          {result.skipped.slice(0, 6).map((s) => (
            <ThemedText key={`${s.date}-${s.slot}`} type="small" themeColor="textSecondary">
              {dayLabel(s.date)} {slotLabel(s.slot).toLowerCase()}: {s.reason}
            </ThemedText>
          ))}
          {result.skipped.length > 6 && (
            <ThemedText type="small" themeColor="textSecondary">
              and {result.skipped.length - 6} more
            </ThemedText>
          )}
          {(result.excluded.incomplete > 0 || result.excluded.disliked > 0 || result.excluded.diet > 0) && (
            <ThemedText type="small" themeColor="textSecondary">
              Left out: {[
                result.excluded.disliked > 0 ? `${result.excluded.disliked} marked Avoid` : null,
                result.excluded.diet > 0 ? `${result.excluded.diet} that break your diet settings` : null,
                result.excluded.incomplete > 0 ? `${result.excluded.incomplete} with ingredients that have no food chosen` : null,
              ]
                .filter(Boolean)
                .join(', ')}
              .
            </ThemedText>
          )}
          {!undone && result.added > 0 && (
            <Button
              title="Undo"
              variant="secondary"
              loading={undo.isPending}
              onPress={() => undo.mutate(result.ids, { onSuccess: () => setUndone(true) })}
            />
          )}
          <Button title="Done" onPress={() => router.back()} />
        </Card>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.half },
});
