import { TextInput, View, type TextInputProps } from 'react-native';

import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string; suffix?: string };

// React 19: `ref` is a regular prop, so no forwardRef is needed.

export function TextField({ label, error, suffix, ...rest }: Props) {
  const scale = useSettings((s) => s.fontScale);
  return (
    <View className="gap-2">
      <Text variant="caption" className="font-semibold uppercase tracking-wide">
        {label}
      </Text>
      <View
        className={`min-h-14 flex-row items-center rounded-2xl border bg-white px-4 dark:bg-ink-900 ${
          error ? 'border-danger' : 'border-ink-100 dark:border-ink-800'
        }`}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.ink[500]}
          className="flex-1 py-3 text-ink-950 dark:text-ink-50"
          style={{ fontSize: 17 * scale }}
          {...rest}
        />
        {suffix ? <Text variant="caption">{suffix}</Text> : null}
      </View>
      {error ? (
        <Text variant="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
