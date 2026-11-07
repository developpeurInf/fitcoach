import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Notice, Text } from '@/components/ui';
import { FunctionError } from '@/lib/functions';
import { colors } from '@/theme/tokens';

import { PERIODIC_TYPES, type PeriodicType } from '@coach/reports';

import { useGenerateReport, useReports } from './api';
import { reportPeriodLabel, reportTitle } from './ReportView';

/** "Bilans" tab: ask for a periodic report, then the list of every report, newest first. */
export function ReportsList() {
  const { t } = useTranslation();
  const reports = useReports();
  const generate = useGenerateReport();
  const [asked, setAsked] = useState<PeriodicType | null>(null);

  const ask = (type: PeriodicType) => {
    setAsked(type);
    generate.mutate(type, {
      onSuccess: ({ report }) =>
        router.push({ pathname: '/coach/report/[id]', params: { id: report.id } }),
    });
  };
  const err = generate.error;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-6">
      <View className="gap-2">
        <Text variant="heading">{t('coach.reports.generate')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {PERIODIC_TYPES.map((type) => {
            const busy = generate.isPending && asked === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ busy, disabled: generate.isPending }}
                disabled={generate.isPending}
                onPress={() => ask(type)}
                className="min-h-12 flex-row items-center gap-2 rounded-2xl bg-ink-100 px-4 dark:bg-ink-800"
              >
                {busy ? <ActivityIndicator color={colors.ink[500]} /> : null}
                <Text className="font-bold">{t(`coach.reports.types.${type}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        {generate.isPending ? <Text variant="caption">{t('coach.reports.generating')}</Text> : null}
        {err ? (
          <Notice tone="warning">
            {err instanceof FunctionError &&
            (err.code === 'bad_request' || err.code === 'rate_limited')
              ? err.message
              : t('coach.reports.error')}
          </Notice>
        ) : null}
      </View>

      {reports.data?.length === 0 ? (
        <Text variant="caption">{t('coach.reports.empty')}</Text>
      ) : null}
      {reports.data?.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/coach/report/[id]', params: { id: r.id } })}
          className="flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-ink-900"
        >
          <View className="flex-1 gap-0.5">
            <Text variant="caption">{t(`coach.reports.types.${r.report_type}`)}</Text>
            <Text className="font-bold">{reportTitle(r, t)}</Text>
            <Text variant="caption">{reportPeriodLabel(r, t)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.ink[500]} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
