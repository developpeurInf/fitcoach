-- Row Level Security and quota tests. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Two users. The signup trigger must create their profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev', '{"full_name": "Alice Martin"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev', '{}');

select is((select first_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice', 'signup trigger creates a profile with the first name');

-- Alice's data, inserted as postgres (bypasses RLS).
insert into public.programs (id, user_id, name, duration_weeks, start_date)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice PPL', 6, current_date);
insert into public.workouts (id, program_id, user_id, week_number, scheduled_date, title)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 1, current_date, 'Push');
insert into public.workout_logs (id, user_id, workout_id)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.set_logs (workout_log_id, user_id, exercise_id, set_number, reps, load_kg)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'barbell-bench-press', 1, 8, 60);
insert into public.coach_reports (user_id, report_type, period_start, period_end, payload)
values ('11111111-1111-1111-1111-111111111111', 'weekly', current_date - 6, current_date, '{}');

-- Generated columns: tonnage and Epley 1RM.
select is((select volume_kg from public.set_logs where workout_log_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 480.00::numeric, 'volume = reps × load');
select is((select estimated_1rm_kg from public.set_logs where workout_log_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 76.00::numeric, 'Epley: 60 × (1 + 8/30) = 76');

-- ---- Act as Bob -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*) from public.profiles)::int, 1, 'Bob only sees his own profile');
select is((select count(*) from public.programs)::int, 0, 'Bob cannot see Alice''s programs');
select is((select count(*) from public.workouts)::int, 0, 'Bob cannot see Alice''s workouts');
select is((select count(*) from public.set_logs)::int, 0, 'Bob cannot see Alice''s sets');
select is((select count(*) from public.coach_reports)::int, 0, 'Bob cannot see Alice''s reports');
select ok((select count(*) from public.exercises) > 800, 'exercise library is readable');

select throws_ok(
  $$ insert into public.programs (user_id, name, duration_weeks, start_date)
     values ('11111111-1111-1111-1111-111111111111', 'hack', 4, current_date) $$,
  '42501', null, 'Bob cannot create a program for Alice');

select throws_ok(
  $$ insert into public.workout_logs (user_id, workout_id)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  '42501', null, 'Bob cannot log against Alice''s workout');

select throws_ok(
  $$ insert into public.set_logs (workout_log_id, user_id, exercise_id, set_number, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'push-up', 2, 10) $$,
  '42501', null, 'Bob cannot add sets to Alice''s log');

select throws_ok(
  $$ insert into public.exercises (id, name_fr, name_en, category) values ('hack', 'x', 'x', 'strength') $$,
  '42501', null, 'users cannot write to the exercise library');

select throws_ok(
  $$ insert into public.coach_reports (user_id, report_type, period_start, period_end, payload)
     values ('22222222-2222-2222-2222-222222222222', 'weekly', current_date, current_date, '{}') $$,
  '42501', null, 'users cannot forge coach reports');

select throws_ok(
  $$ insert into public.chat_messages (user_id, role, content)
     values ('22222222-2222-2222-2222-222222222222', 'assistant', 'fake coach') $$,
  '42501', null, 'users cannot write assistant messages');

select lives_ok(
  $$ insert into public.chat_messages (user_id, role, content)
     values ('22222222-2222-2222-2222-222222222222', 'user', 'Salut coach') $$,
  'users can write their own chat messages');

update public.programs set name = 'pwned' where user_id = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ select 1 $$, 'update on someone else''s rows is a silent no-op');

-- Rate limiting: generate-program allows 3 calls per hour.
select ok(public.consume_ai_quota('generate-program'), 'call 1 allowed');
select ok(public.consume_ai_quota('generate-program') and public.consume_ai_quota('generate-program'), 'calls 2-3 allowed');
select ok(not public.consume_ai_quota('generate-program'), 'call 4 in the same hour is refused');

reset role;
select is((select name from public.programs where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Alice PPL',
  'Alice''s program is unchanged');

select * from finish();
rollback;
