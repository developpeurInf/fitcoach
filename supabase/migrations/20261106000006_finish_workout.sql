-- Phase 5: saving a finished session and detecting personal records.

-- Detects new personal records for one workout log and stores them. Only exercises the user
-- already did before count (a first session would make every set a "record").
-- SECURITY DEFINER because users can't insert personal_records directly (so they can't forge
-- them); it only ever acts on a log that belongs to auth.uid().
create or replace function public.detect_personal_records(p_log_id uuid)
returns setof public.personal_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_date date;
begin
  select performed_on into v_date from public.workout_logs where id = p_log_id and user_id = v_user;
  if not found then
    raise exception 'workout log not found' using errcode = 'P0002';
  end if;

  return query
  with current_sets as (
    select s.* from public.set_logs s
    where s.workout_log_id = p_log_id and not s.is_warmup and coalesce(s.reps, 0) > 0
  ),
  previous as (
    select
      s.exercise_id,
      max(s.load_kg) filter (where s.load_kg > 0) as best_load,
      max(s.estimated_1rm_kg) as best_1rm,
      max(s.reps) filter (where coalesce(s.load_kg, 0) = 0) as best_bw_reps
    from public.set_logs s
    where s.user_id = v_user and s.workout_log_id <> p_log_id and not s.is_warmup
      and s.exercise_id in (select exercise_id from current_sets)
    group by s.exercise_id
  ),
  candidates as (
    -- Best set of this session per exercise and record type.
    select distinct on (c.exercise_id, kind) c.exercise_id, kind, val, c.reps, c.load_kg, c.id as set_id
    from current_sets c
    cross join lateral (values
      ('max_load'::public.record_type, case when c.load_kg > 0 then c.load_kg end),
      ('estimated_1rm'::public.record_type, c.estimated_1rm_kg),
      ('max_reps'::public.record_type, case when coalesce(c.load_kg, 0) = 0 then c.reps::numeric end)
    ) as k(kind, val)
    where val is not null
    order by c.exercise_id, kind, val desc
  ),
  beaten as (
    select c.* from candidates c
    join previous p on p.exercise_id = c.exercise_id
    where (c.kind = 'max_load' and p.best_load is not null and c.val > p.best_load)
       or (c.kind = 'estimated_1rm' and p.best_1rm is not null and c.val > p.best_1rm)
       or (c.kind = 'max_reps' and p.best_bw_reps is not null and c.val > p.best_bw_reps)
  )
  insert into public.personal_records (user_id, exercise_id, record_type, value, reps, load_kg, set_log_id, achieved_on)
  select v_user, b.exercise_id, b.kind, b.val, b.reps, b.load_kg, b.set_id, v_date
  from beaten b
  returning *;
end;
$$;

revoke all on function public.detect_personal_records(uuid) from public, anon;
grant execute on function public.detect_personal_records(uuid) to authenticated;

-- Saves a whole session in one transaction (the app keeps the session locally while training,
-- so a lost connection mid-workout loses nothing): log + sets, marks the planned workout as done,
-- then detects records. SECURITY INVOKER: RLS applies to every write.
--
-- p_log: { workout_id?, performed_on, started_at, finished_at, feeling?, energy?, comment?,
--          pains: [...], sets: [{ exercise_id, workout_exercise_id?, set_number, reps?, load_kg?,
--          duration_sec?, rpe?, performed_at }] }
create or replace function public.finish_workout(p_log jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_log_id uuid;
  v_workout_id uuid := nullif(p_log ->> 'workout_id', '')::uuid;
  v_records jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workout_logs (
    user_id, workout_id, performed_on, started_at, finished_at, duration_minutes,
    feeling, energy, pains, comment
  )
  values (
    v_user,
    v_workout_id,
    (p_log ->> 'performed_on')::date,
    (p_log ->> 'started_at')::timestamptz,
    (p_log ->> 'finished_at')::timestamptz,
    greatest(0, round(extract(epoch from ((p_log ->> 'finished_at')::timestamptz - (p_log ->> 'started_at')::timestamptz)) / 60))::smallint,
    (p_log ->> 'feeling')::smallint,
    (p_log ->> 'energy')::smallint,
    coalesce(p_log -> 'pains', '[]'),
    nullif(p_log ->> 'comment', '')
  )
  returning id into v_log_id;

  insert into public.set_logs (
    workout_log_id, user_id, workout_exercise_id, exercise_id, set_number,
    reps, load_kg, duration_sec, rpe, performed_at
  )
  select
    v_log_id, v_user,
    nullif(s ->> 'workout_exercise_id', '')::uuid,
    s ->> 'exercise_id',
    (s ->> 'set_number')::smallint,
    (s ->> 'reps')::smallint,
    (s ->> 'load_kg')::numeric,
    (s ->> 'duration_sec')::smallint,
    (s ->> 'rpe')::numeric,
    coalesce((s ->> 'performed_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_log -> 'sets', '[]')) as s;

  if v_workout_id is not null then
    update public.workouts set status = 'completed' where id = v_workout_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]') into v_records
  from public.detect_personal_records(v_log_id) as r;

  return jsonb_build_object('log_id', v_log_id, 'records', v_records);
end;
$$;

revoke all on function public.finish_workout(jsonb) from public, anon;
grant execute on function public.finish_workout(jsonb) to authenticated;
