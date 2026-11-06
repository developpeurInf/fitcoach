-- FitCoach core schema.
-- Conventions:
--   * every user-owned row carries user_id (FK auth.users, cascade delete) so RLS stays a
--     simple equality check and account deletion wipes everything;
--   * weights are stored in kg, lengths in cm; unit conversion happens in the app;
--   * enum-like values are English keys, translated by the app's i18n.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.sex as enum ('male', 'female', 'other');
create type public.fitness_level as enum ('beginner', 'intermediate', 'advanced');
create type public.training_goal as enum (
  'fat_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness', 'mobility', 'sport_performance'
);
create type public.training_location as enum ('gym', 'home', 'outdoor');
create type public.program_status as enum ('generating', 'active', 'completed', 'archived');
create type public.week_type as enum ('adaptation', 'progression', 'deload', 'test');
create type public.workout_status as enum ('planned', 'in_progress', 'completed', 'skipped');
create type public.record_type as enum ('max_load', 'estimated_1rm', 'max_reps', 'max_volume');
create type public.report_type as enum ('session', 'weekly', 'monthly', 'quarterly', 'yearly', 'adaptation');
create type public.chat_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, filled by onboarding
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) <= 60),
  birth_year smallint check (birth_year between 1900 and 2100),
  sex public.sex,
  height_cm numeric(5, 1) check (height_cm between 80 and 260),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 350),
  level public.fitness_level,
  main_goal public.training_goal,
  secondary_goals text[] not null default '{}',
  days_per_week smallint check (days_per_week between 1 and 7),
  session_minutes smallint check (session_minutes between 10 and 180),
  location public.training_location,
  equipment text[] not null default '{}',
  injuries text[] not null default '{}',
  experience text check (char_length(experience) <= 1000),
  preferences jsonb not null default '{}',
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  locale text not null default 'fr',
  timezone text not null default 'Europe/Paris',
  health_disclaimer_accepted_at timestamptz,
  gdpr_consent_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile as soon as someone signs up (email or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1), ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- array_to_string() is only STABLE, so wrap it in an IMMUTABLE function for the generated column.
create or replace function public.exercise_search_text(name_fr text, name_en text, muscles text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(coalesce(name_fr, '') || ' ' || coalesce(name_en, '') || ' ' || coalesce(array_to_string(muscles, ' '), ''))
$$;

-- ---------------------------------------------------------------------------
-- exercises: shared library (read-only for users, seeded by scripts/seed-exercises.mjs)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), -- kebab-case slug = exercise_id
  name_fr text not null,
  name_en text not null,
  category text not null,               -- strength, stretching, cardio, plyometrics...
  level public.fitness_level not null default 'beginner',
  mechanic text,                        -- compound / isolation
  force text,                           -- push / pull / static
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  instructions_en text[] not null default '{}',
  instructions_fr text[] not null default '{}',
  common_mistakes_fr text[] not null default '{}',
  breathing_tip_fr text,
  easier_variant_id text references public.exercises (id) on delete set null,
  harder_variant_id text references public.exercises (id) on delete set null,
  -- Media: only URLs that come from a real source (seed), never generated by the AI.
  image_urls text[] not null default '{}',
  gif_url text,
  youtube_video_id text check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_search_query text,
  source text not null default 'custom', -- free-exercise-db, wger, exercisedb, custom
  source_id text,
  license text,
  search_text text generated always as (
    public.exercise_search_text(name_fr, name_en, primary_muscles)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create index exercises_search_trgm on public.exercises using gin (search_text extensions.gin_trgm_ops);
create index exercises_primary_muscles on public.exercises using gin (primary_muscles);
create index exercises_equipment on public.exercises using gin (equipment);
create index exercises_level on public.exercises (level);

-- ---------------------------------------------------------------------------
-- programs → workouts → workout_exercises (what the coach planned)
-- ---------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  structure text,                       -- full_body, upper_lower, ppl...
  duration_weeks smallint not null check (duration_weeks between 1 and 16),
  start_date date not null,
  status public.program_status not null default 'active',
  ai_payload jsonb,                     -- validated JSON returned by the coach (schema 8.2)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create index programs_user_status on public.programs (user_id, status);
-- At most one active program per user.
create unique index programs_one_active on public.programs (user_id) where status = 'active';

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_number smallint not null check (week_number >= 1),
  week_type public.week_type not null default 'progression',
  scheduled_date date not null,
  title text not null,
  estimated_minutes smallint check (estimated_minutes between 5 and 240),
  warmup jsonb not null default '[]',   -- [{ nom, duree_sec }]
  cooldown jsonb not null default '[]',
  motivation_message text,
  status public.workout_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();
create index workouts_user_date on public.workouts (user_id, scheduled_date);
create index workouts_program_week on public.workouts (program_id, week_number);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position >= 1),
  exercise_id text not null references public.exercises (id) on update cascade,
  sets smallint not null check (sets between 1 and 20),
  reps text not null check (reps ~ '^\d{1,3}(-\d{1,3})?$'),   -- "8" or "6-8"; holds use duration_sec
  duration_sec smallint check (duration_sec > 0),
  suggested_load_kg numeric(6, 2) check (suggested_load_kg >= 0),
  tempo text check (tempo ~ '^[0-9X]-[0-9X]-[0-9X]-[0-9X]$'),
  rest_sec smallint check (rest_sec between 0 and 900),
  target_rpe numeric(3, 1) check (target_rpe between 1 and 10),
  notes text,
  replaced_from text references public.exercises (id),  -- set when the user swapped this exercise
  created_at timestamptz not null default now(),
  unique (workout_id, position) deferrable initially deferred
);

create index workout_exercises_user on public.workout_exercises (user_id);
create index workout_exercises_workout on public.workout_exercises (workout_id);

-- ---------------------------------------------------------------------------
-- workout_logs → set_logs (what the user actually did)
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null, -- null = free session
  performed_on date not null default current_date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_minutes smallint check (duration_minutes between 0 and 600),
  feeling smallint check (feeling between 1 and 5),
  energy smallint check (energy between 1 and 5),
  pains jsonb not null default '[]',    -- [{ exercise_id, zone, intensite, note }]
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at)
);

create trigger workout_logs_updated_at before update on public.workout_logs
  for each row execute function public.set_updated_at();
create index workout_logs_user_date on public.workout_logs (user_id, performed_on desc);
create index workout_logs_workout on public.workout_logs (workout_id);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises (id) on delete set null,
  exercise_id text not null references public.exercises (id) on update cascade,
  set_number smallint not null check (set_number >= 1),
  reps smallint check (reps between 0 and 500),
  load_kg numeric(6, 2) check (load_kg >= 0),
  duration_sec smallint check (duration_sec >= 0),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  -- Derived values kept in sync by Postgres: tonnage and Epley 1RM (load × (1 + reps / 30)).
  volume_kg numeric(10, 2) generated always as (coalesce(reps, 0) * coalesce(load_kg, 0)) stored,
  estimated_1rm_kg numeric(7, 2) generated always as (
    case when reps > 0 and load_kg > 0 then round(load_kg * (1 + reps / 30.0), 2) end
  ) stored,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workout_log_id, exercise_id, set_number)
);

create index set_logs_user_exercise_date on public.set_logs (user_id, exercise_id, performed_at desc);
create index set_logs_log on public.set_logs (workout_log_id);

-- ---------------------------------------------------------------------------
-- body_measurements (+ optional photo stored in the progress-photos bucket)
-- ---------------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 1) check (weight_kg between 25 and 350),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  hips_cm numeric(5, 1) check (hips_cm between 30 and 250),
  arm_cm numeric(5, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5, 1) check (thigh_cm between 20 and 150),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  photo_path text,                      -- storage path: <user_id>/<file>
  notes text,
  created_at timestamptz not null default now()
);

create index body_measurements_user_date on public.body_measurements (user_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- personal_records
-- ---------------------------------------------------------------------------
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on update cascade,
  record_type public.record_type not null,
  value numeric(10, 2) not null,
  reps smallint,
  load_kg numeric(6, 2),
  set_log_id uuid references public.set_logs (id) on delete set null,
  achieved_on date not null default current_date,
  celebrated_at timestamptz,            -- set once the app has shown the celebration
  created_at timestamptz not null default now()
);

create index personal_records_user_exercise on public.personal_records (user_id, exercise_id, record_type, value desc);
create index personal_records_user_date on public.personal_records (user_id, achieved_on desc);

-- ---------------------------------------------------------------------------
-- coach_reports (session / weekly / monthly / quarterly / yearly / adaptation)
-- ---------------------------------------------------------------------------
create table public.coach_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_type public.report_type not null,
  period_start date not null,
  period_end date not null,
  workout_log_id uuid references public.workout_logs (id) on delete cascade,
  payload jsonb not null,               -- validated JSON (schema 9.3)
  model text,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index coach_reports_user_type_date on public.coach_reports (user_id, report_type, period_start desc);
-- One report per period and type (session reports are keyed by their log).
create unique index coach_reports_unique_period on public.coach_reports (user_id, report_type, period_start, period_end)
  where workout_log_id is null;
create unique index coach_reports_unique_session on public.coach_reports (workout_log_id)
  where workout_log_id is not null;

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.chat_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  workout_log_id uuid references public.workout_logs (id) on delete set null, -- sent during a session
  created_at timestamptz not null default now()
);

create index chat_messages_user_date on public.chat_messages (user_id, created_at desc);
