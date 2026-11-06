-- finish_workout + detect_personal_records. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');
insert into public.programs (id, user_id, name, duration_weeks, start_date)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'PPL', 6, current_date);
insert into public.workouts (id, program_id, user_id, week_number, scheduled_date, title, status) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 1, current_date, 'Push', 'in_progress');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- First session: nothing to beat yet, so no record.
select is(
  jsonb_array_length(public.finish_workout('{
    "performed_on": "2026-11-02", "started_at": "2026-11-02T10:00:00Z", "finished_at": "2026-11-02T10:50:00Z",
    "feeling": 4, "energy": 3, "pains": [],
    "sets": [
      {"exercise_id": "barbell-bench-press", "set_number": 1, "reps": 8, "load_kg": 60},
      {"exercise_id": "barbell-bench-press", "set_number": 2, "reps": 8, "load_kg": 60},
      {"exercise_id": "push-up", "set_number": 1, "reps": 15}
    ]}'::jsonb) -> 'records'),
  0, 'first session: no record');

select is((select duration_minutes from public.workout_logs where performed_on = '2026-11-02')::int, 50,
  'duration computed from start/finish');
select is((select count(*) from public.set_logs)::int, 3, 'sets saved');

-- Second session, linked to the planned workout: heavier bench, more push-ups.
select ok(
  (select public.finish_workout('{
    "workout_id": "aaaaaaaa-0000-0000-0000-000000000002",
    "performed_on": "2026-11-09", "started_at": "2026-11-09T10:00:00Z", "finished_at": "2026-11-09T11:00:00Z",
    "feeling": 5, "energy": 4, "comment": "Top",
    "pains": [{"exercise_id": "push-up", "zone": "wrist", "intensite": 2}],
    "sets": [
      {"exercise_id": "barbell-bench-press", "workout_exercise_id": "", "set_number": 1, "reps": 6, "load_kg": 65, "rpe": 8.5},
      {"exercise_id": "barbell-bench-press", "set_number": 2, "reps": 5, "load_kg": 62.5},
      {"exercise_id": "push-up", "set_number": 1, "reps": 18}
    ]}'::jsonb) ? 'log_id'),
  'second session saved');

select is((select status::text from public.workouts where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'completed', 'planned workout marked completed');
select is((select pains -> 0 ->> 'zone' from public.workout_logs where performed_on = '2026-11-09'),
  'wrist', 'pains stored');

select is((select value from public.personal_records where exercise_id = 'barbell-bench-press' and record_type = 'max_load'),
  65.00::numeric, 'max load record: 65 kg beats 60 kg');
select is((select reps from public.personal_records where exercise_id = 'barbell-bench-press' and record_type = 'max_load')::int,
  6, 'record keeps the reps of the set');
-- 65 x (1 + 6/30) = 78 > 60 x (1 + 8/30) = 76.
select is((select value from public.personal_records where exercise_id = 'barbell-bench-press' and record_type = 'estimated_1rm'),
  78.00::numeric, 'estimated 1RM record');
select is((select value from public.personal_records where exercise_id = 'push-up' and record_type = 'max_reps'),
  18.00::numeric, 'bodyweight reps record');
select is((select count(*) from public.personal_records)::int, 3, 'exactly three records');

-- Bob can't detect records on Alice's log nor save a log against her workout.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  'select public.detect_personal_records(''aaaaaaaa-0000-0000-0000-000000000009'')',
  'P0002', null, 'detect_personal_records only works on the caller''s logs');
select throws_ok(
  'select public.finish_workout(''{"workout_id": "aaaaaaaa-0000-0000-0000-000000000002",
     "performed_on": "2026-11-09", "started_at": "2026-11-09T10:00:00Z", "finished_at": "2026-11-09T11:00:00Z",
     "sets": []}''::jsonb)',
  '42501', null, 'Bob cannot finish Alice''s workout');

select * from finish();
rollback;
