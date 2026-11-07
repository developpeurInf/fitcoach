import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Notice, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import type { SessionReport } from '@coach/reports';

import { useSessionReport } from './api';
import { SessionBody } from './ReportView';

/** "Le mot du coach" under the end-of-session screen; the session is already saved. */
export function SessionReportCard({ logId }: { logId: string }) {
  const { t } = useTranslation();
  const report = useSessionReport(logId);
  return (
    <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-ink-900">
      <Text variant="heading">{t('coach.session.title')}</Text>
      {report.isPending ? (
        <View className="flex-row items-center gap-3">
          <ActivityIndicator color={colors.ink[500]} />
          <Text variant="caption">{t('coach.session.loading')}</Text>
        </View>
      ) : null}
      {report.error ? <Notice tone="warning">{t('coach.session.error')}</Notice> : null}
      {report.data ? <SessionBody p={report.data.payload as SessionReport} /> : null}
    </View>
  );
}
