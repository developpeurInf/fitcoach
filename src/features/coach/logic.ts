import { isAdaptationDue } from '@coach/reports';

type W = { week_number: number; scheduled_date: string; status: string };

/**
 * The program week the coach should adjust now, mirroring adapt-week: the week of the next planned
 * session, from week 2 on, within the adaptation window. Null when nothing is due.
 */
export function weekToAdapt(workouts: W[], today: string): { week: number; start: string } | null {
  const next = workouts
    .filter((w) => w.status === 'planned' && w.scheduled_date >= today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
  if (!next || next.week_number < 2) return null;
  const start = workouts
    .filter((w) => w.week_number === next.week_number)
    .map((w) => w.scheduled_date)
    .sort()[0]!;
  return isAdaptationDue(start, today) ? { week: next.week_number, start } : null;
}
