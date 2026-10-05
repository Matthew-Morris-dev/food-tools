import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';

export default function SettingsScreen() {
  const { data: session } = authClient.useSession();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.section}>
        <ThemedText type="smallBold">{session?.user.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {session?.user.email}
        </ThemedText>
      </View>

      <Pressable onPress={() => authClient.signOut()} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedText>Sign out</ThemedText>
        </ThemedView>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.half },
  row: { padding: Spacing.three, borderRadius: Spacing.two },
  pressed: { opacity: 0.7 },
});
