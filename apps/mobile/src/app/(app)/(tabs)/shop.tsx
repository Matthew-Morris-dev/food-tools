import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ShoppingRow } from '@/components/shopping-item';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { addDays, today, weekLabel, weekStart } from '@/lib/dates';
import {
  useAddShoppingItem,
  useClearTicks,
  useSetItemPref,
  useShopping,
  useTickItem,
  useTickOwnItem,
} from '@/lib/queries';
import type { ShoppingItem } from '@/lib/types';

export default function ShopScreen() {
  const [anchor, setAnchor] = useState(today());
  const start = weekStart(anchor);
  const thisWeek = start === weekStart(today());
  // On the current week, days that have passed are already shopped for
  const [skipPast, setSkipPast] = useState(true);
  const from = thisWeek && skipPast ? today() : undefined;

  const { data, isPending, error } = useShopping(anchor, from);
  const tick = useTickItem();
  const tickOwn = useTickOwnItem();
  const clear = useClearTicks();
  const add = useAddShoppingItem();
  const setPref = useSetItemPref();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPantry, setShowPantry] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [shared, setShared] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const toggle = (item: ShoppingItem) =>
    item.manualId ? tickOwn.mutate({ id: item.manualId, ticked: !item.ticked }) : tick.mutate({ date: anchor, key: item.key, ticked: !item.ticked });

  const share = async () => {
    setShareError(null);
    try {
      const { text } = await api.shoppingText(anchor, from);
      try {
        await Share.share({ message: text });
      } catch {
        // No share sheet here (e.g. the web build): show the text to copy instead
        setShared(text);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Couldn’t make the list');
    }
  };

  const empty = data && data.aisles.length === 0 && data.pantry.length === 0;

  return (
    <Screen title="Shop">
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

      {thisWeek && (
        <View style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.switchText}>
            Skip days that have already passed
          </ThemedText>
          <Switch value={skipPast} onValueChange={setSkipPast} />
        </View>
      )}

      <ErrorText error={error ?? tick.error ?? tickOwn.error ?? clear.error ?? add.error ?? setPref.error} />
      {isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            {data.totals.total > 0 && (
              <View style={styles.progress}>
                <ThemedText type="small" themeColor="textSecondary">
                  {data.totals.ticked} of {data.totals.total} ticked
                </ThemedText>
                <ProgressBar value={data.totals.ticked} target={data.totals.total} />
              </View>
            )}

            <View style={styles.addRow}>
              <TextField value={newItem} onChangeText={setNewItem} placeholder="Add an item (bin bags, a card…)" />
              <Button
                title="Add"
                disabled={newItem.trim() === ''}
                loading={add.isPending}
                onPress={() => add.mutate({ date: anchor, name: newItem.trim() }, { onSuccess: () => setNewItem('') })}
              />
            </View>

            {empty && (
              <Card>
                <ThemedText>Nothing to buy yet.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The list is built from the meals you plan for the week, so it fills up as you plan. You can also add your own items above.
                </ThemedText>
                <Button title="Go to the plan" variant="secondary" onPress={() => router.push('/plan')} />
              </Card>
            )}

            {data.aisles.map((a) => (
              <View key={a.aisle} style={styles.aisle}>
                <ThemedText type="smallBold">{a.aisle}</ThemedText>
                {a.items.map((item) => (
                  <ShoppingRow
                    key={item.key}
                    item={item}
                    expanded={expanded === item.key}
                    onToggleTick={() => toggle(item)}
                    onToggleExpand={() => setExpanded(expanded === item.key ? null : item.key)}
                  />
                ))}
              </View>
            ))}

            {data.pantry.length > 0 && (
              <View style={styles.aisle}>
                <Pressable onPress={() => setShowPantry(!showPantry)}>
                  <ThemedText type="smallBold">
                    {showPantry ? '▾' : '▸'} In your pantry ({data.pantry.length})
                  </ThemedText>
                </Pressable>
                {showPantry &&
                  data.pantry.map((item) => (
                    <View key={item.key} style={styles.pantryRow}>
                      <ThemedText style={styles.pantryName} themeColor="textSecondary">
                        {item.amount ? `${item.amount} ` : ''}
                        {item.name}
                      </ThemedText>
                      <Pressable onPress={() => setPref.mutate({ key: item.key, name: item.name, inPantry: false })} hitSlop={8}>
                        <ThemedText type="linkPrimary">I need it</ThemedText>
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}

            {data.totals.total > 0 && (
              <View style={styles.actions}>
                <Button title="Share list" variant="secondary" style={styles.action} onPress={share} />
                {data.totals.ticked > 0 && (
                  <Button title="Untick all" variant="secondary" style={styles.action} loading={clear.isPending} onPress={() => clear.mutate(anchor)} />
                )}
              </View>
            )}
            <ErrorText error={shareError} />
            {shared && (
              <Card>
                <ThemedText type="small" themeColor="textSecondary">
                  Select and copy:
                </ThemedText>
                <ThemedText selectable>{shared}</ThemedText>
                <Button title="Close" variant="secondary" onPress={() => setShared(null)} />
              </Card>
            )}
          </>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
  center: { textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1 },
  progress: { gap: Spacing.one },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  aisle: { gap: Spacing.one },
  pantryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  pantryName: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
