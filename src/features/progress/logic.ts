// Pure progress logic: period buckets (day → year), aggregation of daily rows, adherence, streak.
// Dates are calendar days ("YYYY-MM-DD"), handled in UTC so no timezone can shift a day.

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** Dashboard filters: each one shows the last N buckets of its size. */
export const PERIODS: Record<Granularity, number> = {
  day: 14,
  week: 12,
  month: 12,
  quarter: 8,
  year: 5,
};
export const GRANULARITIES = Object.keys(PERIODS) as Granularity[];

export type Bucket = { start: string; end: string };

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);

function shift(day: string, g: Granularity, n: number): string {
  const d = toDate(day);
  if (g === 'day') d.setUTCDate(d.getUTCDate() + n);
  else if (g === 'week') d.setUTCDate(d.getUTCDate() + 7 * n);
  else if (g === 'month') d.setUTCMonth(d.getUTCMonth() + n);
  else if (g === 'quarter') d.setUTCMonth(d.getUTCMonth() + 3 * n);
  else d.setUTCFullYear(d.getUTCFullYear() + n);
  return toDay(d);
}

/** First day of the bucket containing `day` (weeks start on Monday). */
export function bucketStart(day: string, g: Granularity): string {
  const d = toDate(day);
  if (g === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (g === 'month') d.setUTCDate(1);
  if (g === 'quarter') {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (d.getUTCMonth() % 3));
  }
  if (g === 'year') {
    d.setUTCDate(1);
    d.setUTCMonth(0);
  }
  return toDay(d);
}

/** The last `count` buckets up to the one containing `today`, oldest first. */
export function buildBuckets(g: Granularity, today: string, count = PERIODS[g]): Bucket[] {
  const current = bucketStart(today, g);
  return Array.from({ length: count }, (_, i) => {
    const start = shift(current, g, i - count + 1);
    const end = shift(shift(start, g, 1), 'day', -1);
    return { start, end };
  });
}

export const rangeOf = (buckets: Bucket[]) => ({
  from: buckets[0]!.start,
  to: buckets.at(-1)!.end,
});

const indexOf = (buckets: Bucket[], day: string) =>
  buckets.findIndex((b) => day >= b.start && day <= b.end);

/** Short axis label: "lun. 3", "3 nov.", "nov.", "T4 26", "2026". */
export function bucketLabel(b: Bucket, g: Granularity, locale = 'fr'): string {
  const d = toDate(b.start);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(d);
  if (g === 'day') return f({ weekday: 'short', day: 'numeric' });
  if (g === 'week') return f({ day: 'numeric', month: 'short' });
  if (g === 'month') return f({ month: 'short' });
  if (g === 'quarter') {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${locale.startsWith('fr') ? 'T' : 'Q'}${q} ${String(d.getUTCFullYear()).slice(2)}`;
  }
  return String(d.getUTCFullYear());
}

export type DailyTraining = {
  day: string;
  sessions: number | null;
  sets: number | null;
  reps: number | null;
  volume_kg: number | null;
  minutes: number | null;
};

export type TrainingTotals = {
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
  minutes: number;
};

const zero = (): TrainingTotals => ({ sessions: 0, sets: 0, reps: 0, volumeKg: 0, minutes: 0 });

/** Sums daily rows into buckets. Rows outside every bucket are ignored. */
export function aggregateTraining(rows: DailyTraining[], buckets: Bucket[]): TrainingTotals[] {
  const out = buckets.map(zero);
  for (const r of rows) {
    const t = out[indexOf(buckets, r.day)];
    if (!t) continue;
    t.sessions += r.sessions ?? 0;
    t.sets += r.sets ?? 0;
    t.reps += r.reps ?? 0;
    t.volumeKg += Number(r.volume_kg ?? 0);
    t.minutes += r.minutes ?? 0;
  }
  return out.map((t) => ({ ...t, volumeKg: Math.round(t.volumeKg) }));
}

/**
 * One value per bucket from dated points: the average (body weight, measurements) or the
 * maximum (estimated 1RM). Empty buckets are null, so the line shows a gap, not a fake zero.
 */
export function seriesByBucket(
  points: { day: string; value: number | null }[],
  buckets: Bucket[],
  mode: 'avg' | 'max',
): (number | null)[] {
  const acc = buckets.map(() => [] as number[]);
  for (const p of points) {
    const i = indexOf(buckets, p.day);
    if (i >= 0 && p.value != null) acc[i]!.push(Number(p.value));
  }
  return acc.map((values) => {
    if (values.length === 0) return null;
    const v =
      mode === 'max' ? Math.max(...values) : values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(v * 10) / 10;
  });
}

export type PlannedWorkout = { scheduled_date: string; status: string };

/**
 * Sessions done / planned per bucket. Only sessions due by today count as planned, so a week in
 * progress isn't shown as missed.
 */
export function adherenceByBucket(
  workouts: PlannedWorkout[],
  buckets: Bucket[],
  today: string,
): { done: number; planned: number }[] {
  const out = buckets.map(() => ({ done: 0, planned: 0 }));
  for (const w of workouts) {
    const b = out[indexOf(buckets, w.scheduled_date)];
    if (!b) continue;
    const done = w.status === 'completed';
    if (done || w.scheduled_date < today) b.planned += 1;
    if (done) b.done += 1;
  }
  return out;
}

export const ratio = (a: { done: number; planned: number }) =>
  a.planned === 0 ? null : Math.round((a.done / a.planned) * 100);

/**
 * Current streak: planned sessions completed in a row, most recent first. A session planned
 * today that isn't done yet doesn't break it; a past one not done does.
 */
export function currentStreak(workouts: PlannedWorkout[], today: string): number {
  const past = workouts
    .filter((w) => w.scheduled_date <= today)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  let streak = 0;
  for (const w of past) {
    if (w.status === 'completed') streak += 1;
    else if (w.scheduled_date === today) continue;
    else break;
  }
  return streak;
}

/** Change between the last two buckets, in % (null when there's nothing to compare). */
export function trend(values: (number | null)[]): number | null {
  const last = values.at(-1);
  const prev = values.at(-2);
  if (last == null || prev == null || prev === 0) return null;
  return Math.round(((last - prev) / prev) * 100);
}

export type RecordRow = {
  id: string;
  exercise_id: string;
  record_type: string;
  value: number;
  achieved_on: string;
};

/** Current best per exercise and record type (records only ever go up, so the max). */
export function bestRecords<R extends RecordRow>(records: R[]): R[] {
  const best = new Map<string, R>();
  for (const r of records) {
    const key = `${r.exercise_id}:${r.record_type}`;
    const cur = best.get(key);
    if (!cur || Number(r.value) > Number(cur.value)) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => b.achieved_on.localeCompare(a.achieved_on));
}
