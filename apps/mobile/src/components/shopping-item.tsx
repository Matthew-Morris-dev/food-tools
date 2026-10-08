import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayName } from '@/lib/dates';
import { parseNumber } from '@/lib/nutrition';
import {
  useDeleteShoppingItem,
  useSaveProduct,
  useSetItemPref,
  useUpdateShoppingItem,
} from '@/lib/queries';
import type { ShoppingItem, StoreId } from '@/lib/types';

export const AISLES = [
  'Fruit and veg',
  'Meat and fish',
  'Dairy and eggs',
  'Bakery',
  'Rice, pasta and dry goods',
  'Tins and jars',
  'Oils and sauces',
  'Herbs and spices',
  'Frozen',
  'Drinks',
  'Snacks and sweets',
  'Household',
  'Other',
];

const STORES: StoreId[] = ['tesco', 'sainsburys', 'ocado'];

export function ShoppingRow({
  item,
  expanded,
  onToggleTick,
  onToggleExpand,
}: {
  item: ShoppingItem;
  expanded: boolean;
  onToggleTick: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.ticked }} onPress={onToggleTick} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
          <ThemedText style={styles.box}>{item.ticked ? '☑' : '☐'}</ThemedText>
          <View style={styles.text}>
            <ThemedText numberOfLines={2} themeColor={item.ticked ? 'textSecondary' : 'text'} style={item.ticked ? styles.done : undefined}>
              {item.amount ? `${item.amount} ` : ''}
              {item.name}
            </ThemedText>
            {item.buy && !item.ticked && (
              <ThemedText type="small" themeColor="textSecondary">
                Buy {item.buy}
              </ThemedText>
            )}
          </View>
        </Pressable>
        <Pressable accessibilityLabel={`Details for ${item.name}`} onPress={onToggleExpand} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            {expanded ? 'Close' : 'Details'}
          </ThemedText>
        </Pressable>
      </View>
      {expanded && <ItemPanel item={item} />}
    </View>
  );
}

function ItemPanel({ item }: { item: ShoppingItem }) {
  const setPref = useSetItemPref();
  const updateOwn = useUpdateShoppingItem();
  const remove = useDeleteShoppingItem();
  const saveProduct = useSaveProduct();
  const [packText, setPackText] = useState(item.packGrams ? String(item.packGrams) : '');
  const [linkText, setLinkText] = useState('');
  const [linkStore, setLinkStore] = useState<StoreId>('tesco');
  const own = item.manualId !== null;

  const pref = (changes: { aisle?: string | null; packGrams?: number | null; inPantry?: boolean }) =>
    setPref.mutate({ key: item.key, name: item.name, ...changes });
  const packGrams = parseNumber(packText);

  return (
    <Card style={styles.panel}>
      {item.sources.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          For {item.sources.map((s) => `${s.label} (${s.dates.map(dayName).join(', ')})`).join(' and ')}
        </ThemedText>
      )}

      <ThemedText type="smallBold">Find it</ThemedText>
      <View style={styles.stores}>
        {STORES.map((s) => (
          <Button
            key={s}
            title={`${item.links[s].label}${item.links[s].saved ? ' ✓' : ''}`}
            variant="secondary"
            style={styles.store}
            onPress={() => Linking.openURL(item.links[s].url)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Opens a search on their website, or the product you saved (✓).
      </ThemedText>

      <ThemedText type="smallBold">Remember a product</ThemedText>
      <ChipRow>
        {STORES.map((s) => (
          <Chip key={s} label={item.links[s].label} selected={linkStore === s} onPress={() => setLinkStore(s)} />
        ))}
      </ChipRow>
      <TextField value={linkText} onChangeText={setLinkText} placeholder="Paste a product page link" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <ErrorText error={saveProduct.error} />
      <View style={styles.stores}>
        <Button
          title="Save link"
          style={styles.store}
          disabled={linkText.trim() === ''}
          loading={saveProduct.isPending}
          onPress={() => saveProduct.mutate({ key: item.key, store: linkStore, url: linkText.trim() }, { onSuccess: () => setLinkText('') })}
        />
        {item.links[linkStore].saved && (
          <Button title={`Clear ${item.links[linkStore].label} link`} variant="secondary" style={styles.store} onPress={() => saveProduct.mutate({ key: item.key, store: linkStore, url: null })} />
        )}
      </View>

      {!own && (
        <>
          <ThemedText type="smallBold">Pack size</ThemedText>
          <View style={styles.packRow}>
            <TextField value={packText} onChangeText={setPackText} keyboardType="decimal-pad" placeholder={item.defaultPackLabel ? `Usually ${item.defaultPackLabel}` : 'Grams in one pack'} />
            <Button title="Save" variant="secondary" disabled={packGrams === null || packGrams <= 0} onPress={() => pref({ packGrams })} />
          </View>
          {item.packGrams !== null && (
            <Pressable
              onPress={() => {
                setPackText('');
                pref({ packGrams: null });
              }}>
              <ThemedText type="small" themeColor="textSecondary">
                Use the standard pack size
              </ThemedText>
            </Pressable>
          )}
        </>
      )}

      <ThemedText type="smallBold">Aisle</ThemedText>
      <ChipRow>
        {AISLES.map((a) => (
          <Chip
            key={a}
            label={a}
            selected={item.aisle === a}
            onPress={() => (own ? updateOwn.mutate({ id: item.manualId!, aisle: a }) : pref({ aisle: a }))}
          />
        ))}
      </ChipRow>

      <ErrorText error={setPref.error ?? updateOwn.error ?? remove.error} />
      {own ? (
        <Button title="Delete this item" variant="secondary" loading={remove.isPending} onPress={() => remove.mutate(item.manualId!)} />
      ) : (
        <Button title="I always have this" variant="secondary" loading={setPref.isPending} onPress={() => pref({ inPantry: true })} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  box: { fontSize: 22 },
  text: { flex: 1, gap: Spacing.half },
  done: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },
  panel: { marginBottom: Spacing.two },
  stores: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  store: { flexGrow: 1 },
  packRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
});
