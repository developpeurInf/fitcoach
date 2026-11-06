// Program contract between the coach (Claude) and FitCoach. Shared by the Edge Functions (Deno)
// and the app (Metro/Jest): it only imports `zod`, mapped to npm:zod in each function's deno.json.
// Keys stay in French to match the schemas of coach-fitness-contexte.md (§8.2 / §8.3).
import { z } from 'zod';

export const WEEK_TYPES = ['adaptation', 'progression', 'deload', 'test'] as const;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'exercise_id doit être un slug kebab-case');

export const timedItemSchema = z.object({
  nom: z.string().min(1).max(80),
  duree_sec: z.number().int().min(10).max(1800),
});

export const plannedExerciseSchema = z.object({
  ordre: z.number().int().min(1).max(20),
  exercise_id: slug,
  nom: z.string().min(1).max(100),
  series: z.number().int().min(1).max(10),
  /** "8" or "6-8". Timed holds use duree_sec instead and keep a nominal "1". */
  repetitions: z.string().regex(/^\d{1,3}(-\d{1,3})?$/),
  duree_sec: z.number().int().min(5).max(1800).nullable(),
  charge_suggeree_kg: z.number().min(0).max(500).nullable(),
  tempo: z
    .string()
    .regex(/^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/)
    .nullable(),
  repos_sec: z.number().int().min(0).max(600),
  rpe_cible: z.number().min(1).max(10),
  notes: z.string().max(300),
});

/** One session template, repeated every week on the same weekday (1 = Monday … 7 = Sunday). */
export const sessionTemplateSchema = z.object({
  code: z.string().regex(/^[A-Z]$/),
  jour_semaine: z.number().int().min(1).max(7),
  titre: z.string().min(1).max(80),
  duree_estimee_min: z.number().int().min(10).max(180),
  echauffement: z.array(timedItemSchema).max(8),
  exercices: z.array(plannedExerciseSchema).min(1).max(12),
  retour_au_calme: z.array(timedItemSchema).max(6),
  message_motivation: z.string().max(200),
});

/** Week-level periodization, applied to the templates (adaptation, progression, deload). */
export const weekPlanSchema = z.object({
  semaine: z.number().int().min(1).max(8),
  type: z.enum(WEEK_TYPES),
  /** Load multiplier in % of the template load (e.g. 90 in adaptation, 102.5 later, 90 in deload). */
  intensite_pct: z.number().min(60).max(115),
  /** Sets multiplier in % (e.g. 100, 110, 60 in deload). */
  volume_pct: z.number().min(40).max(130),
  consigne: z.string().max(200),
});

export const generatedProgramSchema = z.object({
  nom: z.string().min(3).max(80),
  structure: z.string().min(2).max(40),
  duree_semaines: z.number().int().min(4).max(8),
  semaines: z.array(weekPlanSchema).min(4).max(8),
  seances_types: z.array(sessionTemplateSchema).min(1).max(6),
  /** Safety notes for the user (medical advice, injuries). Empty when none. */
  avertissements: z.array(z.string().max(300)).max(5),
  /** Assumptions the coach made about missing info (context §3). */
  hypotheses: z.array(z.string().max(300)).max(5),
});

export type GeneratedProgram = z.infer<typeof generatedProgramSchema>;
export type SessionTemplate = z.infer<typeof sessionTemplateSchema>;
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;
export type WeekPlan = z.infer<typeof weekPlanSchema>;

/**
 * Checks the program against the user's constraints and the exercise library.
 * Returns human-readable problems (sent back to the model on retry); empty when valid.
 */
export function checkProgram(
  p: GeneratedProgram,
  ctx: { daysPerWeek: number; knownExerciseIds: ReadonlySet<string> },
): string[] {
  const problems: string[] = [];
  if (p.semaines.length !== p.duree_semaines) {
    problems.push(
      `"semaines" doit contenir exactement ${p.duree_semaines} entrées (une par semaine).`,
    );
  }
  p.semaines.forEach((w, i) => {
    if (w.semaine !== i + 1)
      problems.push(`Les semaines doivent être numérotées 1 à ${p.duree_semaines} dans l'ordre.`);
  });
  if (!p.semaines.some((w) => w.type === 'deload')) {
    problems.push('Le programme doit inclure au moins une semaine de décharge (type "deload").');
  }
  if (p.seances_types.length !== ctx.daysPerWeek) {
    problems.push(
      `Il faut exactement ${ctx.daysPerWeek} séances types (une par jour d'entraînement).`,
    );
  }
  const days = p.seances_types.map((s) => s.jour_semaine);
  if (new Set(days).size !== days.length)
    problems.push('Deux séances ne peuvent pas tomber le même jour.');
  const codes = p.seances_types.map((s) => s.code);
  if (new Set(codes).size !== codes.length)
    problems.push('Chaque séance type doit avoir un code unique.');

  const unknown = new Set<string>();
  for (const s of p.seances_types) {
    s.exercices.forEach((e, i) => {
      if (!ctx.knownExerciseIds.has(e.exercise_id)) unknown.add(e.exercise_id);
      if (e.ordre !== i + 1)
        problems.push(`Séance ${s.code} : "ordre" doit aller de 1 à ${s.exercices.length}.`);
    });
  }
  if (unknown.size) {
    problems.push(
      `exercise_id inconnus de la bibliothèque : ${[...unknown].join(', ')}. Utilise uniquement les identifiants de la bibliothèque de référence (§11).`,
    );
  }
  return [...new Set(problems)];
}
