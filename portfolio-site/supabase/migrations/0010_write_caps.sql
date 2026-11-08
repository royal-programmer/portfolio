-- ============================================================================
-- 0010_write_caps.sql
-- Hourly write caps for the two public-write tables, enforced in the database
-- so they hold on serverless (an in-memory limiter resets with every instance):
--   leads        ≤ 60 rows per hour
--   term_events  ≤ 5000 rows per hour
-- A capped insert raises 'leads_hourly_cap' / 'term_events_hourly_cap'; the API
-- turns that into a 429 (leads) or a silent 204 (events).
-- ============================================================================

create or replace function public.enforce_hourly_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int := tg_argv[0]::int;
  n int;
begin
  execute format('select count(*) from %I where created_at > now() - interval ''1 hour''', tg_table_name) into n;
  if n >= cap then
    raise exception '%_hourly_cap', tg_table_name using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists leads_hourly_cap on leads;
create trigger leads_hourly_cap before insert on leads
  for each row execute function public.enforce_hourly_cap('60');

drop trigger if exists term_events_hourly_cap on term_events;
create trigger term_events_hourly_cap before insert on term_events
  for each row execute function public.enforce_hourly_cap('5000');
