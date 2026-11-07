-- Phase 7: AI reports, weekly adaptation and chat.

-- Compact training history sent to the coach (context §13: "5 à 10 dernières séances", summarised).
-- One entry per session, one line per exercise (best set, totals, mean RPE, what was planned),
-- never every set. SECURITY INVOKER: only the caller's rows.
create or replace function public.coach_history(p_limit int default 10)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with logs as (
    select l.*, w.title
    from public.workout_logs l
    left join public.workouts w on w.id = l.workout_id
    where l.user_id = auth.uid()
    order by l.performed_on desc, l.started_at desc
    limit least(greatest(p_limit, 1), 30)
  ),
  per_exercise as (
    select
      s.workout_log_id,
      s.exercise_id,
      min(s.performed_at) as first_at,
      jsonb_strip_nulls(jsonb_build_object(
        'exercise_id', s.exercise_id,
        'nom', max(e.name_fr),
        'series', count(*),
        'reps', string_agg(coalesce(s.reps::text, s.duration_sec || 's'), '/' order by s.set_number),
        'charge_max_kg', max(s.load_kg),
        'rm1_estime_kg', max(s.estimated_1rm_kg),
        'rpe_moyen', round(avg(s.rpe), 1),
        'prevu', max(case when we.id is not null then
          we.sets || '×' || coalesce(we.duration_sec || 's', we.reps)
          || coalesce(' @' || we.suggested_load_kg || 'kg', '') end)
      )) as summary
    from public.set_logs s
    join logs on logs.id = s.workout_log_id
    join public.exercises e on e.id = s.exercise_id
    left join public.workout_exercises we on we.id = s.workout_exercise_id
    where not s.is_warmup
    group by s.workout_log_id, s.exercise_id
  )
  select coalesce(jsonb_agg(entry order by performed_on desc, started_at desc), '[]')
  from (
    select
      l.performed_on,
      l.started_at,
      jsonb_strip_nulls(jsonb_build_object(
        'log_id', l.id,
        'date', l.performed_on,
        'seance', l.title,
        'duree_min', l.duration_minutes,
        'ressenti', l.feeling,
        'energie', l.energy,
        'douleurs', case when jsonb_array_length(l.pains) > 0 then l.pains end,
        'commentaire', l.comment,
        'exercices', (
          select coalesce(jsonb_agg(p.summary order by p.first_at), '[]')
          from per_exercise p where p.workout_log_id = l.id
        )
      )) as entry
    from logs l
  ) x;
$$;

revoke all on function public.coach_history(int) from public, anon;
grant execute on function public.coach_history(int) to authenticated;

-- Rolling summary of older chat messages, so each chat call sends a short memory plus the
-- latest messages instead of the whole history. Written by the chat function (service role).
create table public.chat_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null check (char_length(summary) <= 4000),
  summarized_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.chat_memory enable row level security;
create policy "chat_memory: read own" on public.chat_memory
  for select to authenticated using (user_id = (select auth.uid()));
create policy "chat_memory: delete own" on public.chat_memory
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.chat_memory from anon, authenticated;

-- Reports are read with their newest first in the Coach tab.
create index coach_reports_user_created on public.coach_reports (user_id, created_at desc);

-- Figures of a period for the periodic reports, computed by Postgres so the coach comments on
-- real numbers and never invents them (context §10). The previous period has the same length.
create or replace function public.coach_period_metrics(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select p_from as f, p_to as t, p_from - (p_to - p_from + 1) as pf, p_from - 1 as pt
  ),
  planned as (
    select
      count(*) filter (where w.status = 'completed' or w.scheduled_date < current_date) as prevues,
      count(*) filter (where w.status = 'completed') as realisees
    from public.workouts w
    join public.programs p on p.id = w.program_id, bounds b
    where w.user_id = auth.uid() and w.scheduled_date between b.f and b.t
      and w.status <> 'skipped'
      -- Sessions of a replaced (archived) program after its replacement were never due.
      and (w.status = 'completed' or p.status <> 'archived' or w.scheduled_date < p.updated_at::date)
  ),
  vol as (
    select
      coalesce(sum(d.volume_kg) filter (where d.day between b.f and b.t), 0) as cur,
      coalesce(sum(d.volume_kg) filter (where d.day between b.pf and b.pt), 0) as prev,
      coalesce(sum(d.sessions) filter (where d.day between b.f and b.t), 0) as seances
    from public.daily_training d, bounds b
    where d.user_id = auth.uid() and d.day between b.pf and b.t
  ),
  feel as (
    select round(avg(l.feeling), 1) as ressenti, round(avg(l.energy), 1) as energie,
      count(*) filter (where jsonb_array_length(l.pains) > 0) as seances_avec_douleur
    from public.workout_logs l, bounds b
    where l.user_id = auth.uid() and l.performed_on between b.f and b.t
  ),
  muscles as (
    select coalesce(jsonb_object_agg(muscle, n order by n desc), '{}') as series
    from (
      select m as muscle, count(*) as n
      from public.set_logs s
      join public.workout_logs l on l.id = s.workout_log_id
      join public.exercises e on e.id = s.exercise_id
      cross join lateral unnest(e.primary_muscles) as m
      cross join bounds b
      where s.user_id = auth.uid() and not s.is_warmup and l.performed_on between b.f and b.t
      group by m
    ) x
  ),
  lifts as (
    -- Main lifts of the period: first and best estimated 1RM, for the 5 most worked exercises.
    select coalesce(jsonb_agg(jsonb_build_object(
      'exercise_id', exercise_id, 'nom', nom, 'rm1_debut_kg', debut, 'rm1_max_kg', best
    ) order by sets desc), '[]') as rows
    from (
      select x.exercise_id, max(e.name_fr) as nom, sum(x.sets) as sets,
        (array_agg(x.best_1rm_kg order by x.day))[1] as debut, max(x.best_1rm_kg) as best
      from public.exercise_daily_best x
      join public.exercises e on e.id = x.exercise_id, bounds b
      where x.user_id = auth.uid() and x.day between b.f and b.t and x.best_1rm_kg is not null
      group by x.exercise_id
      order by sum(x.sets) desc
      limit 5
    ) y
  ),
  prs as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'exercise_id', r.exercise_id, 'type', r.record_type, 'valeur', r.value, 'date', r.achieved_on
    ) order by r.achieved_on), '[]') as rows
    from public.personal_records r, bounds b
    where r.user_id = auth.uid() and r.achieved_on between b.f and b.t
  ),
  body as (
    select jsonb_strip_nulls(jsonb_build_object(
      'debut', (select jsonb_strip_nulls(jsonb_build_object('date', m.measured_on, 'poids_kg', m.weight_kg,
                 'tour_taille_cm', m.waist_cm, 'pourcentage_gras', m.body_fat_pct))
               from public.body_measurements m, bounds b
               where m.user_id = auth.uid() and m.measured_on between b.f and b.t
               order by m.measured_on asc limit 1),
      'fin', (select jsonb_strip_nulls(jsonb_build_object('date', m.measured_on, 'poids_kg', m.weight_kg,
               'tour_taille_cm', m.waist_cm, 'pourcentage_gras', m.body_fat_pct))
             from public.body_measurements m, bounds b
             where m.user_id = auth.uid() and m.measured_on between b.f and b.t
             order by m.measured_on desc limit 1)
    )) as row
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('debut', p_from, 'fin', p_to),
    'assiduite', jsonb_build_object(
      'prevues', planned.prevues, 'realisees', planned.realisees,
      'taux_pct', case when planned.prevues > 0 then round(100.0 * planned.realisees / planned.prevues) end),
    'seances_realisees', vol.seances,
    'volume_total_kg', round(vol.cur),
    'variation_volume_pct', case when vol.prev > 0 then round(100.0 * (vol.cur - vol.prev) / vol.prev, 1) end,
    'ressenti_moyen', feel.ressenti,
    'energie_moyenne', feel.energie,
    'seances_avec_douleur', feel.seances_avec_douleur,
    'series_par_muscle', muscles.series,
    'mouvements_cles', lifts.rows,
    'records_personnels', prs.rows,
    'mesures', body.row
  )
  from planned, vol, feel, muscles, lifts, prs, body;
$$;

revoke all on function public.coach_period_metrics(date, date) from public, anon;
grant execute on function public.coach_period_metrics(date, date) to authenticated;
