import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

/** Headline number: label, value, optional hint (trend, explanation). */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <View
      className="min-w-[45%] flex-1 gap-1 rounded-2xl bg-white p-4 dark:bg-ink-900"
      accessible
      accessibilityLabel={`${label} : ${value}${hint ? `. ${hint}` : ''}`}
    >
      <Text variant="caption">{label}</Text>
      <Text variant="heading">{value}</Text>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-ink-900">
      <View className="gap-1">
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}
