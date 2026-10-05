import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Placeholder, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { authClient } from '@/lib/auth-client';

export default function TodayScreen() {
  const { data: session } = authClient.useSession();
  const initial = session?.user.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Screen
      title="Today"
      headerRight={
        <Link href="/settings" asChild>
          <Pressable accessibilityLabel="Settings">
            <ThemedView type="backgroundSelected" style={styles.avatar}>
              <ThemedText type="smallBold">{initial}</ThemedText>
            </ThemedView>
          </Pressable>
        </Link>
      }>
      <Placeholder>Calories, macros and today&apos;s meals will appear here.</Placeholder>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
