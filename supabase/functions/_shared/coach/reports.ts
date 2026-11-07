// Contracts of the coach's reports and weekly adaptation (context §9.2 / §9.3 / §5.2), plus the
// period arithmetic shared by the Edge Functions and the app. Imports only `zod` (Deno + Jest).
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const line = (max: number) => z.string().trim().min(1).max(max);

// ---------------------------------------------------------------------------
// After each session (§9.2 "Quotidien")
// ---------------------------------------------------------------------------
export const sessionReportSchema = z.object({
  /** 3–4 lines: what went well, one thing to improve, what comes next. */
  bilan: line(600),
  points_forts: z.array(line(160)).min(1).max(3),
  point_a_ameliorer: line(200),
  charges_prochaine_seance: z
    .array(
      z.object({
        exercise_id: slug,
        nom: line(100),
        charge_kg: z.number().min(0).max(500).nullable(),
        repetitions: z
          .string()
          .regex(/^\d{1,3}(-\d{1,3})?$/)
          .nullable(),
        conseil: line(160),
      }),
    )
    .max(12),
  message_coach: line(220),
});
export type SessionReport = z.infer<typeof sessionReportSchema>;

export function checkSessionReport(r: SessionReport, sessionExerciseIds: Set<string>): string[] {
  return r.charges_prochaine_seance
    .filter((c) => !sessionExerciseIds.has(c.exercise_id))
    .map(
      (c) => `charges_prochaine_seance : "${c.exercise_id}" n'a pas été fait pendant cette séance.`,
    );
}

// ---------------------------------------------------------------------------
// Periodic reports (§9.2 hebdomadaire / mensuel / trimestriel / annuel)
// ---------------------------------------------------------------------------
export const PERIODIC_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type PeriodicType = (typeof PERIODIC_TYPES)[number];

export const TYPE_LABELS: Record<PeriodicType, string> = {
  weekly: 'hebdomadaire',
  monthly: 'mensuel',
  quarterly: 'trimestriel',
  yearly: 'annuel',
};

/**
 * What the coach writes. Every figure (attendance, tonnage, records, measurements) is computed by
 * the database and merged into the stored report: the coach comments, it doesn't count.
 */
export const periodicReportSchema = z.object({
  points_forts: z.array(line(200)).min(1).max(4),
  points_a_ameliorer: z.array(line(200)).max(4),
  exercices_en_stagnation: z.array(slug).max(5),
  ajustements_periode_suivante: z.array(line(200)).max(5),
  /** Monthly and longer: keep going, adjust, or start a new training block. */
  decision: z.enum(['continuer', 'ajuster', 'changer_de_bloc']).nullable(),
  /** Quarterly / yearly: milestones reached, and goals for the next cycle. */
  jalons: z.array(line(120)).max(5),
  objectifs_prochain_cycle: z.array(line(160)).max(4),
  message_coach: line(300),
});
export type PeriodicReport = z.infer<typeof periodicReportSchema>;

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Period covered by a report requested on `today`: the last complete week, month, quarter or year.
 * A weekly report asked on a Sunday covers the week ending that day.
 */
export function reportPeriod(type: PeriodicType, today: string): { start: string; end: string } {
  const t = toDate(today);
  if (type === 'weekly') {
    const dow = (t.getUTCDay() + 6) % 7; // Monday = 0
    const end = new Date(t);
    end.setUTCDate(t.getUTCDate() - (dow === 6 ? 0 : dow + 1));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 6);
    return { start: toDay(start), end: toDay(end) };
  }
  const months = type === 'monthly' ? 1 : type === 'quarterly' ? 3 : 12;
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const currentStart = type === 'yearly' ? 0 : m - (m % months);
  const start = new Date(Date.UTC(y, currentStart - months, 1));
  const end = new Date(Date.UTC(y, currentStart, 0));
  return { start: toDay(start), end: toDay(end) };
}

// ---------------------------------------------------------------------------
// Weekly adaptation (§3.6, rules §5.1 / §5.2)
// ---------------------------------------------------------------------------
export const adaptationSchema = z.object({
  decision_semaine: z.enum(['progression', 'maintien', 'decharge', 'reprise']),
  /** Only the exercises that change. Unlisted ones keep their plan. */
  ajustements: z
    .array(
      z.object({
        workout_exercise_id: z.uuid(),
        exercise_id: slug,
        series: z.number().int().min(1).max(10),
        repetitions: z.string().regex(/^\d{1,3}(-\d{1,3})?$/),
        duree_sec: z.number().int().min(5).max(1800).nullable(),
        charge_suggeree_kg: z.number().min(0).max(500).nullable(),
        raison: line(160),
      }),
    )
    .max(40),
  alertes: z.array(line(200)).max(3),
  message_coach: line(300),
});
export type Adaptation = z.infer<typeof adaptationSchema>;

export function checkAdaptation(
  a: Adaptation,
  ctx: { plannedIds: Set<string>; knownExerciseIds: Set<string> },
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const x of a.ajustements) {
    if (!ctx.plannedIds.has(x.workout_exercise_id)) {
      problems.push(
        `workout_exercise_id ${x.workout_exercise_id} ne fait pas partie de la semaine à ajuster.`,
      );
    }
    if (seen.has(x.workout_exercise_id)) {
      problems.push(`workout_exercise_id ${x.workout_exercise_id} apparaît deux fois.`);
    }
    seen.add(x.workout_exercise_id);
    if (!ctx.knownExerciseIds.has(x.exercise_id)) {
      problems.push(`exercise_id "${x.exercise_id}" n'existe pas dans la bibliothèque.`);
    }
  }
  return problems;
}

/** The app asks for the adaptation from 2 days before a new program week until 3 days into it. */
export function isAdaptationDue(weekStart: string, today: string): boolean {
  const diff = (toDate(weekStart).getTime() - toDate(today).getTime()) / 864e5;
  return diff <= 2 && diff >= -3;
}
