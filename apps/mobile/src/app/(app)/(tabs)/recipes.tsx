import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Placeholder, Screen } from '@/components/screen';
import { RecipeRow } from '@/components/recipe-row';
import { Button, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDebounced } from '@/hooks/use-debounced';
import { useRecipes, useRecipeTags } from '@/lib/queries';

export default function RecipesScreen() {
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const q = useDebounced(text.trim());
  const { data, isPending, error } = useRecipes(q, tag);
  const tags = useRecipeTags();

  return (
    <Screen title="Recipes">
      <View style={styles.actions}>
        <Button title="+ New recipe" style={styles.action} onPress={() => router.push('/recipes/edit')} />
        <Button title="Import" variant="secondary" style={styles.action} onPress={() => router.push('/recipes/import')} />
      </View>
      <TextField placeholder="Search recipes" value={text} onChangeText={setText} autoCorrect={false} />
      {(tags.data?.length ?? 0) > 0 && (
        <ChipRow>
          {tags.data!.map((t) => (
            <Chip key={t} label={t} selected={tag === t} onPress={() => setTag(tag === t ? '' : t)} />
          ))}
        </ChipRow>
      )}
      <ErrorText error={error} />
      {isPending ? (
        <Loading />
      ) : data?.length ? (
        <View>
          {data.map((r) => (
            <RecipeRow key={r.id} recipe={r} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })} />
          ))}
        </View>
      ) : (
        <Placeholder>
          {q || tag ? 'No recipes match.' : 'No recipes yet. Create one, or import it from a website or pasted text.'}
        </Placeholder>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
