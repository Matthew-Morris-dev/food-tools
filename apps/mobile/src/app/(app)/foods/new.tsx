import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { parseNumber } from '@/lib/nutrition';
import type { Slot } from '@/lib/types';

type Fields = Record<
  'name' | 'brand' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugars' | 'fibre' | 'saturates' | 'salt' | 'servingLabel' | 'servingGrams',
  string
>;

export default function NewFoodScreen() {
  const params = useLocalSearchParams<{ date: string; slot: Slot; barcode?: string; name?: string; brand?: string }>();
  const [f, setF] = useState<Fields>({
    name: params.name ?? '',
    brand: params.brand ?? '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    sugars: '',
    fibre: '',
    saturates: '',
    salt: '',
    servingLabel: '',
    servingGrams: '',
  });
  const set = (key: keyof Fields) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));
  const num = (key: keyof Fields) => parseNumber(f[key]);

  const create = useMutation({
    mutationFn: api.createFood,
    onSuccess: (food) =>
      router.replace({ pathname: '/log/food/[id]', params: { id: food.id, date: params.date, slot: params.slot } }),
  });

  const required = [num('kcal'), num('protein'), num('carbs'), num('fat')];
  const servingGrams = num('servingGrams');
  const valid = f.name.trim() !== '' && required.every((n) => n !== null && n >= 0);

  const save = () => {
    if (!valid) return;
    const [kcal, protein, carbs, fat] = required as number[];
    create.mutate({
      name: f.name.trim(),
      brand: f.brand.trim() || null,
      barcode: params.barcode || null,
      kcal,
      protein,
      carbs,
      fat,
      sugars: num('sugars'),
      fibre: num('fibre'),
      saturates: num('saturates'),
      salt: num('salt'),
      servings:
        servingGrams && servingGrams > 0 ? [{ label: f.servingLabel.trim() || `${servingGrams} g`, grams: servingGrams }] : [],
    });
  };

  const decimal = { keyboardType: 'decimal-pad' as const };

  return (
    <FormScreen>
      {params.barcode && (
        <ThemedText type="small" themeColor="textSecondary">
          Barcode {params.barcode} isn&apos;t in Open Food Facts with full nutrition yet. Copy the per 100 g values from
          the label and it&apos;ll be ready next time you scan it.
        </ThemedText>
      )}
      <TextField label="Name" value={f.name} onChangeText={set('name')} />
      <TextField label="Brand (optional)" value={f.brand} onChangeText={set('brand')} />

      <ThemedText type="smallBold">Per 100 g</ThemedText>
      <TextField label="Energy (kcal)" value={f.kcal} onChangeText={set('kcal')} {...decimal} />
      <View style={styles.row}>
        <TextField label="Fat (g)" value={f.fat} onChangeText={set('fat')} {...decimal} />
        <TextField label="Saturates (g)" value={f.saturates} onChangeText={set('saturates')} {...decimal} />
      </View>
      <View style={styles.row}>
        <TextField label="Carbs (g)" value={f.carbs} onChangeText={set('carbs')} {...decimal} />
        <TextField label="Sugars (g)" value={f.sugars} onChangeText={set('sugars')} {...decimal} />
      </View>
      <View style={styles.row}>
        <TextField label="Fibre (g)" value={f.fibre} onChangeText={set('fibre')} {...decimal} />
        <TextField label="Protein (g)" value={f.protein} onChangeText={set('protein')} {...decimal} />
      </View>
      <TextField label="Salt (g)" value={f.salt} onChangeText={set('salt')} {...decimal} />

      <ThemedText type="smallBold">Serving (optional)</ThemedText>
      <View style={styles.row}>
        <TextField label="Name" value={f.servingLabel} onChangeText={set('servingLabel')} placeholder="1 bar" />
        <TextField label="Weight (g)" value={f.servingGrams} onChangeText={set('servingGrams')} {...decimal} />
      </View>

      <ErrorText error={create.error} />
      <Button title="Save food" onPress={save} disabled={!valid} loading={create.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
