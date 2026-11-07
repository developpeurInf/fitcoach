import { Pressable, View } from 'react-native';

import { Text } from './Text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** One-row filter (e.g. Jour / Semaine / Mois…): equal segments, 48 px tall. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-2xl bg-ink-100 p-1 dark:bg-ink-900"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl px-1 ${
              selected ? 'bg-white dark:bg-ink-700' : ''
            }`}
          >
            <Text
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit
              className={selected ? 'font-bold' : 'font-semibold'}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
