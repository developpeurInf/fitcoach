import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, type PressableProps } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
};

/** Large touch target (min 56 px) so it stays easy to hit mid-set. */
export function Button({ label, variant = 'primary', loading, disabled, onPress, ...rest }: Props) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={(e) => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress?.(e);
      }}
      className={`min-h-14 flex-row items-center justify-center rounded-2xl px-6 active:opacity-80 ${
        primary ? 'bg-accent' : danger ? 'bg-danger' : 'border border-ink-300 dark:border-ink-700'
      } ${disabled ? 'opacity-50' : ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={primary ? colors.accent.foreground : danger ? '#FFFFFF' : undefined}
        />
      ) : (
        <Text
          variant="body"
          className="font-bold"
          // Inline color: class overrides conflict with the variant's dark: color in NativeWind.
          style={
            primary
              ? { color: colors.accent.foreground }
              : danger
                ? { color: '#FFFFFF' }
                : undefined
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
