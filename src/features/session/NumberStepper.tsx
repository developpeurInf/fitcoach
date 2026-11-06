import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

import { stepValue } from './logic';

type Props = {
  label: string;
  value: number | null;
  step: number;
  onChange: (value: number | null) => void;
  decimals?: boolean;
};

/** − value + with a typed value in the middle: one tap per change, big targets (48 px). */
export function NumberStepper({ label, value, step, onChange, decimals }: Props) {
  const { t } = useTranslation();
  const scale = useSettings((s) => s.fontScale);
  const [draft, setDraft] = useState<string | null>(null);

  const bump = (delta: number) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(stepValue(value, delta));
  };
  const commit = () => {
    if (draft === null) return;
    const n = Number.parseFloat(draft.replace(',', '.'));
    onChange(Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null);
    setDraft(null);
  };

  return (
    <View className="flex-1 gap-1">
      <Text variant="caption" className="text-center font-semibold">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl bg-ink-100 dark:bg-ink-800">
        <Pressable
          onPress={() => bump(-step)}
          accessibilityRole="button"
          accessibilityLabel={t('session.decrease', { field: label })}
          className="h-14 w-12 items-center justify-center active:opacity-60"
        >
          <Ionicons name="remove" size={24} color={colors.ink[500]} />
        </Pressable>
        <TextInput
          value={draft ?? (value == null ? '' : String(value).replace('.', decimals ? ',' : '.'))}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          accessibilityLabel={label}
          placeholder="–"
          placeholderTextColor={colors.ink[500]}
          className="min-w-0 flex-1 text-center font-bold text-ink-950 dark:text-ink-50"
          style={{ fontSize: 22 * scale }}
        />
        <Pressable
          onPress={() => bump(step)}
          accessibilityRole="button"
          accessibilityLabel={t('session.increase', { field: label })}
          className="h-14 w-12 items-center justify-center active:opacity-60"
        >
          <Ionicons name="add" size={24} color={colors.ink[500]} />
        </Pressable>
      </View>
    </View>
  );
}
