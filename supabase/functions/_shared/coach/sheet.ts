// Contract of an exercise technique sheet (context §7 "Fiche technique"). Imports only `zod`.
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const line = (max: number) => z.string().trim().min(1).max(max);

export const exerciseSheetSchema = z.object({
  /** Usual French name of the movement (kept as is when the library already has one). */
  nom_fr: line(80),
  etapes: z.array(line(200)).min(3).max(5),
  erreurs: z.array(line(160)).min(2).max(3),
  respiration: line(200),
  /** Ids taken from the candidates sent with the prompt, or null. */
  variante_facile_id: slug.nullable(),
  variante_difficile_id: slug.nullable(),
});
export type ExerciseSheet = z.infer<typeof exerciseSheetSchema>;

export function checkSheet(
  s: ExerciseSheet,
  ctx: { exerciseId: string; candidateIds: Set<string> },
) {
  const problems: string[] = [];
  for (const [field, id] of [
    ['variante_facile_id', s.variante_facile_id],
    ['variante_difficile_id', s.variante_difficile_id],
  ] as const) {
    if (id && (id === ctx.exerciseId || !ctx.candidateIds.has(id))) {
      problems.push(`${field} "${id}" ne fait pas partie des variantes proposées.`);
    }
  }
  if (s.variante_facile_id && s.variante_facile_id === s.variante_difficile_id) {
    problems.push('La variante facile et la variante difficile doivent être différentes.');
  }
  return problems;
}
