import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { weekLabel, weekStart } from '@/lib/dates';
import { useApplyTemplate, useDeletePlanEntries, useDeleteTemplate, usePlanTemplates, useSaveTemplate } from '@/lib/queries';

export default function TemplatesScreen() {
  const { anchor } = useLocalSearchParams<{ anchor: string }>();
  const { data, isPending, error } = usePlanTemplates();
  const save = useSaveTemplate();
  const apply = useApplyTemplate();
  const remove = useDeleteTemplate();
  const undo = useDeletePlanEntries();
  const [name, setName] = useState('');
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState<{ text: string; ids: string[] } | null>(null);
  const label = weekLabel(weekStart(anchor));

  return (
    <FormScreen>
      <Card>
        <ThemedText type="smallBold">Save {label} as a template</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Keeps every planned meal, portion and leftover link, by day of the week, so you can reuse a week that worked.
        </ThemedText>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Busy week" />
        <ErrorText error={save.error} />
        <Button
          title="Save template"
          disabled={name.trim() === ''}
          loading={save.isPending}
          onPress={() => save.mutate({ name: name.trim(), date: anchor }, { onSuccess: () => setName('') })}
        />
      </Card>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <ThemedText>Replace what&apos;s planned when applying</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Off: only empty meals in {label} are filled. On: unlocked, uneaten meals are cleared first.
          </ThemedText>
        </View>
        <Switch value={replace} onValueChange={setReplace} />
      </View>

      <ErrorText error={error ?? apply.error ?? remove.error ?? undo.error} />
      {message && (
        <Card>
          <ThemedText>{message.text}</ThemedText>
          {message.ids.length > 0 && (
            <Button
              title="Undo"
              variant="secondary"
              loading={undo.isPending}
              onPress={() => undo.mutate(message.ids, { onSuccess: () => setMessage({ text: 'Undone.', ids: [] }) })}
            />
          )}
        </Card>
      )}

      <ThemedText type="smallBold">Your templates</ThemedText>
      {isPending ? (
        <Loading />
      ) : data?.length ? (
        data.map((t) => (
          <Card key={t.id}>
            <ThemedText>{t.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.entries} planned {t.entries === 1 ? 'meal' : 'meals'}
            </ThemedText>
            <View style={styles.row}>
              <Button
                title="Apply to this week"
                style={styles.rowButton}
                loading={apply.isPending && apply.variables?.id === t.id}
                onPress={() =>
                  apply.mutate(
                    { id: t.id, date: anchor, replace },
                    {
                      onSuccess: (r) =>
                        setMessage({
                          text:
                            r.added === 0
                              ? 'Nothing added: those meals already have something planned.'
                              : `Added ${r.added} ${r.added === 1 ? 'meal' : 'meals'}${r.skipped ? `, skipped ${r.skipped} that were already planned` : ''}${r.replaced ? `, replaced ${r.replaced}` : ''}.`,
                          ids: r.ids,
                        }),
                    },
                  )
                }
              />
              <Button title="Delete" variant="secondary" style={styles.rowButton} onPress={() => remove.mutate(t.id)} />
            </View>
          </Card>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No templates yet.
        </ThemedText>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.half },
  row: { flexDirection: 'row', gap: Spacing.two },
  rowButton: { flex: 1 },
});
