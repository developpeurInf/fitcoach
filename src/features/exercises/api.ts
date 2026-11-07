import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types/models';

import {
  EQUIPMENT_FILTERS,
  type EquipmentFilter,
  equipmentInWord,
  likeTerm,
  MUSCLE_GROUPS,
  type MuscleGroup,
  musclesInQuery,
} from './catalog';

export const PAGE_SIZE = 30;
const LIST_FIELDS =
  'id, name_fr, name_en, category, level, primary_muscles, equipment, image_urls, gif_url, is_reference';
export type ExerciseListItem = Pick<
  Exercise,
  | 'id'
  | 'name_fr'
  | 'name_en'
  | 'category'
  | 'level'
  | 'primary_muscles'
  | 'equipment'
  | 'image_urls'
  | 'gif_url'
  | 'is_reference'
>;

export type LibraryFilters = {
  query: string;
  group: MuscleGroup | null;
  equipment: EquipmentFilter | null;
};

export const exerciseKeys = {
  list: (f: LibraryFilters) => ['exercises', 'list', f] as const,
  detail: (id: string) => ['exercises', 'detail', id] as const,
};

/** Library page by page (30 at a time), reference exercises first, then alphabetical. */
export function useExerciseLibrary(filters: LibraryFilters) {
  return useInfiniteQuery({
    queryKey: exerciseKeys.list(filters),
    initialPageParam: 0,
    getNextPageParam: (last: ExerciseListItem[], pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('exercises')
        .select(LIST_FIELDS)
        .order('is_reference', { ascending: false })
        .order('name_fr')
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      // Every word must match (name in French or English, or a French muscle word): "bench press
      // medium" finds "Barbell Bench Press - Medium Grip", "pecs haltères" finds chest exercises.
      let muscleWordUsed = false;
      for (const word of likeTerm(filters.query).split(' ').filter(Boolean)) {
        const muscles = musclesInQuery(word);
        const gear = equipmentInWord(word);
        if (gear.length) {
          q = q.overlaps('equipment', gear);
        } else if (muscles.length && !muscleWordUsed) {
          muscleWordUsed = true; // PostgREST takes a single `or` filter per request
          q = q.or(`search_text.ilike.*${word}*,primary_muscles.ov.{${muscles.join(',')}}`);
        } else {
          q = q.ilike('search_text', `%${word}%`);
        }
      }
      if (filters.group) q = q.overlaps('primary_muscles', [...MUSCLE_GROUPS[filters.group]]);
      if (filters.equipment) q = q.overlaps('equipment', [...EQUIPMENT_FILTERS[filters.equipment]]);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: async (): Promise<Exercise> => {
      const { data, error } = await supabase.from('exercises').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

/** Names of the easier / harder variants shown on the sheet. */
export function useExerciseNames(ids: (string | null)[]) {
  const wanted = ids.filter((x): x is string => !!x);
  return useQuery({
    queryKey: ['exercises', 'names', wanted],
    enabled: wanted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name_fr')
        .in('id', wanted);
      if (error) throw error;
      return Object.fromEntries(data.map((e) => [e.id, e.name_fr])) as Record<string, string>;
    },
  });
}

/**
 * Technique sheet: written by the coach the first time anyone opens the exercise, then stored on it.
 * Enabled only when the library doesn't have the French sheet yet.
 */
export function useExerciseSheet(exercise: Exercise | undefined) {
  const queryClient = useQueryClient();
  const missing = !!exercise && exercise.instructions_fr.length === 0;
  return useQuery({
    queryKey: ['exercises', 'sheet', exercise?.id],
    enabled: missing,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { exercise: updated } = await callFunction<{ exercise: Exercise }>('exercise-sheet', {
        exercise_id: exercise!.id,
      });
      queryClient.setQueryData(exerciseKeys.detail(updated.id), (old: Exercise | undefined) =>
        old ? { ...old, ...updated } : old,
      );
      return updated;
    },
  });
}
