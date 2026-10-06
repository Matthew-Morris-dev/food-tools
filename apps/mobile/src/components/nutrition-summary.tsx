import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt } from '@/lib/nutrition';

type Props = { kcal: number; protein: number; carbs: number; fat: number };

export function NutritionSummary({ kcal, protein, carbs, fat }: Props) {
  return (
    <Card>
      <ThemedText type="subtitle">{fmt(kcal)} kcal</ThemedText>
      <View style={styles.row}>
        {[
          ['Protein', protein],
          ['Carbs', carbs],
          ['Fat', fat],
        ].map(([label, grams]) => (
          <View key={label}>
            <ThemedText type="smallBold">{fmt(grams as number)} g</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.five },
});
