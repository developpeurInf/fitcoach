import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
};

export function Checkbox({ checked, onChange, children, error }: Props) {
  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        className="min-h-12 flex-row items-start gap-3 py-2"
      >
        <View
          className={`mt-0.5 h-7 w-7 items-center justify-center rounded-lg border-2 ${
            checked
              ? 'border-accent bg-accent'
              : error
                ? 'border-danger'
                : 'border-ink-300 dark:border-ink-700'
          }`}
        >
          {checked ? (
            <Ionicons name="checkmark" size={18} color={colors.accent.foreground} />
          ) : null}
        </View>
        <View className="flex-1">
          {typeof children === 'string' ? <Text>{children}</Text> : children}
        </View>
      </Pressable>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}
