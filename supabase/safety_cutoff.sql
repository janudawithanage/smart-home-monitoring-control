-- ============================================================================
-- Safety Cutoff (server-side auto-shutoff)
-- ----------------------------------------------------------------------------
-- Turns off any device whose `safety_timeout` (minutes) has elapsed since it
-- was turned on, and inserts a `safety` alert for the owner. Runs entirely in
-- the database via pg_cron — independent of the app being open.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Prerequisite: pg_cron enabled (Dashboard → Database → Extensions → pg_cron).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extension
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;

-- ----------------------------------------------------------------------------
-- 1) New column: on_since
--    `last_updated` is bumped on *every* write (toggle, value/brightness change),
--    so it cannot tell us when a device was turned ON. `on_since` records the
--    exact transition to 'on' and is cleared when the device leaves 'on'.
--
--    ALTER TABLE (shown explicitly per request):
-- ----------------------------------------------------------------------------
alter table public.devices add column if not exists on_since timestamptz;

-- ----------------------------------------------------------------------------
-- 2) Trigger to keep on_since in sync on every status change
--    (before insert or update — handles the app AND any future hardware
--    simulator write path without touching client code).
-- ----------------------------------------------------------------------------
create or replace function public.set_device_on_since()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'on' and (old.status is distinct from 'on') then
    new.on_since = now();

    -- Safety log: when a monitored (safety_timeout) device turns on, record a
    -- notification so the user sees the "will auto-off in N min" event in the
    -- Notifications screen. The cutoff event itself is logged separately by
    -- run_safety_cutoff() below.
    if new.safety_timeout is not null then
      insert into public.alerts (user_id, device_id, type, title, message)
      values (
        new.user_id,
        new.id,
        'safety',
        'Safety monitoring started',
        format('%s turned on — auto shut-off in %s minute(s)', new.name, new.safety_timeout)
      );
    end if;
  elsif new.status <> 'on' then
    new.on_since = null;
  end if;
  return new;
end;
$$;

drop trigger if exists devices_set_on_since on public.devices;
create trigger devices_set_on_since
  before insert or update on public.devices
  for each row execute function public.set_device_on_since();

-- One-time backfill for devices already 'on' at migration time (no on_since yet).
update public.devices
   set on_since = last_updated
 where status = 'on' and on_since is null;

-- ----------------------------------------------------------------------------
-- 3) Cutoff function
--    Finds devices: status='on', safety_timeout set, and on_since older than
--    the timeout. Turns each off and inserts a safety alert for its owner.
-- ----------------------------------------------------------------------------
create or replace function public.run_safety_cutoff()
returns void
language plpgsql
set search_path = public
as $$
declare
  dev record;
begin
  for dev in
    select d.id, d.user_id, d.name, d.safety_timeout
    from public.devices d
    where d.status = 'on'
      and d.safety_timeout is not null
      and d.on_since is not null
      and d.on_since + make_interval(mins => d.safety_timeout) <= now()
  loop
    update public.devices
       set status = 'off', last_updated = now()
     where id = dev.id;

    insert into public.alerts (user_id, device_id, type, title, message)
    values (
      dev.user_id,
      dev.id,
      'safety',
      'Safety cutoff triggered',
      format('%s automatically turned off after %s minute(s)', dev.name, dev.safety_timeout)
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Schedule — every minute (idempotent re-scheduling)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'safety-cutoff') then
    perform cron.unschedule('safety-cutoff');
  end if;
end $$;

select cron.schedule('safety-cutoff', '* * * * *', $$ select public.run_safety_cutoff(); $$);

-- ----------------------------------------------------------------------------
-- Sanity checks:
--   select jobname, schedule, command from cron.job where jobname = 'safety-cutoff';
--   select * from public.devices where safety_timeout is not null;
--   select run_safety_cutoff();   -- manual run
-- ----------------------------------------------------------------------------
