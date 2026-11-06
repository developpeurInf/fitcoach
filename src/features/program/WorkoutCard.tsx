import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { formatDayLong } from '@/lib/dates';
import type { Workout } from '@/types/models';

import { WeekTypeBadge } from './WeekTypeBadge';

type Props = { workout: Workout; exerciseCount?: number; label?: string; primary?: boolean };

/** Big, tappable summary of a session: title, date, duration, week type, main action. */
export function WorkoutCard({ workout, exerciseCount, label, primary = true }: Props) {
  const { t } = useTranslation();
  return (
    <View className="gap-4 rounded-2xl border border-ink-100 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <View className="gap-2">
        {label ? (
          <Text variant="caption" className="font-semibold uppercase tracking-wide">
            {label}
          </Text>
        ) : null}
        <Text variant="heading">{workout.title}</Text>
        <Text variant="caption">
          {formatDayLong(workout.scheduled_date)} ·{' '}
          {t('workout.minutes', { count: workout.estimated_minutes ?? 0 })}
          {exerciseCount ? ` · ${t('workout.exercises', { count: exerciseCount })}` : ''}
        </Text>
        <View className="flex-row gap-2">
          <WeekTypeBadge type={workout.week_type} />
          <View className="self-start rounded-full bg-ink-100 px-3 py-1 dark:bg-ink-800">
            <Text variant="caption" className="font-semibold">
              {t('program.week', { n: workout.week_number })}
            </Text>
          </View>
        </View>
      </View>
      {workout.motivation_message ? <Text>{workout.motivation_message}</Text> : null}
      <Button
        variant={primary ? 'primary' : 'secondary'}
        label={primary ? t('workout.start') : t('workout.view')}
        onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
      />
    </View>
  );
}
