import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = { tone?: 'info' | 'warning' | 'danger'; title?: string; children: string };

const TONE = {
  info: {
    icon: 'information-circle',
    color: colors.accent.DEFAULT,
    cls: 'border-accent/40 bg-accent/10',
  },
  warning: { icon: 'warning', color: colors.warning, cls: 'border-warning/50 bg-warning/10' },
  danger: { icon: 'alert-circle', color: colors.danger, cls: 'border-danger/50 bg-danger/10' },
} as const;

/** Inline message box (health warnings, errors, tips). */
export function Notice({ tone = 'info', title, children }: Props) {
  const t = TONE[tone];
  return (
    <View
      accessibilityRole={tone === 'info' ? undefined : 'alert'}
      className={`flex-row gap-3 rounded-2xl border p-4 ${t.cls}`}
    >
      <Ionicons name={t.icon} size={22} color={t.color} />
      <View className="flex-1 gap-1">
        {title ? <Text className="font-bold">{title}</Text> : null}
        <Text variant="caption" className="text-ink-900 dark:text-ink-100">
          {children}
        </Text>
      </View>
    </View>
  );
}
