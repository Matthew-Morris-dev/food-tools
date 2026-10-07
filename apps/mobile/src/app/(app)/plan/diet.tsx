import { router } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipRow, ErrorText, Loading, TextField } from '@/components/ui';
import { usePlannerSettings, useSavePlannerSettings } from '@/lib/queries';

export default function DietScreen() {
  const { data, isPending, error } = usePlannerSettings();
  if (isPending) return <Loading />;
  if (!data) return <ErrorText error={error} />;
  return <DietForm presets={data.presets} initialDiets={data.diets} initialWords={data.excludedWords} />;
}

function DietForm({ presets, initialDiets, initialWords }: { presets: { id: string; label: string }[]; initialDiets: string[]; initialWords: string[] }) {
  const [diets, setDiets] = useState(initialDiets);
  const [words, setWords] = useState(initialWords.join(', '));
  const save = useSavePlannerSettings();

  const toggle = (id: string) => setDiets((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  return (
    <FormScreen>
      <ThemedText>
        Meals that break these rules are flagged in your plan, and auto-fill leaves those recipes out.
      </ThemedText>

      <ThemedText type="smallBold">Diets</ThemedText>
      <ChipRow>
        {presets.map((p) => (
          <Chip key={p.id} label={p.label} selected={diets.includes(p.id)} onPress={() => toggle(p.id)} />
        ))}
      </ChipRow>

      <TextField
        label="Also keep out (comma separated)"
        value={words}
        onChangeText={setWords}
        placeholder="mushrooms, coriander, sesame"
        autoCapitalize="none"
      />

      <ThemedText type="small" themeColor="textSecondary">
        This is a keyword check on the names of a recipe&apos;s ingredients. It can&apos;t see inside packaged foods or
        sauces, and it can miss alternative names, so it isn&apos;t a guarantee for allergies. Always read labels.
      </ThemedText>

      <ErrorText error={save.error} />
      <Button
        title="Save"
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { diets, excludedWords: words.split(',').map((w) => w.trim()).filter(Boolean) },
            { onSuccess: () => router.back() },
          )
        }
      />
    </FormScreen>
  );
}
