import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, dayLabel, today, weekLabel, weekStart } from '@/lib/dates';
import { fmt, SLOTS } from '@/lib/nutrition';
import { useFitPlanDay, usePlan } from '@/lib/queries';
import type { PlanDay, PlanEntry, Slot } from '@/lib/types';

export default function PlanScreen() {
  const [anchor, setAnchor] = useState(today());
  const start = weekStart(anchor);
  const { data, isPending, error } = usePlan(anchor);
  const thisWeek = start === weekStart(today());

  return (
    <Screen title="Plan">
      <View style={styles.weekRow}>
        <Pressable accessibilityLabel="Previous week" onPress={() => setAnchor(addDays(start, -7))} hitSlop={12}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <Pressable onPress={() => setAnchor(today())}>
          <ThemedText type="smallBold">{thisWeek ? 'This week' : weekLabel(start)}</ThemedText>
          {thisWeek && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {weekLabel(start)}
            </ThemedText>
          )}
        </Pressable>
        <Pressable accessibilityLabel="Next week" onPress={() => setAnchor(addDays(start, 7))} hitSlop={12}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button title="Auto-fill week" style={styles.action} onPress={() => router.push({ pathname: '/plan/autofill', params: { anchor } })} />
        <Button title="Templates" variant="secondary" style={styles.action} onPress={() => router.push({ pathname: '/plan/templates', params: { anchor } })} />
      </View>

      <ErrorText error={error} />
      {isPending ? <Loading /> : data?.days.map((day) => <DayCard key={day.date} day={day} weekAnchor={anchor} />)}
    </Screen>
  );
}

function DayCard({ day, weekAnchor }: { day: PlanDay; weekAnchor: string }) {
  const fit = useFitPlanDay();
  const [note, setNote] = useState<string | null>(null);
  const target = day.targets?.kcal ?? null;
  const add = (slot: Slot) => router.push({ pathname: '/plan/add', params: { date: day.date, slot } });
  const hasPlanned = day.entries.some((e) => !e.confirmed);

  const doFit = () =>
    fit.mutate(day.date, {
      onSuccess: (res) => setNote(res.clamped ? 'Closest possible within the limits. Add or remove a meal to get nearer.' : null),
    });

  return (
    <Card>
      <View style={styles.dayHeader}>
        <ThemedText type="smallBold">{dayLabel(day.date)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {fmt(day.totals.kcal)}
          {target !== null && ` / ${fmt(target)}`} kcal
        </ThemedText>
      </View>
      {target !== null && <ProgressBar value={day.totals.kcal} target={target} />}

      {SLOTS.map(({ value, label }) => {
        const entries = day.entries.filter((e) => e.slot === value);
        return (
          <View key={value} style={styles.slot}>
            <View style={styles.slotHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
              <Pressable onPress={() => add(value)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  + Add
                </ThemedText>
              </Pressable>
            </View>
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onPress={() => router.push({ pathname: '/plan/entry/[id]', params: { id: e.id, date: e.date, anchor: weekAnchor } })} />
            ))}
          </View>
        );
      })}

      {hasPlanned && target !== null && (
        <Pressable onPress={doFit} disabled={fit.isPending} hitSlop={8}>
          <ThemedText type="linkPrimary">{fit.isPending ? 'Fitting…' : 'Fit to target'}</ThemedText>
        </Pressable>
      )}
      {note && (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      )}
      <ErrorText error={fit.error} />
      {day.entries.length > 0 && day.targets === null && (
        <ThemedText type="small" themeColor="textSecondary">
          Set a goal to see targets for this day.
        </ThemedText>
      )}
      {day.entries.length === 0 && (
        <Button title="Add a meal" variant="secondary" onPress={() => add('dinner')} />
      )}
    </Card>
  );
}

function EntryRow({ entry, onPress }: { entry: PlanEntry; onPress: () => void }) {
  const amount = entry.recipeId ? `${fmt(entry.servings ?? 0)} ${entry.servings === 1 ? 'serving' : 'servings'}` : `${fmt(entry.grams ?? 0)} g`;
  const tags = [
    entry.leftoverOfId ? 'Leftovers' : null,
    entry.locked ? 'Locked' : null,
    entry.incomplete ? 'Incomplete recipe' : null,
    entry.warnings.length ? `Contains ${entry.warnings.join(', ')}` : null,
  ].filter(Boolean);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
      <View style={styles.entryText}>
        <ThemedText numberOfLines={1} themeColor={entry.confirmed ? 'textSecondary' : 'text'}>
          {entry.confirmed ? '✓ ' : ''}
          {entry.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {[amount, ...tags].join(' · ')}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {fmt(entry.macros.kcal)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slot: { gap: Spacing.half },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  entryText: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.6 },
});
