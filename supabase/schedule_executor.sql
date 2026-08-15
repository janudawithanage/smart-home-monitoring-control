-- ============================================================================
-- Schedule Executor (server-side time-based automation)
-- ----------------------------------------------------------------------------
-- Fires time schedules: for each enabled 'time' schedule whose day-of-week is
-- in days[] and whose HH:MM matches now, sets the device to the schedule's
-- action. Runs via pg_cron, independent of the app being open.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Prerequisite: run supabase/safety_cutoff.sql first — it defines the
-- `set_device_on_since` trigger that this file relies on to maintain on_since
-- on the status transition (schedule -> 'on' sets on_since, -> 'off' clears it).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Column: when the schedule last fired (date) — prevents re-triggering
--    within the same day (the cron job runs every minute).
-- ----------------------------------------------------------------------------
alter table public.schedules add column if not exists last_triggered_date date;

-- ----------------------------------------------------------------------------
-- 1) Executor
--    Day indexing: extract(dow) → 0=Sunday … 6=Saturday, matching the app's
--    JS Date.getDay() and the schedules_days_valid check constraint.
--    Time match: to_char HH:MI equality mirrors the client's exact-minute
--    comparison (true for the whole trigger minute, false a minute later).
-- ----------------------------------------------------------------------------
create or replace function public.run_schedule_executor()
returns void
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  for s in
    select sch.id, sch.device_id, sch.action, sch.time, d.user_id, d.name, d.status
    from public.schedules sch
    join public.devices d on d.id = sch.device_id
    where sch.type = 'time'
      and sch.enabled
      and sch.time is not null
      and sch.action is not null
      and sch.days is not null
      and sch.days @> array[extract(dow from now())::int]
      and to_char(now(), 'HH24:MI') = to_char(sch.time, 'HH24:MI')
      and (sch.last_triggered_date is null or sch.last_triggered_date <> current_date)
  loop
    -- Skip no-op writes when the device is already in the target state.
    if s.status <> s.action then
      -- on_since is maintained by the set_device_on_since trigger (safety_cutoff.sql)
      update public.devices
         set status = s.action, last_updated = now()
       where id = s.device_id;

      insert into public.alerts (user_id, device_id, type, title, message)
      values (
        s.user_id,
        s.device_id,
        'info',
        'Schedule triggered',
        format('%s turned %s by schedule at %s', s.name, s.action, to_char(s.time, 'HH24:MI'))
      );
    end if;

    update public.schedules set last_triggered_date = current_date where id = s.id;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Schedule — every minute (idempotent re-scheduling)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'schedule-executor') then
    perform cron.unschedule('schedule-executor');
  end if;
end $$;

select cron.schedule('schedule-executor', '* * * * *', $$ select public.run_schedule_executor(); $$);

-- ----------------------------------------------------------------------------
-- Sanity checks:
--   select jobname, schedule, command from cron.job where jobname = 'schedule-executor';
--   select * from public.schedules where type = 'time' and enabled;
--   select run_schedule_executor();   -- manual run (idempotent)
-- ----------------------------------------------------------------------------
