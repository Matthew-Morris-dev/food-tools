import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Neutral colours throughout: going over a target is information, not an error
export function ProgressBar({ value, target }: { value: number; target: number }) {
  const theme = useTheme();
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
