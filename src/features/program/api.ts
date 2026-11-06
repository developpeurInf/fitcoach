import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { Exercise, Program, Workout, WorkoutExercise } from '@/types/models';

export type WorkoutWithExercises = Workout & {
  workout_exercises: (WorkoutExercise & {
    exercise: Pick<
      Exercise,
      'id' | 'name_fr' | 'name_en' | 'image_urls' | 'primary_muscles' | 'equipment'
    > | null;
  })[];
};

export const programKeys = {
  active: (userId: string | null) => ['program', 'active', userId] as const,
  workouts: (programId: string | undefined) => ['program', programId, 'workouts'] as const,
  workout: (id: string) => ['workout', id] as const,
};

/** Local calendar date as YYYY-MM-DD (scheduled_date is a plain date, not a timestamp). */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useActiveProgram() {
  const userId = useUserId();
  return useQuery({
    queryKey: programKeys.active(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Program | null> => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** All workouts of the program (≤ 48 rows), without exercise details: enough for calendars. */
export function useProgramWorkouts(programId: string | undefined) {
  return useQuery({
    queryKey: programKeys.workouts(programId),
    enabled: !!programId,
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('program_id', programId!)
        .order('scheduled_date');
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: programKeys.workout(id),
    queryFn: async (): Promise<WorkoutWithExercises> => {
      const { data, error } = await supabase
        .from('workouts')
        .select(
          '*, workout_exercises(*, exercise:exercises!workout_exercises_exercise_id_fkey(id, name_fr, name_en, image_urls, primary_muscles, equipment))',
        )
        .eq('id', id)
        .order('position', { referencedTable: 'workout_exercises' })
        .single();
      if (error) throw error;
      return data as unknown as WorkoutWithExercises;
    },
  });
}

type GenerateResult = { program_id: string; warnings: string[]; assumptions: string[] };

export function useGenerateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callFunction<GenerateResult>('generate-program', { start_date: localDate() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['program'] }),
  });
}
