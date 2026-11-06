import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ProgressBar, Sheet, Text } from '@/components/ui';
import { useUserId } from '@/features/auth/store';
import { ExerciseMedia } from '@/features/session/ExerciseMedia';
import { currentSetIndex, formatClock, type SessionExercise } from '@/features/session/logic';
import { PainSheet } from '@/features/session/PainSheet';
import { RestTimer } from '@/features/session/RestTimer';
import { SetRow } from '@/features/session/SetRow';
import { useSession } from '@/features/session/store';
import { SwapSheet } from '@/features/session/SwapSheet';
import { supabase } from '@/lib/supabase';
import { formatWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

import type { SwapReason } from '@coach/swap';

type Panel = null | 'leave' | 'pain' | { swap: SwapReason | undefined };

/** The session in progress: one exercise at a time, sets logged in one tap, rest timer. */
export default function SessionScreen() {
  const { t, i18n } = useTranslation();
  const userId = useUserId();
  const active = useSession((s) => (s.active?.userId === userId ? s.active : null));
  const { goTo, updateSet, completeSet, reopenSet, addSet, removeLastSet, clear } = useSession();
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const focused = useIsFocused();

  // Once the end screen saves the session, it's cleared: only redirect if this screen is shown.
  if (!active) return focused ? <Redirect href="/" /> : null;

  const index = active.currentIndex;
  const exercise = active.exercises[index]!;
  const name = i18n.language.startsWith('fr') ? exercise.nameFr : exercise.nameEn;
  const pending = currentSetIndex(exercise);
  const isLast = index === active.exercises.length - 1;
  const doneExercises = active.exercises.filter((e) => currentSetIndex(e) === -1).length;

  const abandon = () => {
    const workoutId = active.workoutId;
    clear();
    if (workoutId) {
      void supabase.from('workouts').update({ status: 'planned' }).eq('id', workoutId);
    }
    router.replace('/');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50 dark:bg-ink-950">
      {Platform.OS !== 'web' ? <KeepAwake /> : null}
      <View className="flex-row items-center gap-2 px-3 pt-1">
        <Pressable
          onPress={() => setPanel('leave')}
          accessibilityRole="button"
          accessibilityLabel={t('session.leave')}
          className="h-12 w-12 items-center justify-center"
        >
          <Ionicons name="close" size={28} color={colors.ink[500]} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-bold" numberOfLines={1}>
            {active.title}
          </Text>
          <Text variant="caption">
            {t('session.exerciseOf', { current: index + 1, total: active.exercises.length })}
          </Text>
        </View>
        <ElapsedClock startedAt={active.startedAt} />
      </View>
      <View className="px-5 pb-2 pt-2">
        <ProgressBar value={doneExercises / active.exercises.length} />
      </View>

      {/* Keyed by exercise: switching exercise starts at the top (media first). */}
      <ScrollView
        key={`${index}-${exercise.exerciseId}`}
        contentContainerClassName="gap-5 px-5 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <ExerciseMedia exercise={exercise} name={name} />
        <View className="gap-2">
          <Text variant="title" accessibilityRole="header">
            {name}
          </Text>
          <TargetLine exercise={exercise} />
          <LastTime exercise={exercise} />
          {exercise.notes ? <Text variant="caption">{exercise.notes}</Text> : null}
        </View>

        <View className="flex-row gap-3">
          <ActionChip
            icon="swap-horizontal"
            label={t('session.swap.action')}
            onPress={() => setPanel({ swap: undefined })}
          />
          <ActionChip
            icon="medkit-outline"
            label={t('session.pain.action')}
            onPress={() => setPanel('pain')}
          />
        </View>

        <View className="gap-2">
          {exercise.sets.map((s, i) => (
            <SetRow
              key={`${exercise.exerciseId}-${s.setNumber}`}
              set={s}
              timed={!!exercise.targetDurationSec}
              active={i === pending}
              onChange={(patch) => updateSet(index, i, patch)}
              onComplete={() => completeSet(index, i)}
              onReopen={() => reopenSet(index, i)}
            />
          ))}
          <View className="flex-row justify-center gap-6">
            <SmallLink icon="add" label={t('session.addSet')} onPress={() => addSet(index)} />
            {exercise.sets.length > 1 && !exercise.sets.at(-1)?.done ? (
              <SmallLink
                icon="remove"
                label={t('session.removeSet')}
                onPress={() => removeLastSet(index)}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View className="gap-3 border-t border-ink-100 px-5 pb-2 pt-3 dark:border-ink-800">
        <RestTimer />
        <View className="flex-row gap-3">
          {index > 0 ? (
            <Pressable
              onPress={() => goTo(index - 1)}
              accessibilityRole="button"
              accessibilityLabel={t('session.previous')}
              className="h-14 w-14 items-center justify-center rounded-2xl border border-ink-300 active:opacity-70 dark:border-ink-700"
            >
              <Ionicons name="chevron-back" size={24} color={colors.ink[500]} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <Button
              variant={pending === -1 ? 'primary' : 'secondary'}
              label={isLast ? t('session.finish') : t('session.nextExercise')}
              onPress={() => (isLast ? router.push('/session/done') : goTo(index + 1))}
            />
          </View>
        </View>
      </View>

      <Sheet
        visible={panel === 'leave'}
        title={t('session.leaveTitle')}
        onClose={() => (setPanel(null), setConfirmAbandon(false))}
      >
        <Text>{t('session.leaveBody')}</Text>
        <Button label={t('session.keepGoing')} onPress={() => setPanel(null)} />
        <Button
          variant="secondary"
          label={t('session.leave')}
          onPress={() => (setPanel(null), router.replace('/'))}
        />
        {confirmAbandon ? <Text variant="error">{t('session.abandonConfirm')}</Text> : null}
        <Button
          variant="secondary"
          label={t('session.abandon')}
          onPress={() => (confirmAbandon ? abandon() : setConfirmAbandon(true))}
        />
      </Sheet>

      <PainSheet
        visible={panel === 'pain'}
        onClose={() => setPanel(null)}
        exercise={exercise}
        onReplace={() => setPanel({ swap: 'pain' })}
        onStop={() => router.push('/session/done')}
      />
      {panel !== null && typeof panel === 'object' ? (
        <SwapSheet
          visible
          onClose={() => setPanel(null)}
          exerciseIndex={index}
          exercise={exercise}
          initialReason={panel.swap}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** The screen stays on between sets (native; the web wake lock is unreliable). */
function KeepAwake() {
  useKeepAwake();
  return null;
}

function ElapsedClock({ startedAt }: { startedAt: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = formatClock((now - new Date(startedAt).getTime()) / 1000);
  return (
    <Text
      variant="caption"
      className="font-semibold"
      accessibilityLabel={t('session.elapsed', { time })}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {time}
    </Text>
  );
}

function TargetLine({ exercise }: { exercise: SessionExercise }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const parts = [
    exercise.targetDurationSec
      ? t('workout.hold', { sets: exercise.targetSets, seconds: exercise.targetDurationSec })
      : t('workout.sets', { sets: exercise.targetSets, reps: exercise.targetReps }),
    exercise.suggestedLoadKg
      ? formatWeight(exercise.suggestedLoadKg, unit, i18n.language)
      : t('workout.bodyweight'),
    exercise.tempo ? t('workout.tempo', { tempo: exercise.tempo }) : null,
    t('workout.rest', { seconds: exercise.restSec }),
    exercise.targetRpe != null ? t('workout.rpe', { rpe: exercise.targetRpe }) : null,
  ].filter(Boolean);
  return (
    <Text className="font-semibold">
      {t('session.target')} : {parts.join(' · ')}
    </Text>
  );
}

function LastTime({ exercise }: { exercise: SessionExercise }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  if (exercise.previous.length === 0) {
    return <Text variant="caption">{t('session.noLast')}</Text>;
  }
  const value = exercise.previous
    .map((p) => {
      const amount = p.duration_sec ? `${p.duration_sec} s` : `${p.reps ?? 0}`;
      return p.load_kg ? `${amount} × ${formatWeight(p.load_kg, unit, i18n.language)}` : amount;
    })
    .join(', ');
  return <Text variant="caption">{t('session.last', { value })}</Text>;
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-ink-300 active:opacity-70 dark:border-ink-700"
    >
      <Ionicons name={icon} size={20} color={colors.ink[500]} />
      <Text className="font-semibold">{label}</Text>
    </Pressable>
  );
}

function SmallLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-12 flex-row items-center gap-1 px-2 active:opacity-70"
    >
      <Ionicons name={icon} size={18} color={colors.ink[500]} />
      <Text variant="caption" className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
