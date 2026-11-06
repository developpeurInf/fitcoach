// Exercise swap contract (swap-exercise Edge Function). Shared by Deno and the app (Jest):
// it only imports `zod`, mapped to npm:zod in each function's deno.json.
import { z } from 'zod';

import { plannedExerciseSchema } from './program-schema.ts';

export const SWAP_REASONS = ['equipment', 'pain', 'too_hard', 'too_easy', 'other'] as const;
export type SwapReason = (typeof SWAP_REASONS)[number];

export const swapRequestSchema = z.object({
  workout_exercise_id: z.uuid(),
  reason: z.enum(SWAP_REASONS),
  note: z.string().trim().max(300).optional(),
});
export type SwapRequest = z.infer<typeof swapRequestSchema>;

/** What the coach returns: the replacement, prescribed like a program exercise, and why. */
export const swapResultSchema = plannedExerciseSchema.omit({ ordre: true }).extend({
  explication: z.string().min(1).max(300),
});
export type SwapResult = z.infer<typeof swapResultSchema>;

export function checkSwap(
  r: SwapResult,
  ctx: { currentExerciseId: string; candidateIds: Set<string> },
): string[] {
  const problems: string[] = [];
  if (r.exercise_id === ctx.currentExerciseId) {
    problems.push('exercise_id : propose un exercice différent de l’exercice actuel.');
  } else if (!ctx.candidateIds.has(r.exercise_id)) {
    problems.push(`exercise_id "${r.exercise_id}" ne fait pas partie des exercices proposés.`);
  }
  return problems;
}

/**
 * Library equipment (exercises.equipment) usable with the user's equipment (profiles.equipment).
 * Exercises with no equipment or body weight only are always usable.
 */
const EQUIPMENT_MAP: Record<string, string[]> = {
  dumbbells: ['dumbbell'],
  barbell: ['barbell', 'ez-bar'],
  machines: ['machine'],
  cables: ['cable'],
  kettlebell: ['kettlebell'],
  bands: ['bands'],
  cardio_machines: ['machine'],
};

export function usableEquipment(profileEquipment: string[]): string[] {
  const usable = new Set(['bodyweight']);
  for (const e of profileEquipment) for (const lib of EQUIPMENT_MAP[e] ?? []) usable.add(lib);
  return [...usable];
}

export function isUsable(exerciseEquipment: string[], usable: string[]): boolean {
  return exerciseEquipment.every((e) => usable.includes(e));
}
