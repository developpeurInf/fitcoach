import { buildWorkouts, isoWeekday, roundLoad } from '@coach/program-builder.ts';
import {
  checkProgram,
  generatedProgramSchema,
  type GeneratedProgram,
} from '@coach/program-schema.ts';

const exercise = (ordre: number, exercise_id: string, kg: number | null) => ({
  ordre,
  exercise_id,
  nom: exercise_id,
  series: 4,
  repetitions: '6-8',
  duree_sec: null,
  charge_suggeree_kg: kg,
  tempo: '2-0-1-0',
  repos_sec: 120,
  rpe_cible: 8,
  notes: '',
});

const session = (code: string, jour: number) => ({
  code,
  jour_semaine: jour,
  titre: `Séance ${code}`,
  duree_estimee_min: 60,
  echauffement: [{ nom: 'Rameur', duree_sec: 300 }],
  exercices: [exercise(1, 'barbell-squat', 80), exercise(2, 'plank', null)],
  retour_au_calme: [],
  message_motivation: 'Go !',
});

const program: GeneratedProgram = {
  nom: 'Full body 3 jours',
  structure: 'full_body',
  duree_semaines: 4,
  semaines: [
    { semaine: 1, type: 'adaptation', intensite_pct: 90, volume_pct: 100, consigne: 'Adaptation' },
    { semaine: 2, type: 'progression', intensite_pct: 100, volume_pct: 100, consigne: '' },
    { semaine: 3, type: 'progression', intensite_pct: 105, volume_pct: 100, consigne: '' },
    { semaine: 4, type: 'deload', intensite_pct: 90, volume_pct: 60, consigne: 'Décharge' },
  ],
  seances_types: [session('A', 1), session('B', 3), session('C', 5)],
  avertissements: [],
  hypotheses: [],
};

const known = new Set(['barbell-squat', 'plank']);

describe('program schema', () => {
  it('accepts a valid program', () => {
    expect(generatedProgramSchema.safeParse(program).success).toBe(true);
    expect(checkProgram(program, { daysPerWeek: 3, knownExerciseIds: known })).toEqual([]);
  });

  it('rejects invented exercise ids and missing deload', () => {
    const bad = {
      ...program,
      semaines: program.semaines.map((w) => ({ ...w, type: 'progression' as const })),
      seances_types: [
        session('A', 1),
        session('B', 3),
        { ...session('C', 5), exercices: [exercise(1, 'magic-press', 20)] },
      ],
    };
    const problems = checkProgram(bad, { daysPerWeek: 3, knownExerciseIds: known });
    expect(problems.join('\n')).toMatch(/deload/);
    expect(problems.join('\n')).toMatch(/magic-press/);
  });

  it('requires one session per available day, on distinct days', () => {
    const problems = checkProgram(
      { ...program, seances_types: [session('A', 1), session('B', 1)] },
      { daysPerWeek: 3, knownExerciseIds: known },
    );
    expect(problems).toContain("Il faut exactement 3 séances types (une par jour d'entraînement).");
    expect(problems).toContain('Deux séances ne peuvent pas tomber le même jour.');
  });

  it('rejects malformed values', () => {
    const r = generatedProgramSchema.safeParse({ ...program, duree_semaines: 12 });
    expect(r.success).toBe(false);
  });
});

describe('buildWorkouts', () => {
  // 2026-11-06 is a Friday.
  const rows = buildWorkouts(program, '2026-11-06');

  it('creates one workout per template per week', () => {
    expect(rows).toHaveLength(12);
  });

  it('never schedules a session before the start date and keeps weekdays', () => {
    expect(isoWeekday('2026-11-06')).toBe(5);
    expect(rows[0]!.scheduled_date).toBe('2026-11-06'); // Friday session C, same day
    expect(rows.map((r) => r.scheduled_date).every((d) => d >= '2026-11-06')).toBe(true);
    expect(rows.filter((r) => r.week_number === 1).map((r) => r.scheduled_date)).toEqual([
      '2026-11-06',
      '2026-11-09',
      '2026-11-11',
    ]);
  });

  it('applies week intensity, volume and RPE adjustments', () => {
    const w1 = rows.find((r) => r.week_number === 1)!.exercises[0]!;
    const w3 = rows.find((r) => r.week_number === 3)!.exercises[0]!;
    const deload = rows.find((r) => r.week_type === 'deload')!;
    expect(w1.suggested_load_kg).toBe(72.5); // 80 × 90 % = 72 → 72.5
    expect(w1.target_rpe).toBe(7); // adaptation: one notch easier
    expect(w3.suggested_load_kg).toBe(83.75); // 80 × 105 % = 84 → 83.75
    expect(w3.target_rpe).toBe(8);
    expect(deload.exercises[0]!.sets).toBe(2); // 4 × 60 % = 2.4 → 2
    expect(deload.estimated_minutes).toBe(48);
  });

  it('keeps bodyweight exercises without load', () => {
    expect(rows[0]!.exercises[1]!.suggested_load_kg).toBeNull();
  });

  it('rounds loads to 1.25 kg', () => {
    expect(roundLoad(61.8)).toBe(61.25);
    expect(roundLoad(62)).toBe(62.5);
  });
});
