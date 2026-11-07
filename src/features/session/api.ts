import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { localDate, type WorkoutWithExercises } from '@/features/program/api';
import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { PersonalRecord } from '@/types/models';

import type { SwapReason } from '@coach/swap';

import {
  type Feedback,
  lastPerformance,
  type PreviousSet,
  type SessionExercise,
  toFinishPayload,
  toSessionExercise,
} from './logic';
import { type ActiveSession, useSession } from './store';

/** Sets of the last session where each exercise was done (warm-up sets excluded). */
export async function fetchLastPerformance(
  exerciseIds: string[],
): Promise<Record<string, PreviousSet[]>> {
  if (exerciseIds.length === 0) return {};
  const { data, error } = await supabase
    .from('set_logs')
    .select('exercise_id, workout_log_id, set_number, reps, load_kg, duration_sec, rpe')
    .in('exercise_id', exerciseIds)
    .eq('is_warmup', false)
    .order('performed_at', { ascending: false })
    .limit(exerciseIds.length * 20);
  if (error) throw error;
  return lastPerformance(data);
}

/** Builds the session from the plan and the last performance, then marks the workout started. */
export function useStartSession() {
  const userId = useUserId();
  const start = useSession((s) => s.start);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workout: WorkoutWithExercises) => {
      const previous = await fetchLastPerformance([
        ...new Set(workout.workout_exercises.map((e) => e.exercise_id)),
      ]);
      start({
        userId: userId!,
        workoutId: workout.id,
        title: workout.title,
        performedOn: localDate(),
        startedAt: new Date().toISOString(),
        exercises: workout.workout_exercises.map((e) =>
          toSessionExercise(e, previous[e.exercise_id] ?? []),
        ),
      });
      // Not blocking: the session runs locally even if this fails (offline).
      await supabase.from('workouts').update({ status: 'in_progress' }).eq('id', workout.id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['program'] }),
  });
}

export type FinishResult = {
  log_id: string;
  records: PersonalRecord[];
  /** Exercise names by id, kept from the session (which is cleared once saved). */
  names: Record<string, { fr: string; en: string }>;
};

/** Saves the whole session (log, sets, workout completed) and returns the records beaten. */
export function useFinishSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ session, feedback }: { session: ActiveSession; feedback: Feedback }) => {
      const payload = toFinishPayload({
        workoutId: session.workoutId,
        performedOn: session.performedOn,
        startedAt: session.startedAt,
        finishedAt: new Date().toISOString(),
        exercises: session.exercises,
        pains: session.pains,
        feedback,
      });
      const { data, error } = await supabase.rpc('finish_workout', { p_log: payload });
      if (error) throw error;
      const saved = data as unknown as Omit<FinishResult, 'names'>;
      const names = Object.fromEntries(
        session.exercises.map((e) => [e.exerciseId, { fr: e.nameFr, en: e.nameEn }]),
      );
      return { ...saved, names };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program'] });
      void queryClient.invalidateQueries({ queryKey: ['workout'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

/** Records are celebrated once: the end screen marks them as shown. */
export async function markRecordsCelebrated(ids: string[]) {
  if (ids.length === 0) return;
  await supabase
    .from('personal_records')
    .update({ celebrated_at: new Date().toISOString() })
    .in('id', ids);
}

type SwapResponse = {
  workout_exercise: WorkoutWithExercises['workout_exercises'][number];
  explanation: string;
};

/** Asks the coach for a variant (swap-exercise) and puts it in place in the running session. */
export function useSwapExercise() {
  const replace = useSession((s) => s.replaceExercise);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exerciseIndex: number;
      exercise: SessionExercise;
      reason: SwapReason;
      note?: string;
    }) => {
      const res = await callFunction<SwapResponse>('swap-exercise', {
        workout_exercise_id: input.exercise.workoutExerciseId,
        reason: input.reason,
        note: input.note?.trim() || undefined,
      });
      const previous = await fetchLastPerformance([res.workout_exercise.exercise_id]);
      const next = toSessionExercise(
        res.workout_exercise,
        previous[res.workout_exercise.exercise_id] ?? [],
      );
      replace(input.exerciseIndex, next);
      return { exercise: next, explanation: res.explanation };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout'] }),
  });
}
