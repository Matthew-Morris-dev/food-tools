import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipRow, ErrorText, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { setDraft } from '@/lib/recipe-draft';

export default function ImportRecipeScreen() {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const importRecipe = useMutation({
    mutationFn: api.importRecipe,
    onSuccess: (draft) => {
      setDraft(draft);
      router.replace({ pathname: '/recipes/edit', params: { draft: '1' } });
    },
  });

  const valid = mode === 'url' ? /^https?:\/\/\S+$/i.test(url.trim()) : text.trim().length >= 10;
  const submit = () => {
    if (!valid) return;
    importRecipe.mutate(mode === 'url' ? { url: url.trim() } : { text: text.trim() });
  };

  return (
    <FormScreen>
      <ChipRow>
        <Chip label="Web address" selected={mode === 'url'} onPress={() => setMode('url')} />
        <Chip label="Paste text" selected={mode === 'text'} onPress={() => setMode('text')} />
      </ChipRow>

      {mode === 'url' ? (
        <>
          <TextField
            label="Recipe web address"
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <ThemedText type="small" themeColor="textSecondary">
            Works with most recipe sites. Some block this kind of request; if yours does, paste the text instead.
          </ThemedText>
        </>
      ) : (
        <>
          <TextField
            label="Recipe text"
            value={text}
            onChangeText={setText}
            multiline
            style={styles.text}
            placeholder={'Quick dal\nServes 4\n\nIngredients\n200g red lentils\n1 onion, chopped\n\nMethod\n1. Rinse the lentils...'}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Put each ingredient on its own line with the amount first. Headings like &quot;Ingredients&quot; and
            &quot;Method&quot; help but aren&apos;t required.
          </ThemedText>
        </>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        You&apos;ll review everything before it&apos;s saved: each ingredient is matched to a food and given a weight,
        and you can change either.
      </ThemedText>
      <ErrorText error={importRecipe.error} />
      <Button title="Import" onPress={submit} disabled={!valid} loading={importRecipe.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  text: { minHeight: 220, textAlignVertical: 'top' },
});
