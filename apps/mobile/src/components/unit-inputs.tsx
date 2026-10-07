import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  heightFromInputs,
  heightToInputs,
  weightFromInputs,
  weightToInputs,
  type HeightUnit,
  type WeightUnit,
} from '@/lib/units';

type WeightInputProps = {
  label: string;
  unit: WeightUnit;
  initialKg: number | null;
  onChangeKg: (kg: number | null) => void;
};

// Keeps its own text so typing isn't rewritten by conversions. Remount it (key={unit})
// when the unit changes.
export function WeightInput({ label, unit, initialKg, onChangeKg }: WeightInputProps) {
  const [texts, setTexts] = useState(() => weightToInputs(initialKg, unit));
  const set = (index: number) => (value: string) => {
    const next = texts.map((t, i) => (i === index ? value : t));
    setTexts(next);
    onChangeKg(weightFromInputs(unit, next));
  };
  const labels = unit === 'st_lb' ? ['st', 'lb'] : [unit];
  return (
    <View style={styles.row}>
      {texts.map((text, i) => (
        <TextField
          key={labels[i]}
          label={i === 0 ? `${label} (${labels[i]})` : labels[i]}
          value={text}
          onChangeText={set(i)}
          keyboardType="decimal-pad"
        />
      ))}
    </View>
  );
}

type HeightInputProps = {
  unit: HeightUnit;
  initialCm: number | null;
  onChangeCm: (cm: number | null) => void;
};

export function HeightInput({ unit, initialCm, onChangeCm }: HeightInputProps) {
  const [texts, setTexts] = useState(() => heightToInputs(initialCm, unit));
  const set = (index: number) => (value: string) => {
    const next = texts.map((t, i) => (i === index ? value : t));
    setTexts(next);
    onChangeCm(heightFromInputs(unit, next));
  };
  const labels = unit === 'ft_in' ? ['ft', 'in'] : ['cm'];
  return (
    <View style={styles.row}>
      {texts.map((text, i) => (
        <TextField
          key={labels[i]}
          label={i === 0 ? `Height (${labels[i]})` : labels[i]}
          value={text}
          onChangeText={set(i)}
          keyboardType="decimal-pad"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
