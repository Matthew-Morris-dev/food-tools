import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fmt } from '@/lib/nutrition';
import type { RecipeListItem } from '@/lib/types';

export function RecipeRow({ recipe, onPress }: { recipe: RecipeListItem; onPress: () => void }) {
  const detail = [
    `${recipe.ingredientCount} ingredients`,
    `${fmt(recipe.servings)} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
    recipe.incomplete ? 'Incomplete' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <ThemedText numberOfLines={2}>{recipe.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {fmt(recipe.perServing.kcal)} kcal
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  text: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.6 },
});
