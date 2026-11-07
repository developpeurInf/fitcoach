-- Phase 6: progress tracking. Aggregates are computed by Postgres (one row per day) so the app
-- never downloads every set; the app then groups days into weeks, months, quarters or years.

-- Training per day: sessions, sets, reps, tonnage, minutes. security_invoker: RLS of the
-- underlying tables applies, so each user only sees their own rows. Sets are summed per log
-- first so a day with two sessions counts each session's duration once.
create view public.daily_training
with (security_invoker = true) as
with sets as (
  select
    s.workout_log_id,
    count(*) filter (where not s.is_warmup)::int as sets,
    coalesce(sum(s.reps) filter (where not s.is_warmup), 0)::int as reps,
    coalesce(sum(s.volume_kg) filter (where not s.is_warmup), 0) as volume_kg
  from public.set_logs s
  group by s.workout_log_id
)
select
  l.user_id,
  l.performed_on as day,
  count(*)::int as sessions,
  coalesce(sum(x.sets), 0)::int as sets,
  coalesce(sum(x.reps), 0)::int as reps,
  coalesce(sum(x.volume_kg), 0)::numeric(12, 2) as volume_kg,
  coalesce(sum(l.duration_minutes), 0)::int as minutes
from public.workout_logs l
left join sets x on x.workout_log_id = l.id
group by l.user_id, l.performed_on;

-- Best performance per exercise and day: estimated 1RM (Epley), heaviest load, most reps.
create view public.exercise_daily_best
with (security_invoker = true) as
select
  s.user_id,
  s.exercise_id,
  l.performed_on as day,
  max(s.estimated_1rm_kg) as best_1rm_kg,
  max(s.load_kg) as best_load_kg,
  max(s.reps) as best_reps,
  count(*)::int as sets
from public.set_logs s
join public.workout_logs l on l.id = s.workout_log_id
where not s.is_warmup
group by s.user_id, s.exercise_id, l.performed_on;

revoke all on public.daily_training, public.exercise_daily_best from anon, public;
grant select on public.daily_training, public.exercise_daily_best to authenticated;

-- The latest body weight measured is copied to the profile (used by the coach's prompts).
create or replace function public.sync_profile_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.weight_kg is not null and not exists (
    select 1 from public.body_measurements m
    where m.user_id = new.user_id and m.weight_kg is not null
      and m.measured_on > new.measured_on and m.id <> new.id
  ) then
    update public.profiles set weight_kg = new.weight_kg where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger body_measurements_sync_weight
  after insert or update of weight_kg, measured_on on public.body_measurements
  for each row execute function public.sync_profile_weight();
