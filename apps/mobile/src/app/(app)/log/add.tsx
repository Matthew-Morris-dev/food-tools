import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodRow } from '@/components/food-row';
import { MealRow } from '@/components/meal-row';
import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDebounced } from '@/hooks/use-debounced';
import { slotLabel } from '@/lib/nutrition';
import { useFoodSearch, useOpenFoodFactsSearch, useRecentFoods, useSavedMeals } from '@/lib/queries';
import type { Food, SavedMeal, Slot } from '@/lib/types';

export default function AddFoodScreen() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: Slot }>();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [offQuery, setOffQuery] = useState<string | null>(null);

  const recent = useRecentFoods();
  const savedMeals = useSavedMeals();
  const meals = (savedMeals.data ?? []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const local = useFoodSearch(q);
  const off = useOpenFoodFactsSearch(offQuery ?? '', offQuery !== null && offQuery === q);

  const open = (food: Food) =>
    router.push({ pathname: '/log/food/[id]', params: { id: food.id, date, slot } });
  const openMeal = (meal: SavedMeal) =>
    router.push({ pathname: '/meals/[id]', params: { id: meal.id, date, slot } });

  return (
    <FormScreen>
      <Stack.Screen options={{ title: `Add to ${slotLabel(slot)}` }} />
      <TextField
        placeholder="Search foods"
        value={text}
        onChangeText={setText}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={styles.actions}>
        <Button
          title="Scan barcode"
          variant="secondary"
          style={styles.action}
          onPress={() => router.push({ pathname: '/log/scan', params: { date, slot } })}
        />
        <Button
          title="Quick add"
          variant="secondary"
          style={styles.action}
          onPress={() => router.push({ pathname: '/log/quick-add', params: { date, slot } })}
        />
      </View>

      {meals.length > 0 && (
        <View>
          <ThemedText type="smallBold">My meals</ThemedText>
          {meals.map((meal) => (
            <MealRow key={meal.id} meal={meal} onPress={() => openMeal(meal)} />
          ))}
        </View>
      )}

      {q === '' ? (
        <FoodList
          title="Recent"
          foods={recent.data}
          loading={recent.isPending}
          error={recent.error}
          onPress={open}
          empty="Foods you log will show up here."
        />
      ) : (
        <>
          <FoodList
            title="Results"
            foods={local.data}
            loading={local.isPending}
            error={local.error}
            onPress={open}
            empty="No matches in your foods or the UK food list."
          />
          {offQuery === q ? (
            <FoodList
              title="From Open Food Facts"
              foods={off.data}
              loading={off.isPending}
              error={off.error}
              onPress={open}
              empty="No UK products found."
            />
          ) : (
            <Button title={`Search Open Food Facts for “${q}”`} variant="secondary" onPress={() => setOffQuery(q)} />
          )}
          <Button
            title="Create a food"
            variant="secondary"
            onPress={() => router.push({ pathname: '/foods/new', params: { date, slot, name: q } })}
          />
        </>
      )}
    </FormScreen>
  );
}

type FoodListProps = {
  title: string;
  foods: Food[] | undefined;
  loading: boolean;
  error: unknown;
  onPress: (food: Food) => void;
  empty: string;
};

function FoodList({ title, foods, loading, error, onPress, empty }: FoodListProps) {
  return (
    <View>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ErrorText error={error} />
      {loading ? (
        <Loading />
      ) : foods?.length ? (
        foods.map((food) => <FoodRow key={food.id} food={food} onPress={() => onPress(food)} />)
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          {empty}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  empty: { paddingVertical: Spacing.two },
});
