import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The root layout swaps to the tabs as soon as the session appears.
  async function submit() {
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    if (error) setError(error.message ?? 'Something went wrong');
    setBusy(false);
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.form}>
          <ThemedText type="subtitle">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</ThemedText>

          {mode === 'sign-up' && (
            <TextInput
              style={inputStyle}
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          )}
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.text }, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={{ color: theme.background }} type="smallBold">
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.switch}>
              {mode === 'sign-in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center' },
  form: {
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  error: { color: '#D93F3F' },
  button: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  switch: { textAlign: 'center' },
});
