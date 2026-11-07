-- Exercise library (phase 8). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'alice@test.dev');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select ok((select is_reference from public.exercises where id = 'barbell-bench-press'),
  'exercise with a French name is a reference exercise');
select ok((select count(*) from public.exercises where not is_reference) > 0,
  'imported exercises without a French name are not');

-- Users read the library but cannot write the technique sheets (only the exercise-sheet function can).
update public.exercises set instructions_fr = '{"pirate"}' where id = 'barbell-bench-press';
select is((select instructions_fr from public.exercises where id = 'barbell-bench-press'), '{}'::text[],
  'users cannot edit exercises');

select ok(exists (select 1 from public.ai_limits where function_name = 'exercise-sheet'), 'exercise-sheet has a quota');

select * from finish();
rollback;
