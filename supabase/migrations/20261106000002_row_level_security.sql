-- Row Level Security: each user only ever sees and changes their own rows.
-- `(select auth.uid())` is wrapped in a sub-select so Postgres evaluates it once per query.
-- Child tables also check that the parent row belongs to the same user, so nobody can
-- attach rows to someone else's program or log.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.personal_records enable row level security;
alter table public.coach_reports enable row level security;
alter table public.chat_messages enable row level security;

-- profiles: created by the signup trigger; deleted with the auth user (account deletion).
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercises: public library, read-only from the app. Writes go through the service role (seed).
create policy "exercises: read all" on public.exercises
  for select to anon, authenticated using (true);

-- programs
create policy "programs: own" on public.programs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- workouts
create policy "workouts: own" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid()))
  );

-- workout_exercises
create policy "workout_exercises: own" on public.workout_exercises
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );

-- workout_logs
create policy "workout_logs: own" on public.workout_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      workout_id is null
      or exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    )
  );

-- set_logs
create policy "set_logs: own" on public.set_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.user_id = (select auth.uid()))
  );

-- body_measurements
create policy "body_measurements: own" on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- personal_records: detected server-side (phase 6). Users read them and mark them celebrated.
create policy "personal_records: read own" on public.personal_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "personal_records: update own" on public.personal_records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "personal_records: delete own" on public.personal_records
  for delete to authenticated using (user_id = (select auth.uid()));

-- coach_reports: written by Edge Functions with the service role so they can't be forged.
create policy "coach_reports: read own" on public.coach_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "coach_reports: delete own" on public.coach_reports
  for delete to authenticated using (user_id = (select auth.uid()));

-- chat_messages: users write their own messages; assistant replies are written by the chat function.
create policy "chat_messages: read own" on public.chat_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "chat_messages: insert own user messages" on public.chat_messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'user');
create policy "chat_messages: delete own" on public.chat_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- Users cannot rewrite derived columns or ownership after the fact.
revoke update (user_id) on public.programs, public.workouts, public.workout_exercises,
  public.workout_logs, public.set_logs, public.body_measurements, public.personal_records
  from authenticated;
revoke update (record_type, value, exercise_id, set_log_id) on public.personal_records from authenticated;
