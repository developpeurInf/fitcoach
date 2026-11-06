import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { Button, Notice, Screen, Text } from '@/components/ui';
import { useDeleteMeasurement, useMeasurements, usePhotoUrl } from '@/features/progress/api';
import { BackHeader } from '@/features/progress/BackHeader';
import { MEASURE_FIELDS } from '@/features/progress/measurement';
import { formatDayLong } from '@/lib/dates';
import { formatBodyWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types/models';

/** History of measurements, newest first, with the private progress photos. */
export default function MeasurementsScreen() {
  const { t } = useTranslation();
  const measurements = useMeasurements();
  const photos = (measurements.data ?? []).filter((m) => m.photo_path);

  return (
    <Screen>
      <BackHeader title={t('progress.measure.history')} />
      <View className="gap-5">
        <Button
          label={t('progress.measure.add')}
          onPress={() => router.push('/progress/measure')}
        />
        {measurements.isPending ? (
          <ActivityIndicator className="mt-10" color={colors.accent.DEFAULT} />
        ) : measurements.isError ? (
          <Notice tone="danger">{t('common.error')}</Notice>
        ) : measurements.data.length === 0 ? (
          <Text variant="caption">{t('progress.measure.emptyHistory')}</Text>
        ) : (
          <>
            {photos.length ? (
              <View className="gap-3">
                <Text variant="heading">{t('progress.measure.photos')}</Text>
                <View className="flex-row flex-wrap gap-3">
                  {photos.map((m) => (
                    <Photo key={m.id} measurement={m} />
                  ))}
                </View>
                <Text variant="caption">{t('progress.measure.privacy')}</Text>
              </View>
            ) : null}
            <View className="gap-3">
              {measurements.data.map((m) => (
                <MeasurementRow key={m.id} m={m} />
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function Photo({ measurement }: { measurement: BodyMeasurement }) {
  const { t } = useTranslation();
  const url = usePhotoUrl(measurement.photo_path);
  return (
    <View className="w-[30%] gap-1">
      <View className="aspect-[3/4] overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800">
        {url.data ? (
          <Image
            source={{ uri: url.data }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={`${t('progress.measure.photo')}, ${formatDayLong(measurement.measured_on)}`}
          />
        ) : null}
      </View>
      <Text variant="caption">
        {measurement.measured_on.split('-').reverse().slice(0, 2).join('/')}
      </Text>
    </View>
  );
}

const SHORT = {
  waist_cm: 'waist',
  chest_cm: 'chest',
  hips_cm: 'hips',
  arm_cm: 'arm',
  thigh_cm: 'thigh',
  body_fat_pct: 'bodyFat',
} as const;

function MeasurementRow({ m }: { m: BodyMeasurement }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const remove = useDeleteMeasurement();
  const [confirm, setConfirm] = useState(false);
  const parts = [
    m.weight_kg != null
      ? `${t('progress.measure.weight')} ${formatBodyWeight(m.weight_kg, unit, i18n.language)}`
      : null,
    ...MEASURE_FIELDS.map((f) =>
      m[f] != null
        ? `${t(`progress.measure.${SHORT[f]}`)} ${Number(m[f]).toLocaleString(i18n.language)} ${f === 'body_fat_pct' ? '%' : 'cm'}`
        : null,
    ),
  ].filter(Boolean);

  return (
    <View className="gap-2 rounded-2xl bg-white p-4 dark:bg-ink-900">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold">{formatDayLong(m.measured_on)}</Text>
        <Pressable
          onPress={() => (confirm ? remove.mutate(m) : setConfirm(true))}
          accessibilityRole="button"
          accessibilityLabel={
            confirm ? t('progress.measure.deleteConfirm') : t('progress.measure.delete')
          }
          className="min-h-12 flex-row items-center gap-1 px-2"
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={confirm ? colors.danger : colors.ink[500]}
          />
          {confirm ? <Text variant="error">{t('progress.measure.deleteConfirm')}</Text> : null}
        </Pressable>
      </View>
      {parts.length ? <Text variant="caption">{parts.join(' · ')}</Text> : null}
      {m.photo_path ? (
        <View className="flex-row items-center gap-1">
          <Ionicons name="image-outline" size={16} color={colors.ink[500]} />
          <Text variant="caption">{t('progress.measure.photo')}</Text>
        </View>
      ) : null}
      {m.notes ? <Text variant="caption">{m.notes}</Text> : null}
    </View>
  );
}
