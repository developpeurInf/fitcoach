import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Notice, Screen, Text } from '@/components/ui';
import { useReport } from '@/features/coach/api';
import { reportPeriodLabel, reportTitle, ReportView } from '@/features/coach/ReportView';
import { BackHeader } from '@/features/progress/BackHeader';

export default function ReportScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useReport(id);
  return (
    <Screen>
      <BackHeader
        title={report.data ? reportTitle(report.data, t) : t('coach.tabs.reports')}
        fallback="/coach"
      />
      {report.isPending ? <ActivityIndicator /> : null}
      {report.error ? <Notice tone="warning">{t('coach.reports.error')}</Notice> : null}
      {report.data ? (
        <>
          <Text variant="caption" className="-mt-2 mb-4">
            {reportPeriodLabel(report.data, t)}
          </Text>
          <ReportView report={report.data} />
        </>
      ) : null}
    </Screen>
  );
}
