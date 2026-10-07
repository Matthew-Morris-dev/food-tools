import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fmt, sum } from '@/lib/nutrition';
import type { SavedMeal } from '@/lib/types';

export function MealRow({ meal, onPress }: { meal: SavedMeal; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <ThemedText numberOfLines={1}>{meal.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {meal.items.map((i) => i.name).join(', ')}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {fmt(sum(meal.items).kcal)} kcal
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
