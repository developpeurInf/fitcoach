import { reminderSlots } from '../logic';

const w = (id: string, scheduled_date: string, status = 'planned') => ({
  id,
  scheduled_date,
  status,
  title: `S ${id}`,
});

describe('reminderSlots', () => {
  const now = new Date(2026, 10, 7, 18, 0); // Saturday 7 Nov, 18:00 local
  it('one reminder per planned session, at the chosen local time, in order', () => {
    const slots = reminderSlots([w('b', '2026-11-11'), w('a', '2026-11-09')], '17:30', now);
    expect(slots.map((s) => s.workoutId)).toEqual(['a', 'b']);
    expect(slots[0]!.at).toEqual(new Date(2026, 10, 9, 17, 30));
  });
  it('skips past times, completed sessions and anything beyond two weeks', () => {
    const slots = reminderSlots(
      [
        w('today', '2026-11-07'),
        w('done', '2026-11-10', 'completed'),
        w('far', '2026-11-30'),
        w('ok', '2026-11-20'),
      ],
      '17:30',
      now,
    );
    expect(slots.map((s) => s.workoutId)).toEqual(['ok']);
  });
  it('keeps today when the time is still ahead', () => {
    expect(reminderSlots([w('today', '2026-11-07')], '19:00', now)).toHaveLength(1);
  });
});
