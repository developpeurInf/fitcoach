import { Pressable, View } from 'react-native';

import { Text } from './Text';

type Option<T extends string | number> = { value: T; label: string; description?: string };

type Props<T extends string | number> = {
  options: Option<T>[];
  /** Single value, or an array for multi-select. */
  value: T | T[] | undefined;
  onChange: (value: T) => void;
  multiple?: boolean;
  /** Full-width rows (with description) instead of compact chips. */
  layout?: 'chips' | 'list';
  accessibilityLabel?: string;
};

/** Large, one-tap choices. The caller decides how a tap updates the value (toggle for multi). */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  multiple,
  layout = 'chips',
  accessibilityLabel,
}: Props<T>) {
  const isSelected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      className={layout === 'chips' ? 'flex-row flex-wrap gap-2' : 'gap-3'}
    >
      {options.map((o) => {
        const selected = isSelected(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: selected } : { selected }}
            className={`rounded-2xl border px-4 active:opacity-80 ${
              layout === 'list' ? 'min-h-16 justify-center py-3' : 'min-h-12 justify-center py-2'
            } ${
              selected
                ? 'border-accent bg-accent/15'
                : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
            }`}
          >
            <Text
              variant="body"
              className="font-semibold"
            >
              {o.label}
            </Text>
            {o.description ? <Text variant="caption">{o.description}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Adds or removes a value from a multi-select list. */
export function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}
