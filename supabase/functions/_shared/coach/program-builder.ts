// Expands the coach's program (week plan × session templates) into dated rows ready to insert.
// Pure function, unit-tested from the app's Jest suite.
import type { GeneratedProgram } from './program-schema.ts';

export type WorkoutRow = {
  week_number: number;
  week_type: GeneratedProgram['semaines'][number]['type'];
  scheduled_date: string; // YYYY-MM-DD
  title: string;
  estimated_minutes: number;
  warmup: { nom: string; duree_sec: number }[];
  cooldown: { nom: string; duree_sec: number }[];
  motivation_message: string;
  exercises: {
    position: number;
    exercise_id: string;
    sets: number;
    reps: string;
    duration_sec: number | null;
    suggested_load_kg: number | null;
    tempo: string | null;
    rest_sec: number;
    target_rpe: number;
    notes: string | null;
  }[];
};

/** Plate-friendly rounding: loads are rounded to the nearest 1.25 kg. */
export const roundLoad = (kg: number) => Math.round(kg / 1.25) * 1.25;

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Week 1 starts on `startDate` (the day the program is created), so no session lands in the past:
 * each template is placed on the first matching weekday within 7 days, then repeated weekly.
 */
export function buildWorkouts(program: GeneratedProgram, startDate: string): WorkoutRow[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const startWeekday = isoWeekday(startDate);
  const rows: WorkoutRow[] = [];

  for (const week of program.semaines) {
    const deload = week.type === 'deload';
    for (const tpl of program.seances_types) {
      const offset = ((tpl.jour_semaine - startWeekday + 7) % 7) + 7 * (week.semaine - 1);
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);

      rows.push({
        week_number: week.semaine,
        week_type: week.type,
        scheduled_date: toIsoDate(date),
        title: tpl.titre,
        estimated_minutes: deload
          ? Math.max(15, Math.round(tpl.duree_estimee_min * 0.8))
          : tpl.duree_estimee_min,
        warmup: tpl.echauffement,
        cooldown: tpl.retour_au_calme,
        motivation_message: week.consigne || tpl.message_motivation,
        exercises: tpl.exercices.map((e) => ({
          position: e.ordre,
          exercise_id: e.exercise_id,
          sets: Math.max(1, Math.round((e.series * week.volume_pct) / 100)),
          reps: e.repetitions,
          duration_sec: e.duree_sec,
          suggested_load_kg:
            e.charge_suggeree_kg === null || e.charge_suggeree_kg === 0
              ? e.charge_suggeree_kg
              : roundLoad((e.charge_suggeree_kg * week.intensite_pct) / 100),
          tempo: e.tempo,
          rest_sec: e.repos_sec,
          // Deload and adaptation weeks stay a notch easier than the template.
          target_rpe:
            week.type === 'progression' || week.type === 'test'
              ? e.rpe_cible
              : Math.max(5, e.rpe_cible - 1),
          notes: e.notes || null,
        })),
      });
    }
  }
  return rows.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
}
