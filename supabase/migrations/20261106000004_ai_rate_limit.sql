-- Per-user rate limiting for AI Edge Functions, enforced in the database so it holds
-- across function instances. Every AI call first runs consume_ai_quota(); if it returns
-- false the function answers 429 without calling Anthropic.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index ai_usage_user_fn_date on public.ai_usage (user_id, function_name, created_at desc);

alter table public.ai_usage enable row level security;
-- Users may read their own usage (e.g. "il te reste N messages aujourd'hui"); writes go through the function below.
create policy "ai_usage: read own" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- Limits per function: (per hour, per day). Tune here without touching function code.
create table public.ai_limits (
  function_name text primary key,
  per_hour integer not null check (per_hour > 0),
  per_day integer not null check (per_day > 0)
);
alter table public.ai_limits enable row level security;
create policy "ai_limits: read" on public.ai_limits for select to authenticated using (true);

insert into public.ai_limits (function_name, per_hour, per_day) values
  ('generate-program', 3, 5),
  ('adapt-week', 3, 5),
  ('session-feedback', 6, 12),
  ('periodic-report', 4, 10),
  ('swap-exercise', 15, 40),
  ('chat', 40, 150);

-- Atomically checks the caller's quota and records the call. Returns true when allowed.
-- Runs as definer so it can insert into ai_usage, but only ever for auth.uid().
create or replace function public.consume_ai_quota(p_function text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limits public.ai_limits;
  v_hour integer;
  v_day integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_limits from public.ai_limits where function_name = p_function;
  if not found then
    raise exception 'unknown AI function %', p_function using errcode = '22023';
  end if;

  -- Serialize concurrent calls of the same user so two requests can't both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_function, 0));

  select
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*)
  into v_hour, v_day
  from public.ai_usage
  where user_id = v_user and function_name = p_function and created_at > now() - interval '1 day';

  if v_hour >= v_limits.per_hour or v_day >= v_limits.per_day then
    return false;
  end if;

  insert into public.ai_usage (user_id, function_name) values (v_user, p_function);
  return true;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;
