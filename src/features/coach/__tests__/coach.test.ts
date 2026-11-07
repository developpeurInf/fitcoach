import { parseSse, sse, toAlternating } from '@coach/chat';
import {
  adaptationSchema,
  checkAdaptation,
  checkSessionReport,
  isAdaptationDue,
  periodicReportSchema,
  reportPeriod,
  sessionReportSchema,
} from '@coach/reports';

import { weekToAdapt } from '../logic';

describe('reportPeriod', () => {
  it('weekly: the last complete Monday–Sunday week', () => {
    expect(reportPeriod('weekly', '2026-11-07')).toEqual({
      start: '2026-10-26',
      end: '2026-11-01',
    });
    expect(reportPeriod('weekly', '2026-11-02')).toEqual({
      start: '2026-10-26',
      end: '2026-11-01',
    });
  });
  it('weekly on a Sunday covers the week ending that day', () => {
    expect(reportPeriod('weekly', '2026-11-08')).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    });
  });
  it('monthly, quarterly, yearly: previous complete period, across years', () => {
    expect(reportPeriod('monthly', '2026-11-07')).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(reportPeriod('monthly', '2026-01-15')).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
    expect(reportPeriod('quarterly', '2026-11-07')).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    });
    expect(reportPeriod('quarterly', '2026-02-10')).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    });
    expect(reportPeriod('yearly', '2026-11-07')).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
  });
});

describe('isAdaptationDue', () => {
  it('opens 2 days before the week and closes 3 days into it', () => {
    expect(isAdaptationDue('2026-11-09', '2026-11-06')).toBe(false);
    expect(isAdaptationDue('2026-11-09', '2026-11-07')).toBe(true);
    expect(isAdaptationDue('2026-11-09', '2026-11-12')).toBe(true);
    expect(isAdaptationDue('2026-11-09', '2026-11-13')).toBe(false);
  });
});

const report = {
  bilan: 'Bonne séance, charges tenues.',
  points_forts: ['Régularité'],
  point_a_ameliorer: 'Garder 2 min de repos.',
  charges_prochaine_seance: [
    {
      exercise_id: 'barbell-squat',
      nom: 'Squat',
      charge_kg: 82.5,
      repetitions: '6-8',
      conseil: '+2,5 kg',
    },
  ],
  message_coach: 'Continue comme ça !',
};

describe('session report', () => {
  it('accepts a valid report and rejects bad reps', () => {
    expect(sessionReportSchema.safeParse(report).success).toBe(true);
    const bad = {
      ...report,
      charges_prochaine_seance: [
        { ...report.charges_prochaine_seance[0], repetitions: 'beaucoup' },
      ],
    };
    expect(sessionReportSchema.safeParse(bad).success).toBe(false);
  });
  it('flags loads for exercises not done in the session', () => {
    expect(checkSessionReport(report, new Set(['barbell-squat']))).toEqual([]);
    expect(checkSessionReport(report, new Set(['push-up']))).toHaveLength(1);
  });
});

describe('periodic report schema', () => {
  it('needs at least one strength and a known decision', () => {
    const ok = {
      points_forts: ['4 séances sur 4'],
      points_a_ameliorer: [],
      exercices_en_stagnation: ['barbell-bench-press'],
      ajustements_periode_suivante: [],
      decision: 'continuer',
      jalons: [],
      objectifs_prochain_cycle: [],
      message_coach: 'Beau mois.',
    };
    expect(periodicReportSchema.safeParse(ok).success).toBe(true);
    expect(periodicReportSchema.safeParse({ ...ok, points_forts: [] }).success).toBe(false);
    expect(periodicReportSchema.safeParse({ ...ok, decision: 'abandonner' }).success).toBe(false);
  });
});

describe('adaptation', () => {
  const we = '5f8e2a8e-1d7c-4c4b-9a3e-2b1f0c9d8e7a';
  const adaptation = adaptationSchema.parse({
    decision_semaine: 'progression',
    ajustements: [
      {
        workout_exercise_id: we,
        exercise_id: 'barbell-squat',
        series: 4,
        repetitions: '6-8',
        duree_sec: null,
        charge_suggeree_kg: 85,
        raison: 'RPE bas',
      },
      {
        workout_exercise_id: we,
        exercise_id: 'made-up-move',
        series: 3,
        repetitions: '10',
        duree_sec: null,
        charge_suggeree_kg: null,
        raison: 'Variante',
      },
    ],
    alertes: [],
    message_coach: 'On monte un peu.',
  });
  it('flags unknown workout exercises, duplicates and unknown library ids', () => {
    const problems = checkAdaptation(adaptation, {
      plannedIds: new Set([we]),
      knownExerciseIds: new Set(['barbell-squat']),
    });
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toMatch(/deux fois/);
    expect(problems.join(' ')).toMatch(/made-up-move/);
    expect(
      checkAdaptation(adaptation, { plannedIds: new Set(), knownExerciseIds: new Set() }),
    ).toHaveLength(5);
  });
});

describe('weekToAdapt', () => {
  const w = (week_number: number, scheduled_date: string, status = 'planned') => ({
    week_number,
    scheduled_date,
    status,
  });
  const program = [
    w(1, '2026-11-02', 'completed'),
    w(1, '2026-11-04', 'completed'),
    w(2, '2026-11-09'),
    w(2, '2026-11-11'),
  ];
  it('returns the next week inside the window', () => {
    expect(weekToAdapt(program, '2026-11-07')).toEqual({ week: 2, start: '2026-11-09' });
    expect(weekToAdapt(program, '2026-11-10')).toEqual({ week: 2, start: '2026-11-09' });
  });
  it('nothing for week 1 or too early', () => {
    expect(weekToAdapt(program, '2026-11-05')).toBeNull();
    expect(weekToAdapt([w(1, '2026-11-09')], '2026-11-08')).toBeNull();
  });
});

describe('chat helpers', () => {
  it('merges same-role turns and drops a leading assistant turn', () => {
    expect(
      toAlternating([
        { role: 'assistant', content: 'Salut' },
        { role: 'user', content: 'A' },
        { role: 'user', content: 'B' },
        { role: 'assistant', content: ' ' },
        { role: 'assistant', content: 'C' },
      ]),
    ).toEqual([
      { role: 'user', content: 'A\n\nB' },
      { role: 'assistant', content: 'C' },
    ]);
  });
  it('parses SSE frames split across chunks', () => {
    const stream = sse('delta', { text: 'Bon' }) + sse('done', { id: 'x' });
    const first = parseSse(stream.slice(0, 30));
    const second = parseSse(first.rest + stream.slice(30));
    expect([...first.events, ...second.events]).toEqual([
      { event: 'delta', data: { text: 'Bon' } },
      { event: 'done', data: { id: 'x' } },
    ]);
    expect(second.rest).toBe('');
  });
});
