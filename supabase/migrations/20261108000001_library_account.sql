-- Phase 8: exercise library tab, technique sheets generated on demand, account deletion.

-- Exercises of the coach's reference library (French name) are listed first in the library tab.
alter table public.exercises
  add column is_reference boolean generated always as (name_fr <> name_en) stored;
create index exercises_reference_name on public.exercises (is_reference desc, name_fr);

-- Technique sheet (§7 "Fiche technique") written once by the coach, then shared by every user.
insert into public.ai_limits (function_name, per_hour, per_day) values ('exercise-sheet', 20, 60);
