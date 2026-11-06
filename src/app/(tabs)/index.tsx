import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, EmptyState, Notice, Screen, Text } from '@/components/ui';
import { localDate, useActiveProgram, useProgramWorkouts } from '@/features/program/api';
import { GenerateProgram } from '@/features/program/GenerateProgram';
import { WorkoutCard } from '@/features/program/WorkoutCard';
import { useProfile } from '@/features/profile/api';
import { colors } from '@/theme/tokens';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const program = useActiveProgram();
  const workouts = useProgramWorkouts(program.data?.id);

  const today = localDate();
  const todayWorkout = workouts.data?.find((w) => w.scheduled_date === today);
  const next = workouts.data?.find((w) => w.scheduled_date > today && w.status === 'planned');
  const warnings =
    (program.data?.ai_payload as { avertissements?: string[] } | null)?.avertissements ?? [];

  return (
    <Screen>
      <View className="mb-6 mt-4 flex-row items-center justify-between">
        <View>
          <Text variant="title">{t('today.title')}</Text>
          {profile?.first_name ? (
            <Text variant="caption">{t('today.hello', { name: profile.first_name })}</Text>
          ) : null}
        </View>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            className="h-12 w-12 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={24} color={colors.ink[500]} />
          </Pressable>
        </Link>
      </View>

      {program.isPending || (program.data && workouts.isPending) ? (
        <ActivityIndicator className="mt-16" color={colors.accent.DEFAULT} />
      ) : program.isError || workouts.isError ? (
        <View className="gap-3">
          <Notice tone="danger">{t('common.error')}</Notice>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void program.refetch()}
          />
        </View>
      ) : !program.data ? (
        <GenerateProgram />
      ) : (
        <View className="gap-5">
          {warnings.length ? (
            <Notice tone="warning" title={t('program.warningsTitle')}>
              {warnings.join('\n')}
            </Notice>
          ) : null}
          {todayWorkout ? (
            <WorkoutCard workout={todayWorkout} label={t('today.todaySession')} />
          ) : (
            <EmptyState icon="moon" title={t('workout.restDay')} body={t('workout.restDayBody')} />
          )}
          {next && next.id !== todayWorkout?.id ? (
            <WorkoutCard workout={next} label={t('workout.next')} primary={false} />
          ) : null}
          {!todayWorkout && !next ? <Notice>{t('workout.programDone')}</Notice> : null}
        </View>
      )}
    </Screen>
  );
}
