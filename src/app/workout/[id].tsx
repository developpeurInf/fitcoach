import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { Button, Notice, Screen, Text } from '@/components/ui';
import { useWorkout, type WorkoutWithExercises } from '@/features/program/api';
import { WeekTypeBadge } from '@/features/program/WeekTypeBadge';
import { formatDayLong } from '@/lib/dates';
import { displayWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

/** Session detail: warm-up, exercises (media, sets × reps, load, tempo, rest, RPE), cool-down. */
export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.back')}
        className="mt-2 h-12 w-12 justify-center"
      >
        <Ionicons name="chevron-back" size={28} color={colors.ink[500]} />
      </Pressable>
      {workout.isPending ? (
        <ActivityIndicator className="mt-16" color={colors.accent.DEFAULT} />
      ) : workout.isError ? (
        <Notice tone="danger">{t('workout.notFound')}</Notice>
      ) : (
        <WorkoutDetail workout={workout.data} />
      )}
    </Screen>
  );
}

function WorkoutDetail({ workout }: { workout: WorkoutWithExercises }) {
  const { t } = useTranslation();
  return (
    <View className="gap-6 pb-6">
      <View className="gap-2">
        <Text variant="title">{workout.title}</Text>
        <Text variant="caption">
          {formatDayLong(workout.scheduled_date)} ·{' '}
          {t('workout.minutes', { count: workout.estimated_minutes ?? 0 })}
        </Text>
        <WeekTypeBadge type={workout.week_type} />
        {workout.motivation_message ? (
          <Text className="mt-2">{workout.motivation_message}</Text>
        ) : null}
      </View>

      <TimedList title={t('workout.warmup')} items={workout.warmup as TimedItem[]} />

      <View className="gap-3">
        <Text variant="heading">
          {t('workout.exercises', { count: workout.workout_exercises.length })}
        </Text>
        {workout.workout_exercises.map((e) => (
          <ExerciseRow key={e.id} item={e} />
        ))}
      </View>

      <TimedList title={t('workout.cooldown')} items={workout.cooldown as TimedItem[]} />

      <View className="gap-2">
        <Button label={t('workout.start')} disabled onPress={() => undefined} />
        <Text variant="caption" className="text-center">
          {t('workout.comingSoon')}
        </Text>
      </View>
    </View>
  );
}

type TimedItem = { nom: string; duree_sec: number };

function TimedList({ title, items }: { title: string; items: TimedItem[] }) {
  if (!items?.length) return null;
  return (
    <View className="gap-2">
      <Text variant="heading">{title}</Text>
      {items.map((it, i) => (
        <View
          key={i}
          className="flex-row justify-between rounded-xl bg-ink-100 px-4 py-3 dark:bg-ink-900"
        >
          <Text className="flex-1">{it.nom}</Text>
          <Text variant="caption">
            {it.duree_sec >= 60 ? `${Math.round(it.duree_sec / 60)} min` : `${it.duree_sec} s`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ExerciseRow({ item }: { item: WorkoutWithExercises['workout_exercises'][number] }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const name =
    (i18n.language === 'fr' ? item.exercise?.name_fr : item.exercise?.name_en) ?? item.exercise_id;
  const image = item.exercise?.image_urls[0];
  const volume = item.duration_sec
    ? t('workout.hold', { sets: item.sets, seconds: item.duration_sec })
    : t('workout.sets', { sets: item.sets, reps: item.reps });
  const load =
    item.suggested_load_kg != null && item.suggested_load_kg > 0
      ? `${displayWeight(item.suggested_load_kg, unit)} ${unit}`
      : t('workout.bodyweight');
  const meta = [
    item.rest_sec != null ? t('workout.rest', { seconds: item.rest_sec }) : null,
    item.tempo ? t('workout.tempo', { tempo: item.tempo }) : null,
    item.target_rpe != null ? t('workout.rpe', { rpe: item.target_rpe }) : null,
  ].filter(Boolean);

  return (
    <View className="flex-row gap-4 rounded-2xl border border-ink-100 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
      <View className="h-20 w-20 overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800">
        {image ? (
          <Image
            source={{ uri: image }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="barbell" size={28} color={colors.ink[500]} />
          </View>
        )}
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-bold">
          {item.position}. {name}
        </Text>
        <Text className="font-semibold">
          {volume} · {load}
        </Text>
        <Text variant="caption">{meta.join(' · ')}</Text>
        {item.notes ? <Text variant="caption">{item.notes}</Text> : null}
      </View>
    </View>
  );
}
