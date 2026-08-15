-- ============================================================================
-- Device Usage Log (energy monitoring)
-- ----------------------------------------------------------------------------
-- Records every completed "on" session so the energy screen can aggregate real
-- usage. A trigger on `devices` logs a row whenever a device leaves the 'on'
-- state, regardless of what caused the transition (app toggle, safety cutoff,
-- or schedule executor — they all hit the same trigger).
--
-- Run this ONCE in the Supabase SQL Editor. Prerequisite: supabase/safety_cutoff.sql
-- (defines the `devices.on_since` column + `set_device_on_since` trigger that
-- records when a device turned on).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Table
-- ----------------------------------------------------------------------------
create table public.device_usage_log (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references public.devices (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  constraint device_usage_log_time_order check (ended_at >= started_at)
);

create index device_usage_log_device_idx on public.device_usage_log (device_id, started_at);

-- ----------------------------------------------------------------------------
-- 2) Trigger: log a session when a device leaves 'on'
--    - OLD.on_since is the session start (set by set_device_on_since).
--    - `after update of status` fires only when `status` is in the SET list, so
--      brightness/value/name writes never create spurious logs.
-- ----------------------------------------------------------------------------
create or replace function public.log_device_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'on' and new.status is distinct from 'on' and old.on_since is not null then
    insert into public.device_usage_log (device_id, started_at, ended_at)
    values (old.id, old.on_since, now());
  end if;
  return new;
end;
$$;

drop trigger if exists devices_log_session on public.devices;
create trigger devices_log_session
  after update of status on public.devices
  for each row execute function public.log_device_session();

-- ----------------------------------------------------------------------------
-- 3) Row-level security (ownership via parent device, like schedules/circuits)
-- ----------------------------------------------------------------------------
alter table public.device_usage_log enable row level security;

create policy "usage_log select own" on public.device_usage_log
  for select using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
  );
create policy "usage_log insert own" on public.device_usage_log
  for insert with check (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 4) Aggregation helper (RPC): per-device on-time seconds since a timestamp.
--    Combines completed sessions (device_usage_log) with currently-running
--    sessions (devices.on_since), each clipped to the [since, now] window.
--    Runs with invoker rights so RLS scopes it to the caller's own devices.
-- ----------------------------------------------------------------------------
create or replace function public.device_usage_seconds(since timestamptz)
returns table (device_id uuid, duration_seconds double precision)
language sql
set search_path = public
as $$
  select t.device_id, sum(t.duration_seconds) as duration_seconds
  from (
    select l.device_id,
           date_part('epoch', least(l.ended_at, now()) - greatest(l.started_at, since)) as duration_seconds
    from public.device_usage_log l
    where l.ended_at > since
      and l.started_at < now()
    union all
    select d.id,
           date_part('epoch', now() - greatest(d.on_since, since)) as duration_seconds
    from public.devices d
    where d.status = 'on'
      and d.on_since is not null
      and d.on_since < now()
  ) t
  where t.duration_seconds > 0
  group by t.device_id;
$$;

-- ----------------------------------------------------------------------------
-- Sanity checks:
--   select * from public.device_usage_log order by ended_at desc limit 10;
--   select * from public.device_usage_seconds(now() - interval '1 day');
-- ----------------------------------------------------------------------------
