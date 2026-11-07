import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { TimeChart } from '@/components/charts/TimeChart';
import { Button, Notice, Screen, Segmented, Text } from '@/components/ui';
import { localDate } from '@/features/program/api';
import {
  useDailyTraining,
  useMeasurements,
  usePlannedWorkouts,
  useRecords,
  useStreakWorkouts,
} from '@/features/progress/api';
import { ChartCard, StatTile } from '@/features/progress/Cards';
import {
  adherenceByBucket,
  aggregateTraining,
  bucketLabel,
  buildBuckets,
  currentStreak,
  type Granularity,
  GRANULARITIES,
  rangeOf,
  ratio,
  seriesByBucket,
  trend,
} from '@/features/progress/logic';
import { MeasurementsChart, OneRmChart } from '@/features/progress/Charts';
import { RecordRow } from '@/features/progress/RecordRow';
import { displayWeight, kgToLb } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

/** Progress dashboard: period filter, headline numbers, charts, latest records. */
export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const [granularity, setGranularity] = useState<Granularity>('week');
  const today = localDate();
  const buckets = useMemo(() => buildBuckets(granularity, today), [granularity, today]);
  const { from, to } = rangeOf(buckets);
  const labels = buckets.map((b) => bucketLabel(b, granularity, i18n.language));

  const training = useDailyTraining(from, to);
  const planned = usePlannedWorkouts(from, to);
  const streakRows = useStreakWorkouts(today);
  const measurements = useMeasurements();
  const records = useRecords();

  const totals = useMemo(
    () => aggregateTraining(training.data ?? [], buckets),
    [training.data, buckets],
  );
  const adherence = useMemo(
    () => adherenceByBucket(planned.data ?? [], buckets, today),
    [planned.data, buckets, today],
  );
  const volume = totals.map((x) => (x.volumeKg > 0 ? displayWeight(x.volumeKg, unit) : null));
  const adherencePct = adherence.map(ratio);
  const current = totals.at(-1)!;
  const currentAdherence = adherence.at(-1)!;
  const streak = currentStreak(streakRows.data ?? [], today);
  const period = t(`progress.periodNames.${granularity}`);
  const n = (v: number) => Math.round(v).toLocaleString(i18n.language);
  const volumeTrend = trend(totals.map((x) => x.volumeKg || null));

  const loading = training.isPending || planned.isPending;
  const failed = training.isError || planned.isError;

  return (
    <Screen>
      <View className="mb-4 mt-4 flex-row items-center justify-between">
        <Text variant="title">{t('progress.title')}</Text>
        <Pressable
          onPress={() => router.push('/progress/measurements')}
          accessibilityRole="button"
          accessibilityLabel={t('progress.measure.history')}
          className="h-12 w-12 items-center justify-center"
        >
          <Ionicons name="body-outline" size={24} color={colors.ink[500]} />
        </Pressable>
      </View>

      <View className="gap-5">
        <View className="gap-2">
          <Segmented
            options={GRANULARITIES.map((g) => ({ value: g, label: t(`progress.periods.${g}`) }))}
            value={granularity}
            onChange={setGranularity}
            accessibilityLabel={t('progress.title')}
          />
          <Text variant="caption">{t(`progress.periodHint.${granularity}`)}</Text>
        </View>

        {failed ? (
          <View className="gap-3">
            <Notice tone="danger">{t('common.error')}</Notice>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => (void training.refetch(), void planned.refetch())}
            />
          </View>
        ) : loading ? (
          <ActivityIndicator className="mt-10" color={colors.accent.DEFAULT} />
        ) : (
          <>
            <View>
              <Text variant="caption" className="mb-2 font-semibold uppercase tracking-wide">
                {t(`progress.current.${granularity}`)}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <StatTile label={t('progress.kpi.sessions')} value={String(current.sessions)} />
                <StatTile
                  label={t('progress.kpi.volume')}
                  value={`${n(displayWeight(current.volumeKg, unit))} ${unit}`}
                  hint={
                    volumeTrend != null
                      ? t('progress.kpi.vsPrevious', {
                          value: `${volumeTrend > 0 ? '+' : ''}${volumeTrend}`,
                        })
                      : null
                  }
                />
                <StatTile
                  label={t('progress.kpi.adherence')}
                  value={ratio(currentAdherence) != null ? `${ratio(currentAdherence)} %` : '–'}
                  hint={
                    currentAdherence.planned
                      ? t('progress.charts.adherenceDetail', currentAdherence)
                      : null
                  }
                />
                <StatTile
                  label={t('progress.kpi.streak')}
                  value={t('progress.kpi.streakValue', { count: streak })}
                  hint={t('progress.kpi.streakHint')}
                />
              </View>
            </View>

            <ChartCard
              title={t('progress.charts.volume')}
              subtitle={t('progress.charts.volumeBy', { period })}
            >
              <TimeChart
                kind="bar"
                labels={labels}
                values={volume}
                format={(v) => `${n(v)} ${unit}`}
                title={t('progress.charts.volumeBy', { period })}
              />
            </ChartCard>

            <ChartCard
              title={t('progress.charts.adherence')}
              subtitle={t('progress.charts.adherenceBy', { period })}
            >
              <TimeChart
                kind="bar"
                labels={labels}
                values={adherencePct}
                format={(v) => `${Math.round(v)} %`}
                title={t('progress.charts.adherenceBy', { period })}
                detail={(i) =>
                  adherence[i]!.planned ? t('progress.charts.adherenceDetail', adherence[i]!) : null
                }
              />
            </ChartCard>

            <OneRmChart labels={labels} buckets={buckets} />

            <ChartCard title={t('progress.charts.weight')}>
              <TimeChart
                kind="line"
                labels={labels}
                values={seriesByBucket(
                  (measurements.data ?? []).map((m) => ({
                    day: m.measured_on,
                    value:
                      m.weight_kg != null
                        ? unit === 'kg'
                          ? m.weight_kg
                          : kgToLb(m.weight_kg)
                        : null,
                  })),
                  buckets,
                  'avg',
                )}
                format={(v) =>
                  `${v.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} ${unit}`
                }
                title={t('progress.charts.weight')}
              />
              <Button
                variant="secondary"
                label={t('progress.measure.add')}
                onPress={() => router.push('/progress/measure')}
              />
            </ChartCard>

            <MeasurementsChart
              labels={labels}
              buckets={buckets}
              measurements={measurements.data ?? []}
            />

            <View className="gap-3">
              <Text variant="heading">{t('progress.records.title')}</Text>
              {records.data?.length ? (
                <>
                  {records.data.slice(0, 3).map((r) => (
                    <RecordRow key={r.id} record={r} />
                  ))}
                  <Button
                    variant="secondary"
                    label={t('progress.records.seeAll')}
                    onPress={() => router.push('/progress/records')}
                  />
                </>
              ) : (
                <Text variant="caption">{t('progress.records.empty')}</Text>
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
