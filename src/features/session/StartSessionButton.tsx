import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice } from '@/components/ui';
import { useUserId } from '@/features/auth/store';
import type { WorkoutWithExercises } from '@/features/program/api';

import { useStartSession } from './api';
import { useSession } from './store';

/** "Commencer" on a planned session, or "Reprendre" when a session is already in progress. */
export function StartSessionButton({ workout }: { workout: WorkoutWithExercises }) {
  const { t } = useTranslation();
  const userId = useUserId();
  const active = useSession((s) => (s.active?.userId === userId ? s.active : null));
  const start = useStartSession();

  if (active) {
    return (
      <View className="gap-3">
        {active.workoutId !== workout.id ? (
          <Notice tone="warning">{t('session.otherActive')}</Notice>
        ) : null}
        <Button label={t('session.resume')} onPress={() => router.push('/session')} />
      </View>
    );
  }

  return (
    <View className="gap-3">
      {start.isError ? <Notice tone="danger">{t('session.startError')}</Notice> : null}
      <Button
        label={t('workout.start')}
        loading={start.isPending}
        disabled={workout.workout_exercises.length === 0}
        onPress={() => start.mutate(workout, { onSuccess: () => router.push('/session') })}
      />
    </View>
  );
}
