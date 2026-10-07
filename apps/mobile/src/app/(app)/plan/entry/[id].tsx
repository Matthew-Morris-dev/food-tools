import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { NutritionSummary } from '@/components/nutrition-summary';
import { SlotPicker } from '@/components/slot-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addDays, dayName } from '@/lib/dates';
import { fmt, parseNumber } from '@/lib/nutrition';
import { useAddPlanEntry, useDeletePlanEntry, useLogPlanEntry, usePlan, useUpdatePlanEntry } from '@/lib/queries';
import type { PlanEntry, Slot } from '@/lib/types';

export default function PlanEntryScreen() {
  const { id, anchor } = useLocalSearchParams<{ id: string; date: string; anchor: string }>();
  const { data, isPending, error } = usePlan(anchor);
  const entry = data?.days.flatMap((d) => d.entries).find((e) => e.id === id);
  if (isPending) return <Loading />;
  if (!entry || !data) return <ErrorText error={error ?? 'This meal is no longer in the plan.'} />;
  return <EntryEditor entry={entry} weekStartDate={data.weekStart} />;
}

function EntryEditor({ entry, weekStartDate }: { entry: PlanEntry; weekStartDate: string }) {
  const isRecipe = entry.recipeId !== null;
  const [servings, setServings] = useState(entry.servings ?? 1);
  const [gramsText, setGramsText] = useState(String(entry.grams ?? ''));
  const [locked, setLocked] = useState(entry.locked);
  const [date, setDate] = useState(entry.date);
  const [slot, setSlot] = useState<Slot>(entry.slot);
  const [leftoverDate, setLeftoverDate] = useState(addDays(entry.date, 1));
  const [leftoverSlot, setLeftoverSlot] = useState<Slot>('lunch');

  const update = useUpdatePlanEntry();
  const remove = useDeletePlanEntry();
  const add = useAddPlanEntry();
  const logIt = useLogPlanEntry();

  const grams = parseNumber(gramsText);
  const valid = isRecipe ? servings >= 0.25 : grams !== null && grams >= 1 && grams <= 5000;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const scale = isRecipe ? servings / (entry.servings ?? 1) : (grams ?? 0) / (entry.grams ?? 1);

  const save = () =>
    update.mutate(
      { id: entry.id, date, slot, locked, ...(isRecipe ? { servings } : { grams: grams ?? undefined }) },
      { onSuccess: () => router.back() },
    );

  if (entry.confirmed) {
    return (
      <FormScreen>
        <ThemedText type="subtitle">{entry.name}</ThemedText>
        <ThemedText themeColor="textSecondary">This meal has been logged as eaten. Change or delete it from Today.</ThemedText>
        <Button title="Remove from plan" variant="secondary" loading={remove.isPending} onPress={() => remove.mutate(entry.id, { onSuccess: () => router.back() })} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <ThemedText type="subtitle">{entry.name}</ThemedText>
      {entry.leftoverOfId && (
        <ThemedText type="small" themeColor="textSecondary">
          Leftovers from another meal in this plan.
        </ThemedText>
      )}
      {entry.warnings.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Contains {entry.warnings.join(', ')}, which your diet settings flag. This is a keyword check, so read labels.
        </ThemedText>
      )}
      {entry.incomplete && (
        <ThemedText type="small" themeColor="textSecondary">
          Some of this recipe&apos;s ingredients have no food chosen, so its numbers are too low.
        </ThemedText>
      )}

      {isRecipe ? (
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Less" hitSlop={10} onPress={() => setServings(Math.max(0.25, servings - 0.25))}>
            <ThemedText type="subtitle">−</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">
            {fmt(servings)} {servings === 1 ? 'serving' : 'servings'}
          </ThemedText>
          <Pressable accessibilityLabel="More" hitSlop={10} onPress={() => setServings(servings + 0.25)}>
            <ThemedText type="subtitle">+</ThemedText>
          </Pressable>
        </View>
      ) : (
        <TextField label="Amount (g)" value={gramsText} onChangeText={setGramsText} keyboardType="decimal-pad" selectTextOnFocus />
      )}
      {valid && (
        <NutritionSummary
          kcal={entry.macros.kcal * scale}
          protein={entry.macros.protein * scale}
          carbs={entry.macros.carbs * scale}
          fat={entry.macros.fat * scale}
        />
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <ThemedText>Lock this portion</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            &quot;Fit to target&quot; leaves locked meals as they are.
          </ThemedText>
        </View>
        <Switch value={locked} onValueChange={setLocked} />
      </View>

      <ThemedText type="smallBold">Day and meal</ThemedText>
      <ChipRow>
        {weekDays.map((d) => (
          <Chip key={d} label={dayName(d)} selected={date === d} onPress={() => setDate(d)} />
        ))}
      </ChipRow>
      <SlotPicker value={slot} onChange={setSlot} />

      <ErrorText error={update.error ?? remove.error} />
      <Button title="Save" onPress={save} disabled={!valid} loading={update.isPending} />

      {isRecipe && !entry.leftoverOfId && (
        <Card>
          <ThemedText type="smallBold">Make this go further</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Plan a later meal from the same cook. The shopping list counts it once.
          </ThemedText>
          <ChipRow>
            {weekDays.map((d) => (
              <Chip key={d} label={dayName(d)} selected={leftoverDate === d} onPress={() => setLeftoverDate(d)} />
            ))}
          </ChipRow>
          <SlotPicker value={leftoverSlot} onChange={setLeftoverSlot} />
          <ErrorText error={add.error} />
          <Button
            title="Add leftovers"
            variant="secondary"
            loading={add.isPending}
            onPress={() =>
              add.mutate(
                { date: leftoverDate, slot: leftoverSlot, recipeId: entry.recipeId!, servings: 1, leftoverOfId: entry.id },
                { onSuccess: () => router.back() },
              )
            }
          />
        </Card>
      )}

      <ErrorText error={logIt.error} />
      <Button
        title="Log as eaten"
        variant="secondary"
        loading={logIt.isPending}
        onPress={() => logIt.mutate({ id: entry.id, slot, ...(isRecipe ? { servings } : { grams: grams ?? undefined }) }, { onSuccess: () => router.back() })}
      />
      <Button title="Remove from plan" variant="secondary" loading={remove.isPending} onPress={() => remove.mutate(entry.id, { onSuccess: () => router.back() })} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.half },
});
