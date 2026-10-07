import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/form-screen';
import { RecipeRow } from '@/components/recipe-row';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { useDebounced } from '@/hooks/use-debounced';
import { slotLabel } from '@/lib/nutrition';
import { pickFood } from '@/lib/pick-food';
import { useAddPlanEntry, useRecipes } from '@/lib/queries';
import type { Slot } from '@/lib/types';

// Adds a meal to the plan: tap a recipe for one serving, or pick a single food
export default function AddToPlanScreen() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: Slot }>();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const { data, isPending, error } = useRecipes(q);
  const add = useAddPlanEntry();

  const addRecipe = (recipeId: string) => add.mutate({ date, slot, recipeId, servings: 1 }, { onSuccess: () => router.back() });
  const addFood = async () => {
    const food = await pickFood();
    if (food) add.mutate({ date, slot, foodId: food.id, grams: food.servings[0]?.grams ?? 100 }, { onSuccess: () => router.back() });
  };

  return (
    <FormScreen>
      <ThemedText type="smallBold">Add to {slotLabel(slot).toLowerCase()}</ThemedText>
      <TextField placeholder="Search your recipes" value={text} onChangeText={setText} autoCorrect={false} />
      <ErrorText error={error ?? add.error} />
      {isPending ? (
        <Loading />
      ) : data?.length ? (
        data.map((r) => <RecipeRow key={r.id} recipe={r} onPress={() => addRecipe(r.id)} />)
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {q ? 'No recipes match.' : 'No recipes yet. Create or import one in the Recipes tab.'}
        </ThemedText>
      )}
      <Button title="Add a single food instead" variant="secondary" onPress={addFood} />
    </FormScreen>
  );
}
