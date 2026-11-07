/** Reminder times offered in the settings (local time). */
export const REMINDER_TIMES = ['07:00', '12:00', '17:30', '19:00'] as const;
export type ReminderTime = (typeof REMINDER_TIMES)[number];

/** Local notifications are capped on iOS (64): two weeks of sessions is plenty. */
export const REMINDER_DAYS = 14;

type PlannedWorkout = { id: string; scheduled_date: string; status: string; title: string };

/**
 * When to remind: the reminder time on each planned session day of the next two weeks, only if
 * still in the future. Dates are local days (YYYY-MM-DD), the result is a local Date.
 */
export function reminderSlots(
  workouts: PlannedWorkout[],
  time: string,
  now: Date,
): { workoutId: string; title: string; at: Date }[] {
  const [h, m] = time.split(':').map(Number);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + REMINDER_DAYS);
  return workouts
    .filter((w) => w.status === 'planned')
    .map((w) => {
      const [y, mo, d] = w.scheduled_date.split('-').map(Number);
      return { workoutId: w.id, title: w.title, at: new Date(y!, mo! - 1, d!, h, m) };
    })
    .filter((s) => s.at > now && s.at <= limit)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
