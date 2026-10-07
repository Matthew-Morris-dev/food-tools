import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/dates';
import type { WeightPoint } from '@/lib/types';
import { formatWeight, type WeightUnit } from '@/lib/units';

const HEIGHT = 160;
const PAD = 12;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

// Weigh-ins as dots, the 7-day trend as a line. Targets follow the trend, not single
// weigh-ins, so the line is the one to read.
export function WeightChart({ points, unit }: { points: WeightPoint[]; unit: WeightUnit }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Log your weight to see your trend here.
      </ThemedText>
    );
  }

  const values = points.flatMap((p) => [p.weightKg, p.trendKg]);
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const first = dayNumber(points[0].date);
  const span = Math.max(1, dayNumber(points.at(-1)!.date) - first);

  const x = (date: string) => PAD + ((dayNumber(date) - first) / span) * (width - PAD * 2);
  const y = (kg: number) => PAD + (1 - (kg - min) / (max - min)) * (HEIGHT - PAD * 2);
  const trendLine = points.map((p) => `${x(p.date)},${y(p.trendKg)}`).join(' ');

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Line x1={PAD} x2={width - PAD} y1={y(max)} y2={y(max)} stroke={theme.backgroundSelected} strokeWidth={1} />
            <Line x1={PAD} x2={width - PAD} y1={y(min)} y2={y(min)} stroke={theme.backgroundSelected} strokeWidth={1} />
            {points.map((p) => (
              <Circle key={p.date} cx={x(p.date)} cy={y(p.weightKg)} r={3} fill={theme.textSecondary} />
            ))}
            {points.length > 1 && <Polyline points={trendLine} fill="none" stroke={theme.text} strokeWidth={2.5} strokeLinejoin="round" />}
            {points.length === 1 && <Circle cx={x(points[0].date)} cy={y(points[0].trendKg)} r={5} fill={theme.text} />}
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {dayLabel(points[0].date)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatWeight(min + 0.3, unit)} – {formatWeight(max - 0.3, unit)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dayLabel(points.at(-1)!.date)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingTop: Spacing.one },
});
