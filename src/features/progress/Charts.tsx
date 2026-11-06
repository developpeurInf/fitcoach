import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TimeChart } from '@/components/charts/TimeChart';
import { ChipGroup, Text } from '@/components/ui';
import { displayWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import type { BodyMeasurement } from '@/types/models';

import { useExerciseBest, useLoggedExercises } from './api';
import { ChartCard } from './Cards';
import { type Bucket, rangeOf, seriesByBucket } from './logic';
import { MEASURE_FIELDS, type MeasureField } from './measurement';

type Props = { labels: string[]; buckets: Bucket[] };

const decimal = (v: number, locale: string) =>
  v.toLocaleString(locale, { maximumFractionDigits: 1 });

/** Estimated 1RM (best of each period) for one of the user's most worked exercises. */
export function OneRmChart({ labels, buckets }: Props) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const exercises = useLoggedExercises();
  const [picked, setPicked] = useState<string>();
  const exerciseId = picked ?? exercises.data?.[0]?.id;
  const { from, to } = rangeOf(buckets);
  const best = useExerciseBest(exerciseId, from, to);
  const options = (exercises.data ?? []).slice(0, 6);

  return (
    <ChartCard title={t('progress.charts.oneRm')} subtitle={t('progress.charts.oneRmHint')}>
      {options.length === 0 ? (
        <Text variant="caption">{t('progress.charts.noExercise')}</Text>
      ) : (
        <>
          <ChipGroup
            options={options.map((e) => ({
              value: e.id,
              label: i18n.language.startsWith('fr') ? e.nameFr : e.nameEn,
            }))}
            value={exerciseId}
            onChange={setPicked}
            accessibilityLabel={t('progress.charts.oneRm')}
          />
          <TimeChart
            kind="line"
            labels={labels}
            values={seriesByBucket(
              (best.data ?? []).map((d) => ({ day: d.day, value: d.best_1rm_kg })),
              buckets,
              'max',
            ).map((v) => (v == null ? null : displayWeight(v, unit)))}
            format={(v) => `${decimal(v, i18n.language)} ${unit}`}
            title={t('progress.charts.oneRm')}
          />
        </>
      )}
    </ChartCard>
  );
}

/** Body measurements, one metric at a time (one series per chart, one axis). */
export function MeasurementsChart({
  labels,
  buckets,
  measurements,
}: Props & { measurements: BodyMeasurement[] }) {
  const { t, i18n } = useTranslation();
  const [metric, setMetric] = useState<MeasureField>('waist_cm');
  const suffix = metric === 'body_fat_pct' ? '%' : 'cm';
  return (
    <ChartCard title={t('progress.charts.measurements')}>
      <ChipGroup
        options={MEASURE_FIELDS.map((f) => ({ value: f, label: t(`progress.metrics.${f}`) }))}
        value={metric}
        onChange={setMetric}
        accessibilityLabel={t('progress.charts.measurements')}
      />
      <TimeChart
        kind="line"
        labels={labels}
        values={seriesByBucket(
          measurements.map((m) => ({ day: m.measured_on, value: m[metric] })),
          buckets,
          'avg',
        )}
        format={(v) => `${decimal(v, i18n.language)} ${suffix}`}
        title={t(`progress.metrics.${metric}`)}
      />
    </ChartCard>
  );
}
