-- Coach history, period metrics and chat memory. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');
insert into public.programs (id, user_id, name, duration_weeks, start_date)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'PPL', 6, '2026-10-01');
insert into public.workouts (id, program_id, user_id, week_number, scheduled_date, title, status) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1, '2026-10-05', 'Jambes', 'in_progress'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1, '2026-10-07', 'Haut du corps', 'planned');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- September: one session; October: two (one planned, one free), plus a missed planned one.
select public.finish_workout('{"performed_on": "2026-09-20", "started_at": "2026-09-20T08:00:00Z", "finished_at": "2026-09-20T09:00:00Z",
  "sets": [{"exercise_id": "barbell-squat", "set_number": 1, "reps": 5, "load_kg": 80}]}'::jsonb);
select public.finish_workout('{"workout_id": "aaaaaaaa-0000-0000-0000-000000000002",
  "performed_on": "2026-10-05", "started_at": "2026-10-05T08:00:00Z", "finished_at": "2026-10-05T09:00:00Z",
  "feeling": 4, "energy": 3, "pains": [{"exercise_id": "barbell-squat", "zone": "knee", "intensite": 2}],
  "sets": [{"exercise_id": "barbell-squat", "set_number": 1, "reps": 8, "load_kg": 90, "rpe": 8},
           {"exercise_id": "barbell-squat", "set_number": 2, "reps": 7, "load_kg": 90, "rpe": 9},
           {"exercise_id": "barbell-squat", "set_number": 3, "reps": 10, "load_kg": 40}]}'::jsonb);
-- The app doesn't log warm-ups yet; mark one by hand to check it is left out.
update public.set_logs set is_warmup = true where load_kg = 40;
select public.finish_workout('{"performed_on": "2026-10-20", "started_at": "2026-10-20T08:00:00Z", "finished_at": "2026-10-20T08:40:00Z",
  "feeling": 2, "energy": 5,
  "sets": [{"exercise_id": "barbell-squat", "set_number": 1, "reps": 5, "load_kg": 100}]}'::jsonb);
insert into public.body_measurements (user_id, measured_on, weight_kg) values
  ('11111111-1111-1111-1111-111111111111', '2026-10-02', 82.0),
  ('11111111-1111-1111-1111-111111111111', '2026-10-30', 80.5);

-- coach_history: newest first, warm-ups left out, sets summarised on one line.
select is(jsonb_array_length(public.coach_history(10)), 3, 'one entry per session');
select is(public.coach_history(10) -> 0 ->> 'date', '2026-10-20', 'newest session first');
select is(public.coach_history(10) -> 1 -> 'exercices' -> 0 ->> 'reps', '8/7', 'warm-up excluded, reps in set order');
select is(public.coach_history(10) -> 1 ->> 'seance', 'Jambes', 'planned title kept');
select is(jsonb_array_length(public.coach_history(1)), 1, 'limit respected');

-- coach_period_metrics for October.
select is(public.coach_period_metrics('2026-10-01', '2026-10-31') -> 'assiduite',
  '{"prevues": 2, "realisees": 1, "taux_pct": 50}'::jsonb, 'attendance: missed planned session counted');
select is((public.coach_period_metrics('2026-10-01', '2026-10-31') ->> 'seances_realisees')::int, 2, 'sessions done in October');
-- October tonnage 90×8 + 90×7 + 100×5 = 1850 vs 80×5 = 400 in the previous 31 days.
select is((public.coach_period_metrics('2026-10-01', '2026-10-31') ->> 'volume_total_kg')::numeric, 1850::numeric, 'tonnage without warm-ups');
select is((public.coach_period_metrics('2026-10-01', '2026-10-31') ->> 'variation_volume_pct')::numeric, 362.5, 'change vs previous period');
select is(public.coach_period_metrics('2026-10-01', '2026-10-31') -> 'mesures' -> 'fin' ->> 'poids_kg', '80.5', 'latest measurement of the period');

-- Bob sees none of it, and nobody writes the chat memory from the client.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(jsonb_array_length(public.coach_history(10)), 0, 'coach_history only returns the caller''s sessions');
select throws_ok(
  $$insert into public.chat_memory (user_id, summary, summarized_until)
    values ('22222222-2222-2222-2222-222222222222', 'x', now())$$,
  '42501', null, 'chat_memory is written by the server only');

select * from finish();
rollback;
