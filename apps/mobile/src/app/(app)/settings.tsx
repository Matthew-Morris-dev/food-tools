import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip, ChipRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';
import { useProfile, useSetUnits } from '@/lib/queries';

function LinkRow({ href, label }: { href: '/goal/setup' | '/support'; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedText>{label}</ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

export default function SettingsScreen() {
  const { data: session } = authClient.useSession();
  const { data: profile } = useProfile();
  const setUnits = useSetUnits();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText type="smallBold">{session?.user.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {session?.user.email}
          </ThemedText>
        </View>

        <LinkRow href="/goal/setup" label={profile ? 'Goal and targets' : 'Set a goal'} />

        {profile && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Units</ThemedText>
            <ChipRow>
              {(['kg', 'st_lb', 'lb'] as const).map((u) => (
                <Chip
                  key={u}
                  label={{ kg: 'kg', st_lb: 'st + lb', lb: 'lb' }[u]}
                  selected={profile.weightUnit === u}
                  onPress={() => setUnits.mutate({ weightUnit: u })}
                />
              ))}
            </ChipRow>
            <ChipRow>
              {(['cm', 'ft_in'] as const).map((u) => (
                <Chip
                  key={u}
                  label={u === 'cm' ? 'cm' : 'ft + in'}
                  selected={profile.heightUnit === u}
                  onPress={() => setUnits.mutate({ heightUnit: u })}
                />
              ))}
            </ChipRow>
          </View>
        )}

        <LinkRow href="/support" label="Support" />

        <View style={styles.section}>
          <ThemedText type="smallBold">Food data</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Generic foods come from McCance and Widdowson&apos;s Composition of Foods Integrated Dataset (Public Health
            England), under the Open Government Licence v3.0. Packaged foods come from Open Food Facts
            (openfoodfacts.org), under the Open Database Licence.
          </ThemedText>
        </View>

        <Pressable onPress={() => authClient.signOut()} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.row}>
            <ThemedText>Sign out</ThemedText>
          </ThemedView>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  row: { padding: Spacing.three, borderRadius: Spacing.two },
  pressed: { opacity: 0.7 },
});
