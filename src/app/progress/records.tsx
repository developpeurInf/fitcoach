import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Notice, Screen, Text } from '@/components/ui';
import { useRecords } from '@/features/progress/api';
import { BackHeader } from '@/features/progress/BackHeader';
import { RecordRow } from '@/features/progress/RecordRow';
import { colors } from '@/theme/tokens';

/** All personal records: the current best per exercise and type, most recent first. */
export default function RecordsScreen() {
  const { t } = useTranslation();
  const records = useRecords();
  return (
    <Screen>
      <BackHeader title={t('progress.records.title')} />
      {records.isPending ? (
        <ActivityIndicator className="mt-10" color={colors.accent.DEFAULT} />
      ) : records.isError ? (
        <Notice tone="danger">{t('common.error')}</Notice>
      ) : records.data.length === 0 ? (
        <Text variant="caption">{t('progress.records.empty')}</Text>
      ) : (
        <View className="gap-3">
          {records.data.map((r) => (
            <RecordRow key={r.id} record={r} />
          ))}
        </View>
      )}
    </Screen>
  );
}
