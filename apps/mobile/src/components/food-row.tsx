import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fmt } from '@/lib/nutrition';
import type { Food } from '@/lib/types';

export function FoodRow({ food, onPress }: { food: Food; onPress: () => void }) {
  const detail = [food.brand, food.source === 'custom' ? 'My food' : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <ThemedText numberOfLines={2}>{food.name}</ThemedText>
        {detail !== '' && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {fmt(food.kcal)} kcal/100 g
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  text: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.6 },
});
