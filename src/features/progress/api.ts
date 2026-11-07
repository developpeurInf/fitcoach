import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';
import type { BodyMeasurement, Insert } from '@/types/models';

import { bestRecords } from './logic';

export const progressKeys = {
  all: ['progress'] as const,
  training: (from: string, to: string) => ['progress', 'training', from, to] as const,
  workouts: (from: string, to: string) => ['progress', 'workouts', from, to] as const,
  streak: ['progress', 'streak'] as const,
  measurements: ['progress', 'measurements'] as const,
  exercises: ['progress', 'exercises'] as const,
  exercise: (id: string, from: string, to: string) =>
    ['progress', 'exercise', id, from, to] as const,
  records: ['progress', 'records'] as const,
  photo: (path: string) => ['progress', 'photo', path] as const,
};

/** Training per day (view daily_training), over a date range. */
export function useDailyTraining(from: string, to: string) {
  return useQuery({
    queryKey: progressKeys.training(from, to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_training')
        .select('day, sessions, sets, reps, volume_kg, minutes')
        .gte('day', from)
        .lte('day', to);
      if (error) throw error;
      return data;
    },
  });
}

type WorkoutWithProgram = {
  scheduled_date: string;
  status: string;
  program: { status: string; updated_at: string } | null;
};

/**
 * Keeps sessions that were really planned: a program replaced by a new one is archived, and its
 * sessions after that date were never due (unless done anyway).
 */
const wasPlanned = (w: WorkoutWithProgram) =>
  w.status === 'completed' ||
  w.program?.status !== 'archived' ||
  w.scheduled_date < w.program.updated_at.slice(0, 10);

const strip = (rows: WorkoutWithProgram[]) =>
  rows.filter(wasPlanned).map(({ scheduled_date, status }) => ({ scheduled_date, status }));

const WORKOUT_FIELDS = 'scheduled_date, status, program:programs(status, updated_at)';

/** Planned sessions (current and past programs) over a range, for adherence. */
export function usePlannedWorkouts(from: string, to: string) {
  return useQuery({
    queryKey: progressKeys.workouts(from, to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(WORKOUT_FIELDS)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to);
      if (error) throw error;
      return strip(data);
    },
  });
}

/** Most recent planned sessions up to today, for the streak. */
export function useStreakWorkouts(today: string) {
  return useQuery({
    queryKey: [...progressKeys.streak, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(WORKOUT_FIELDS)
        .lte('scheduled_date', today)
        .order('scheduled_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return strip(data);
    },
  });
}

export function useMeasurements() {
  return useQuery({
    queryKey: progressKeys.measurements,
    queryFn: async (): Promise<BodyMeasurement[]> => {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .order('measured_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type ExerciseOption = { id: string; nameFr: string; nameEn: string; sets: number };

/** Exercises the user has logged, most worked first (for the 1RM chart picker). */
export function useLoggedExercises() {
  return useQuery({
    queryKey: progressKeys.exercises,
    queryFn: async (): Promise<ExerciseOption[]> => {
      const { data, error } = await supabase
        .from('exercise_daily_best')
        .select('exercise_id, sets, best_1rm_kg, exercise:exercises(name_fr, name_en)');
      if (error) throw error;
      const byId = new Map<string, ExerciseOption>();
      for (const r of data) {
        if (!r.best_1rm_kg) continue; // only exercises with a load have an estimated 1RM
        const cur = byId.get(r.exercise_id) ?? {
          id: r.exercise_id,
          nameFr: r.exercise?.name_fr ?? r.exercise_id,
          nameEn: r.exercise?.name_en ?? r.exercise_id,
          sets: 0,
        };
        cur.sets += r.sets ?? 0;
        byId.set(r.exercise_id, cur);
      }
      return [...byId.values()].sort((a, b) => b.sets - a.sets);
    },
  });
}

export function useExerciseBest(exerciseId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: progressKeys.exercise(exerciseId ?? '', from, to),
    enabled: !!exerciseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_daily_best')
        .select('day, best_1rm_kg, best_load_kg')
        .eq('exercise_id', exerciseId!)
        .gte('day', from)
        .lte('day', to);
      if (error) throw error;
      return data;
    },
  });
}

export function useRecords() {
  return useQuery({
    queryKey: progressKeys.records,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_records')
        .select(
          'id, exercise_id, record_type, value, reps, load_kg, achieved_on, exercise:exercises(name_fr, name_en)',
        )
        .order('achieved_on', { ascending: false });
      if (error) throw error;
      return bestRecords(data);
    },
  });
}

export type NewMeasurement = Omit<Insert<'body_measurements'>, 'user_id' | 'photo_path'> & {
  /** Picked image, base64-encoded (works the same on web, iOS and Android). */
  photo?: { base64: string; mimeType: string } | null;
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Saves a measurement; the photo goes to the private bucket under the user's folder. */
export function useAddMeasurement() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ photo, ...m }: NewMeasurement) => {
      let photoPath: string | null = null;
      if (photo) {
        const ext = EXTENSIONS[photo.mimeType] ?? 'jpg';
        photoPath = `${userId}/${m.measured_on ?? 'photo'}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('progress-photos')
          .upload(photoPath, base64ToBytes(photo.base64), { contentType: photo.mimeType });
        if (error) throw error;
      }
      const { error } = await supabase
        .from('body_measurements')
        .insert({ ...m, user_id: userId!, photo_path: photoPath });
      if (error) {
        if (photoPath) await supabase.storage.from('progress-photos').remove([photoPath]);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: progressKeys.measurements });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (m: Pick<BodyMeasurement, 'id' | 'photo_path'>) => {
      const { error } = await supabase.from('body_measurements').delete().eq('id', m.id);
      if (error) throw error;
      if (m.photo_path) await supabase.storage.from('progress-photos').remove([m.photo_path]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKeys.measurements }),
  });
}

/** Short-lived signed URL for a private progress photo. */
export function usePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: progressKeys.photo(path ?? ''),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
