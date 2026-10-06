import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.text : theme.backgroundElement },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.background : theme.text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: primary ? theme.background : theme.text }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function TextField({ label, style, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label && (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, style]}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.dimmed}>
      <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
        <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, style]}>
      {children}
    </ThemedView>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <ThemedText style={styles.error}>{error instanceof Error ? error.message : String(error)}</ThemedText>;
}

export function Loading() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.textSecondary} style={styles.loading} />;
}

const styles = StyleSheet.create({
  button: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  dimmed: { opacity: 0.6 },
  field: { gap: Spacing.one, flexGrow: 1 },
  input: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  error: { color: '#D93F3F' },
  loading: { padding: Spacing.four },
});
