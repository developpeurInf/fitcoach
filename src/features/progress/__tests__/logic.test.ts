import {
  adherenceByBucket,
  aggregateTraining,
  bestRecords,
  bucketLabel,
  bucketStart,
  buildBuckets,
  currentStreak,
  rangeOf,
  ratio,
  seriesByBucket,
  trend,
} from '../logic';
import { validateMeasurement } from '../measurement';

const TODAY = '2026-11-06'; // a Friday

describe('buckets', () => {
  it('finds the start of each bucket', () => {
    expect(bucketStart(TODAY, 'day')).toBe('2026-11-06');
    expect(bucketStart(TODAY, 'week')).toBe('2026-11-02'); // Monday
    expect(bucketStart('2026-11-08', 'week')).toBe('2026-11-02'); // Sunday → same week
    expect(bucketStart(TODAY, 'month')).toBe('2026-11-01');
    expect(bucketStart(TODAY, 'quarter')).toBe('2026-10-01');
    expect(bucketStart(TODAY, 'year')).toBe('2026-01-01');
  });

  it('builds the last N buckets, oldest first, with inclusive ends', () => {
    const weeks = buildBuckets('week', TODAY, 3);
    expect(weeks).toEqual([
      { start: '2026-10-19', end: '2026-10-25' },
      { start: '2026-10-26', end: '2026-11-01' },
      { start: '2026-11-02', end: '2026-11-08' },
    ]);
    const months = buildBuckets('month', '2026-03-31', 2);
    expect(months).toEqual([
      { start: '2026-02-01', end: '2026-02-28' },
      { start: '2026-03-01', end: '2026-03-31' },
    ]);
    expect(rangeOf(buildBuckets('quarter', TODAY, 8))).toEqual({
      from: '2025-01-01',
      to: '2026-12-31',
    });
  });

  it('labels buckets in French', () => {
    expect(bucketLabel({ start: '2026-10-01', end: '' }, 'quarter')).toBe('T4 26');
    expect(bucketLabel({ start: '2026-01-01', end: '' }, 'year')).toBe('2026');
    expect(bucketLabel({ start: '2026-11-01', end: '' }, 'month', 'en')).toBe('Nov');
  });
});

describe('aggregation', () => {
  const weeks = buildBuckets('week', TODAY, 2);

  it('sums training per bucket and ignores rows outside the range', () => {
    const totals = aggregateTraining(
      [
        { day: '2026-11-02', sessions: 1, sets: 16, reps: 140, volume_kg: 5200.5, minutes: 60 },
        { day: '2026-11-05', sessions: 1, sets: 12, reps: 100, volume_kg: 3000, minutes: 45 },
        { day: '2026-10-27', sessions: 1, sets: 10, reps: 80, volume_kg: 2000, minutes: 40 },
        { day: '2026-01-01', sessions: 1, sets: 99, reps: 99, volume_kg: 99, minutes: 99 },
      ],
      weeks,
    );
    expect(totals[1]).toEqual({ sessions: 2, sets: 28, reps: 240, volumeKg: 8201, minutes: 105 });
    expect(totals[0]!.sessions).toBe(1);
  });

  it('averages or maximises dated points, with gaps for empty buckets', () => {
    const points = [
      { day: '2026-11-02', value: 82 },
      { day: '2026-11-06', value: 81 },
      { day: '2026-11-04', value: null },
    ];
    expect(seriesByBucket(points, weeks, 'avg')).toEqual([null, 81.5]);
    expect(seriesByBucket(points, weeks, 'max')).toEqual([null, 82]);
  });
});

describe('adherence and streak', () => {
  const workouts = [
    { scheduled_date: '2026-10-26', status: 'completed' },
    { scheduled_date: '2026-10-27', status: 'planned' }, // missed
    { scheduled_date: '2026-11-02', status: 'completed' },
    { scheduled_date: '2026-11-03', status: 'completed' },
    { scheduled_date: '2026-11-05', status: 'completed' },
    { scheduled_date: '2026-11-06', status: 'planned' }, // today, not done yet
    { scheduled_date: '2026-11-09', status: 'planned' }, // future
  ];

  it('counts only sessions due by today as planned', () => {
    const a = adherenceByBucket(workouts, buildBuckets('week', TODAY, 2), TODAY);
    expect(a).toEqual([
      { done: 1, planned: 2 },
      { done: 3, planned: 3 },
    ]);
    expect(ratio(a[0]!)).toBe(50);
    expect(ratio({ done: 0, planned: 0 })).toBeNull();
  });

  it('counts completed sessions in a row, today pending does not break it', () => {
    expect(currentStreak(workouts, TODAY)).toBe(3);
    expect(currentStreak(workouts, '2026-11-07')).toBe(0); // today's session was missed
    expect(currentStreak([], TODAY)).toBe(0);
  });
});

describe('trend and records', () => {
  it('compares the last two buckets', () => {
    expect(trend([100, 110])).toBe(10);
    expect(trend([null, 110])).toBeNull();
    expect(trend([0, 5])).toBeNull();
  });

  it('keeps the best record per exercise and type, newest first', () => {
    const r = (id: string, exercise_id: string, value: number, achieved_on: string) => ({
      id,
      exercise_id,
      record_type: 'max_load',
      value,
      achieved_on,
    });
    const best = bestRecords([
      r('1', 'squat', 100, '2026-10-01'),
      r('2', 'squat', 105, '2026-10-15'),
      r('3', 'bench', 80, '2026-10-20'),
    ]);
    expect(best.map((b) => b.id)).toEqual(['3', '2']);
  });
});

describe('measurement form', () => {
  const empty = {
    measured_on: '2026-11-06',
    weight: '',
    notes: '',
    hasPhoto: false,
    waist_cm: '',
    chest_cm: '',
    hips_cm: '',
    arm_cm: '',
    thigh_cm: '',
    body_fat_pct: '',
  };

  it('converts the weight to kg and accepts French decimals', () => {
    const r = validateMeasurement({ ...empty, weight: '180,5', waist_cm: '84,5' }, 'lb', TODAY);
    expect(r.ok && r.row).toMatchObject({ weight_kg: 81.9, waist_cm: 84.5, chest_cm: null });
  });

  it('rejects out-of-range values, future dates and an empty form', () => {
    const r = validateMeasurement(
      { ...empty, measured_on: '2026-11-07', weight: '12', arm_cm: 'abc' },
      'kg',
      TODAY,
    );
    expect(!r.ok && r.errors).toEqual({
      measured_on: 'progress.measure.invalidDate',
      weight: 'progress.measure.invalid',
      arm_cm: 'progress.measure.invalid',
    });
    const e = validateMeasurement(empty, 'kg', TODAY);
    expect(!e.ok && e.errors.form).toBe('progress.measure.empty');
    expect(validateMeasurement({ ...empty, hasPhoto: true }, 'kg', TODAY).ok).toBe(true);
  });
});
