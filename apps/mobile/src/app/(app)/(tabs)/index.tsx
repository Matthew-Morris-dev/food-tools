import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Placeholder, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, ErrorText, Loading } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { addDays, dayLabel, today } from '@/lib/dates';
import { fmt, SLOTS, slotForNow, sum } from '@/lib/nutrition';
import { useDayLog } from '@/lib/queries';
import type { LogEntry, Slot } from '@/lib/types';

export default function TodayScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const initial = session?.user.name.trim().charAt(0).toUpperCase() || '?';
  const [date, setDate] = useState(today);
  const { data: entries, isPending, error } = useDayLog(date);

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

      <Card>
        <ThemedText type="subtitle">{fmt(totals.kcal)} kcal</ThemedText>
        <View style={styles.macros}>
          <Macro label="Protein" grams={totals.protein} />
          <Macro label="Carbs" grams={totals.carbs} />
          <Macro label="Fat" grams={totals.fat} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Daily targets will appear here once goals are set up.
        </ThemedText>
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
          />
        ))
      )}
      {entries?.length === 0 && <Placeholder>Nothing logged yet. Tap + to add food.</Placeholder>}
    </Screen>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <View>
      <ThemedText type="smallBold">{fmt(grams)} g</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function SlotSection({ label, entries, onAdd }: { label: string; entries: LogEntry[]; onAdd: () => void }) {
  const kcal = sum(entries).kcal;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">
          {label}
          {entries.length > 0 && <ThemedText type="small" themeColor="textSecondary">{`  ${fmt(kcal)} kcal`}</ThemedText>}
        </ThemedText>
        <Pressable onPress={onAdd} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            + Add
          </ThemedText>
        </Pressable>
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
  section: { gap: Spacing.one },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
