import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Placeholder, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chip, ErrorText, Loading } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { addDays, dayLabel, today } from '@/lib/dates';
import { fmt, SLOTS, slotForNow, sum } from '@/lib/nutrition';
import { useDayLog, useDayTargets, useSetTrainingDay } from '@/lib/queries';
import type { LogEntry, Slot } from '@/lib/types';

export default function TodayScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const initial = session?.user.name.trim().charAt(0).toUpperCase() || '?';
  const [date, setDate] = useState(today);
  const { data: entries, isPending, error } = useDayLog(date);
  const { data: day } = useDayTargets(date);
  const setTrainingDay = useSetTrainingDay();

  const add = (slot: Slot) => router.push({ pathname: '/log/add', params: { date, slot } });
  const totals = sum(entries ?? []);

  return (
    <Screen
      title="Today"
      headerRight={
        <Link href="/settings" asChild>
          <Pressable accessibilityLabel="Settings">
            <ThemedView type="backgroundSelected" style={styles.avatar}>
              <ThemedText type="smallBold">{initial}</ThemedText>
            </ThemedView>
          </Pressable>
        </Link>
      }
      overlay={
        <Pressable
          accessibilityLabel="Log food"
          onPress={() => add(slotForNow())}
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.text }, pressed && styles.pressed]}>
          <ThemedText style={[styles.fabText, { color: theme.background }]}>+</ThemedText>
        </Pressable>
      }>
      <View style={styles.dateRow}>
        <Pressable accessibilityLabel="Previous day" onPress={() => setDate(addDays(date, -1))} hitSlop={12}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <Pressable onPress={() => setDate(today())}>
          <ThemedText type="smallBold">{dayLabel(date)}</ThemedText>
        </Pressable>
        <Pressable accessibilityLabel="Next day" onPress={() => setDate(addDays(date, 1))} hitSlop={12}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </View>

      {day?.hasSchedule && (
        <View style={styles.chipRow}>
          <Chip
            label={day.trainingDay ? 'Training day' : 'Rest day'}
            selected={day.trainingDay}
            onPress={() => setTrainingDay.mutate({ date, trainingDay: !day.trainingDay })}
          />
        </View>
      )}

      <Card>
        {day ? (
          <>
            <ThemedText type="subtitle">
              {fmt(totals.kcal)} <ThemedText type="small" themeColor="textSecondary">{`/ ${fmt(day.targets.kcal)} kcal`}</ThemedText>
            </ThemedText>
            <ProgressBar value={totals.kcal} target={day.targets.kcal} />
            <ThemedText type="small" themeColor="textSecondary">
              {totals.kcal > day.targets.kcal
                ? `${fmt(totals.kcal - day.targets.kcal)} kcal above target`
                : `${fmt(day.targets.kcal - totals.kcal)} kcal left`}
            </ThemedText>
            <View style={styles.macros}>
              <Macro label="Protein" grams={totals.protein} target={day.targets.protein} />
              <Macro label="Carbs" grams={totals.carbs} target={day.targets.carbs} />
              <Macro label="Fat" grams={totals.fat} target={day.targets.fat} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="subtitle">{fmt(totals.kcal)} kcal</ThemedText>
            <View style={styles.macros}>
              <Macro label="Protein" grams={totals.protein} />
              <Macro label="Carbs" grams={totals.carbs} />
              <Macro label="Fat" grams={totals.fat} />
            </View>
            <Link href="/goal/setup">
              <ThemedText type="linkPrimary">Set a goal to see daily targets</ThemedText>
            </Link>
          </>
        )}
      </Card>

      <ErrorText error={error} />
      {isPending ? (
        <Loading />
      ) : (
        SLOTS.map(({ value, label }) => (
          <SlotSection
            key={value}
            label={label}
            entries={(entries ?? []).filter((e) => e.slot === value)}
            onAdd={() => add(value)}
            onSave={() => router.push({ pathname: '/meals/new', params: { date, slot: value } })}
          />
        ))
      )}
      {entries?.length === 0 && <Placeholder>Nothing logged yet. Tap + to add food.</Placeholder>}
    </Screen>
  );
}

// Neutral colours throughout: going over a target is information, not an error
function ProgressBar({ value, target }: { value: number; target: number }) {
  const theme = useTheme();
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.text }]} />
    </View>
  );
}

function Macro({ label, grams, target }: { label: string; grams: number; target?: number }) {
  return (
    <View>
      <ThemedText type="smallBold">{target === undefined ? `${fmt(grams)} g` : `${fmt(grams)} / ${fmt(target)} g`}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

type SlotSectionProps = { label: string; entries: LogEntry[]; onAdd: () => void; onSave: () => void };

function SlotSection({ label, entries, onAdd, onSave }: SlotSectionProps) {
  const kcal = sum(entries).kcal;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">
          {label}
          {entries.length > 0 && <ThemedText type="small" themeColor="textSecondary">{`  ${fmt(kcal)} kcal`}</ThemedText>}
        </ThemedText>
        <View style={styles.sectionActions}>
          {entries.length > 0 && (
            <Pressable onPress={onSave} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Save meal
              </ThemedText>
            </Pressable>
          )}
          <Pressable onPress={onAdd} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              + Add
            </ThemedText>
          </Pressable>
        </View>
      </View>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() => router.push({ pathname: '/log/entry/[id]', params: { id: entry.id, date: entry.date } })}
          style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
          <View style={styles.entryText}>
            <ThemedText numberOfLines={1}>{entry.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {[entry.brand, entry.grams === null ? null : `${fmt(entry.grams)} g`].filter(Boolean).join(' · ') ||
                `P ${fmt(entry.protein)} · C ${fmt(entry.carbs)} · F ${fmt(entry.fat)}`}
            </ThemedText>
          </View>
          <ThemedText type="small">{fmt(entry.kcal)}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  macros: { flexDirection: 'row', gap: Spacing.five },
  chipRow: { flexDirection: 'row' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  section: { gap: Spacing.one },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionActions: { flexDirection: 'row', gap: Spacing.four },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  entryText: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.6 },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    // iOS tabs float over content; on Android and web the tab bar sits outside it
    bottom: Spacing.four + (Platform.OS === 'ios' ? BottomTabInset : 0),
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { fontSize: 30, lineHeight: 34, fontWeight: 400 },
});
