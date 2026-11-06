import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import type { Enum } from '@/types/models';

const STYLE: Record<Enum<'week_type'>, string> = {
  adaptation: 'bg-ink-100 dark:bg-ink-800',
  progression: 'bg-accent/20',
  deload: 'bg-warning/20',
  test: 'bg-danger/20',
};

export function WeekTypeBadge({ type }: { type: Enum<'week_type'> }) {
  const { t } = useTranslation();
  return (
    <View className={`self-start rounded-full px-3 py-1 ${STYLE[type]}`}>
      <Text variant="caption" className="font-semibold">
        {t(`program.weekTypes.${type}`)}
      </Text>
    </View>
  );
}
