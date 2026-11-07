import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { localDate } from '@/features/program/api';
import { colors } from '@/theme/tokens';
import type { Workout } from '@/types/models';

import type { Adaptation } from '@coach/reports';

import { useAdaptWeek, useReports } from './api';
import { weekToAdapt } from './logic';

/** Weeks already asked during this app run, so remounting Today never asks twice. */
const asked = new Set<string>();

/**
 * Before a new program week, asks the coach once to adjust it (§3.6), then shows its message
 * with a link to the changes. Silent when nothing is due or the request fails.
 */
export function AdaptationCard({
  programId,
  workouts,
}: {
  programId: string;
  workouts: Workout[];
}) {
  const { t } = useTranslation();
  const reports = useReports();
  const adapt = useAdaptWeek();
  const { colorScheme } = useColorScheme();
  const due = weekToAdapt(workouts, localDate());
  const report = due
    ? reports.data?.find((r) => r.report_type === 'adaptation' && r.period_start === due.start)
    : undefined;
  const key = due ? `${programId}:${due.start}` : null;
  const { mutate } = adapt; // stable across renders (TanStack Query)

  useEffect(() => {
    if (!key || !reports.isSuccess || report || asked.has(key)) return;
    asked.add(key);
    mutate();
  }, [key, reports.isSuccess, report, mutate]);

  if (!due) return null;
  if (adapt.isPending && !report) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-ink-900">
        <ActivityIndicator color={colors.ink[500]} />
        <Text variant="caption">{t('coach.adapt.loading')}</Text>
      </View>
    );
  }
  if (!report) return null;
  const p = report.payload as Adaptation;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/coach/report/[id]', params: { id: report.id } })}
      className="gap-2 rounded-2xl border border-accent bg-white p-4 dark:bg-ink-900"
    >
      <Text variant="caption">
        {t(`coach.reports.weekDecision.${p.decision_semaine}`)} ·{' '}
        {t('coach.reports.titles.adaptation', { week: due.week })}
      </Text>
      <Text className="font-bold">{t('coach.adapt.title')}</Text>
      <Text>{p.message_coach}</Text>
      <Text
        className="font-bold"
        style={{ color: colorScheme === 'light' ? colors.chart.light : colors.chart.dark }}
      >
        {t('coach.adapt.see')} ({p.ajustements.length})
      </Text>
    </Pressable>
  );
}
