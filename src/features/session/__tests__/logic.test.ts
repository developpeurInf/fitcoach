import {
  addSet,
  completeSet,
  currentSetIndex,
  estimate1RM,
  formatClock,
  lastPerformance,
  prefillSet,
  removeLastSet,
  restSecondsLeft,
  type SessionExercise,
  stepValue,
  summarize,
  targetRepsValue,
  toFinishPayload,
  toSessionExercise,
} from '../logic';

import { checkSwap, isUsable, swapResultSchema, usableEquipment } from '@coach/swap';

const planned = {
  id: 'we-1',
  workout_id: 'w-1',
  position: 1,
  exercise_id: 'barbell-bench-press',
  sets: 3,
  reps: '6-8',
  duration_sec: null,
  suggested_load_kg: 60,
  tempo: '3-1-1-0',
  rest_sec: 120,
  target_rpe: 8,
  notes: null,
  replaced_from: null,
  created_at: '',
  updated_at: '',
  exercise: {
    id: 'barbell-bench-press',
    name_fr: 'Développé couché',
    name_en: 'Bench press',
    image_urls: ['https://example.org/0.jpg'],
    gif_url: null,
    youtube_video_id: null,
    primary_muscles: ['chest'],
    equipment: ['barbell'],
  },
} as unknown as Parameters<typeof toSessionExercise>[0];

describe('estimate1RM (Epley)', () => {
  it('matches the database formula', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimate1RM(60, 8)).toBe(76);
  });
  it('returns the load for a single and 0 without load or reps', () => {
    expect(estimate1RM(120, 1)).toBe(120);
    expect(estimate1RM(0, 10)).toBe(0);
    expect(estimate1RM(50, 0)).toBe(0);
  });
});

describe('targetRepsValue', () => {
  it('takes the bottom of a range', () => {
    expect(targetRepsValue('6-8')).toBe(6);
    expect(targetRepsValue('12')).toBe(12);
    expect(targetRepsValue('')).toBeNull();
  });
});

describe('pre-filled sets', () => {
  it('uses the plan the first time', () => {
    const e = toSessionExercise(planned, []);
    expect(e.sets).toHaveLength(3);
    expect(e.sets[0]).toMatchObject({ setNumber: 1, reps: 6, loadKg: 60, done: false });
    expect(e.restSec).toBe(120);
    expect(e.nameFr).toBe('Développé couché');
  });

  it('uses last time, set by set, when available', () => {
    const e = toSessionExercise(planned, [
      { set_number: 2, reps: 7, load_kg: 62.5, duration_sec: null, rpe: 9 },
      { set_number: 1, reps: 8, load_kg: 62.5, duration_sec: null, rpe: 8 },
    ]);
    expect(e.previous.map((p) => p.set_number)).toEqual([1, 2]);
    expect(e.sets[0]).toMatchObject({ reps: 8, loadKg: 62.5 });
    expect(e.sets[1]).toMatchObject({ reps: 7, loadKg: 62.5 });
    // No third set last time: falls back to the last one done.
    expect(e.sets[2]).toMatchObject({ reps: 7, loadKg: 62.5 });
    expect(e.sets[0]!.rpe).toBeNull();
  });

  it('pre-fills the next set from the one just done', () => {
    let e = toSessionExercise(planned, []);
    e = { ...e, sets: e.sets.map((s, i) => (i === 0 ? { ...s, reps: 8, loadKg: 65 } : s)) };
    e = completeSet(e, 0, new Date('2026-11-09T10:00:00Z'));
    expect(e.sets[0]).toMatchObject({ done: true, performedAt: '2026-11-09T10:00:00.000Z' });
    expect(e.sets[1]).toMatchObject({ reps: 8, loadKg: 65, done: false });
    expect(currentSetIndex(e)).toBe(1);
  });

  it('handles timed exercises (duration, no reps)', () => {
    const s = prefillSet(
      { targetReps: '1', targetDurationSec: 45, suggestedLoadKg: null, previous: [] },
      1,
    );
    expect(s).toMatchObject({ reps: null, durationSec: 45, loadKg: null });
  });
});

describe('adding and removing sets', () => {
  it('adds a set from the last done one and removes only pending sets', () => {
    let e = toSessionExercise(planned, []);
    e = completeSet(completeSet(completeSet(e, 0), 1), 2);
    expect(currentSetIndex(e)).toBe(-1);
    e = addSet(e);
    expect(e.sets).toHaveLength(4);
    expect(e.sets[3]).toMatchObject({ setNumber: 4, done: false, reps: 6 });
    e = removeLastSet(e);
    expect(e.sets).toHaveLength(3);
    // A done set is never removed.
    expect(removeLastSet(e).sets).toHaveLength(3);
  });
});

describe('rest timer helpers', () => {
  it('counts down from the stored end time', () => {
    expect(restSecondsLeft(null)).toBe(0);
    expect(restSecondsLeft(10_500, 1_000)).toBe(10);
    expect(restSecondsLeft(1_000, 5_000)).toBe(0);
  });
  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(-3)).toBe('0:00');
  });
  it('steps values without going below zero', () => {
    expect(stepValue(60, 2.5)).toBe(62.5);
    expect(stepValue(1, -2.5)).toBe(0);
    expect(stepValue(null, 1)).toBe(1);
  });
});

describe('summary and saved payload', () => {
  const session = (): SessionExercise[] => {
    let e = toSessionExercise(planned, []);
    e = completeSet(e, 0); // 6 × 60
    e = completeSet(e, 1); // 6 × 60
    return [e];
  };

  it('sums only done sets', () => {
    const s = summarize(session(), '2026-11-09T10:00:00Z', new Date('2026-11-09T10:52:20Z'));
    expect(s).toEqual({
      durationMinutes: 52,
      exercisesDone: 1,
      setsDone: 2,
      totalReps: 12,
      volumeKg: 720,
    });
  });

  it('sends done sets only, renumbered, with feedback and pains', () => {
    let [e] = session();
    e = { ...e!, sets: [e!.sets[1]!, e!.sets[2]!, e!.sets[0]!] }; // a pending set in between
    const payload = toFinishPayload({
      workoutId: 'w-1',
      performedOn: '2026-11-09',
      startedAt: '2026-11-09T10:00:00Z',
      finishedAt: '2026-11-09T11:00:00Z',
      exercises: [e],
      pains: [{ exercise_id: 'barbell-bench-press', zone: 'shoulder', intensite: 3 }],
      feedback: { feeling: 4, energy: 3, comment: '  Bonne séance ' },
    });
    expect(payload.sets.map((s) => s.set_number)).toEqual([1, 2]);
    expect(payload.sets[0]).toMatchObject({
      exercise_id: 'barbell-bench-press',
      workout_exercise_id: 'we-1',
      reps: 6,
      load_kg: 60,
    });
    expect(payload).toMatchObject({ feeling: 4, energy: 3, comment: 'Bonne séance' });
    expect(payload.pains).toHaveLength(1);
  });
});

describe('lastPerformance', () => {
  it('keeps only the most recent session per exercise', () => {
    const row = (
      exercise_id: string,
      workout_log_id: string,
      set_number: number,
      reps: number,
    ) => ({
      exercise_id,
      workout_log_id,
      set_number,
      reps,
      load_kg: 50,
      duration_sec: null,
      rpe: null,
    });
    const out = lastPerformance([
      row('squat', 'log-2', 2, 8),
      row('squat', 'log-2', 1, 10),
      row('bench', 'log-2', 1, 6),
      row('squat', 'log-1', 1, 5),
    ]);
    expect(out.squat!.map((s) => s.reps)).toEqual([8, 10]);
    expect(out.bench).toHaveLength(1);
  });
});

describe('swap-exercise contract', () => {
  const valid = {
    exercise_id: 'dumbbell-bench-press',
    nom: 'Développé couché haltères',
    series: 3,
    repetitions: '8-10',
    duree_sec: null,
    charge_suggeree_kg: 20,
    tempo: '3-1-1-0',
    repos_sec: 90,
    rpe_cible: 7,
    notes: '',
    explication: 'Même mouvement, sans barre.',
  };

  it('validates the coach answer', () => {
    expect(swapResultSchema.safeParse(valid).success).toBe(true);
    expect(swapResultSchema.safeParse({ ...valid, repetitions: 'beaucoup' }).success).toBe(false);
    expect(swapResultSchema.safeParse({ ...valid, explication: '' }).success).toBe(false);
  });

  it('rejects the same exercise or one outside the candidates', () => {
    const ctx = {
      currentExerciseId: 'barbell-bench-press',
      candidateIds: new Set(['dumbbell-bench-press']),
    };
    expect(checkSwap(valid, ctx)).toEqual([]);
    expect(checkSwap({ ...valid, exercise_id: 'barbell-bench-press' }, ctx)).toHaveLength(1);
    expect(checkSwap({ ...valid, exercise_id: 'made-up-exercise' }, ctx)).toHaveLength(1);
  });

  it('maps the user equipment to the library equipment', () => {
    const usable = usableEquipment(['dumbbells', 'bench']);
    expect(usable.sort()).toEqual(['bodyweight', 'dumbbell']);
    expect(isUsable(['dumbbell'], usable)).toBe(true);
    expect(isUsable([], usable)).toBe(true);
    expect(isUsable(['barbell'], usable)).toBe(false);
  });
});
