-- Saves a generated program in one transaction: archives the current active program, then
-- inserts the program, its workouts and their exercises. SECURITY INVOKER: it runs as the
-- caller, so Row Level Security still applies to every insert.
create or replace function public.create_program(p_program jsonb, p_workouts jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_program_id uuid;
  v_workout_id uuid;
  w jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.programs set status = 'archived'
  where user_id = v_user and status = 'active';

  insert into public.programs (user_id, name, structure, duration_weeks, start_date, status, ai_payload)
  values (
    v_user,
    p_program ->> 'name',
    p_program ->> 'structure',
    (p_program ->> 'duration_weeks')::smallint,
    (p_program ->> 'start_date')::date,
    'active',
    p_program -> 'ai_payload'
  )
  returning id into v_program_id;

  for w in select * from jsonb_array_elements(p_workouts) loop
    insert into public.workouts (
      program_id, user_id, week_number, week_type, scheduled_date, title,
      estimated_minutes, warmup, cooldown, motivation_message
    )
    values (
      v_program_id, v_user,
      (w ->> 'week_number')::smallint,
      (w ->> 'week_type')::public.week_type,
      (w ->> 'scheduled_date')::date,
      w ->> 'title',
      (w ->> 'estimated_minutes')::smallint,
      coalesce(w -> 'warmup', '[]'),
      coalesce(w -> 'cooldown', '[]'),
      w ->> 'motivation_message'
    )
    returning id into v_workout_id;

    insert into public.workout_exercises (
      workout_id, user_id, position, exercise_id, sets, reps, duration_sec,
      suggested_load_kg, tempo, rest_sec, target_rpe, notes
    )
    select
      v_workout_id, v_user,
      (e ->> 'position')::smallint,
      e ->> 'exercise_id',
      (e ->> 'sets')::smallint,
      e ->> 'reps',
      (e ->> 'duration_sec')::smallint,
      (e ->> 'suggested_load_kg')::numeric,
      e ->> 'tempo',
      (e ->> 'rest_sec')::smallint,
      (e ->> 'target_rpe')::numeric,
      e ->> 'notes'
    from jsonb_array_elements(w -> 'exercises') as e;
  end loop;

  return v_program_id;
end;
$$;

revoke all on function public.create_program(jsonb, jsonb) from public, anon;
grant execute on function public.create_program(jsonb, jsonb) to authenticated;
