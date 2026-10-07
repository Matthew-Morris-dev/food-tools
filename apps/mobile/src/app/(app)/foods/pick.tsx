import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodRow } from '@/components/food-row';
import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDebounced } from '@/hooks/use-debounced';
import { resolvePick } from '@/lib/pick-food';
import { useFoodSearch, useOpenFoodFactsSearch, useRecentFoods } from '@/lib/queries';
import type { Food } from '@/lib/types';

// Chooses a food for something else (an ingredient) and hands it back to the caller
export default function PickFoodScreen() {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [offQuery, setOffQuery] = useState<string | null>(null);
  const recent = useRecentFoods();
  const local = useFoodSearch(q);
  const off = useOpenFoodFactsSearch(offQuery ?? '', offQuery !== null && offQuery === q);

  // Closing without choosing answers "nothing"
  useEffect(() => () => resolvePick(null), []);

  const choose = (food: Food) => {
    resolvePick(food);
    router.back();
  };

  return (
    <FormScreen>
      <TextField placeholder="Search foods" value={text} onChangeText={setText} autoFocus autoCorrect={false} />
      {q === '' ? (
        <List title="Recent" foods={recent.data} loading={recent.isPending} error={recent.error} onPress={choose} empty="Foods you log will show up here." />
      ) : (
        <>
          <List title="Results" foods={local.data} loading={local.isPending} error={local.error} onPress={choose} empty="No matches in your foods or the UK food list." />
          {offQuery === q ? (
            <List title="From Open Food Facts" foods={off.data} loading={off.isPending} error={off.error} onPress={choose} empty="No UK products found." />
          ) : (
            <Button title={`Search Open Food Facts for “${q}”`} variant="secondary" onPress={() => setOffQuery(q)} />
          )}
        </>
      )}
    </FormScreen>
  );
}

function List(props: {
  title: string;
  foods: Food[] | undefined;
  loading: boolean;
  error: unknown;
  onPress: (food: Food) => void;
  empty: string;
}) {
  return (
    <View>
      <ThemedText type="smallBold">{props.title}</ThemedText>
      <ErrorText error={props.error} />
      {props.loading ? (
        <Loading />
      ) : props.foods?.length ? (
        props.foods.map((f) => <FoodRow key={f.id} food={f} onPress={() => props.onPress(f)} />)
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          {props.empty}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: Spacing.two },
});
