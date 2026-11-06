-- Progress views and profile weight sync. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- Two sessions the same day (60 + 30 min), one the day before.
select public.finish_workout('{"performed_on": "2026-11-02", "started_at": "2026-11-02T08:00:00Z", "finished_at": "2026-11-02T09:00:00Z",
  "sets": [{"exercise_id": "barbell-squat", "set_number": 1, "reps": 5, "load_kg": 100},
           {"exercise_id": "barbell-squat", "set_number": 2, "reps": 5, "load_kg": 100}]}'::jsonb);
select public.finish_workout('{"performed_on": "2026-11-02", "started_at": "2026-11-02T18:00:00Z", "finished_at": "2026-11-02T18:30:00Z",
  "sets": [{"exercise_id": "barbell-squat", "set_number": 1, "reps": 3, "load_kg": 110}]}'::jsonb);
select public.finish_workout('{"performed_on": "2026-11-01", "started_at": "2026-11-01T08:00:00Z", "finished_at": "2026-11-01T08:45:00Z",
  "sets": [{"exercise_id": "push-up", "set_number": 1, "reps": 20}]}'::jsonb);

select is((select sessions from public.daily_training where day = '2026-11-02'), 2, 'two sessions on the same day');
select is((select minutes from public.daily_training where day = '2026-11-02'), 90, 'each session''s duration counted once');
select is((select volume_kg from public.daily_training where day = '2026-11-02'), 1330.00::numeric, 'tonnage summed over the day');
select is((select best_load_kg from public.exercise_daily_best where exercise_id = 'barbell-squat'), 110.00::numeric,
  'best load of the day');

-- Weight sync: only the latest measurement updates the profile.
insert into public.body_measurements (user_id, measured_on, weight_kg) values
  ('11111111-1111-1111-1111-111111111111', '2026-11-05', 81.0);
insert into public.body_measurements (user_id, measured_on, weight_kg) values
  ('11111111-1111-1111-1111-111111111111', '2026-10-01', 85.0);
select is((select weight_kg from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 81.0::numeric,
  'profile weight follows the latest measurement, not an older one entered later');

-- Bob sees nothing through the views.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*) from public.daily_training)::int, 0, 'daily_training respects RLS');
select is((select count(*) from public.exercise_daily_best)::int, 0, 'exercise_daily_best respects RLS');

select * from finish();
rollback;
