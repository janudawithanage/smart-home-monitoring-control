-- ============================================================================
-- Smart Home Monitoring & Control — Supabase Database Schema
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Order: extensions → tables (dependency order) → indexes → trigger → RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extensions
--    gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs PG 15),
--    so NO extension is required for UUID defaults. If you prefer
--    uuid_generate_v4() instead, uncomment the line below (needs pgcrypto).
-- ----------------------------------------------------------------------------
-- create extension if not exists pgcrypto;

-- ============================================================================
-- 1) TABLES (in dependency order so FK references resolve)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a) floors
-- ----------------------------------------------------------------------------
create table public.floors (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  level               integer not null default 0,
  device_count        integer not null default 0,
  active_device_count integer not null default 0,
  floor_plan_url      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint floors_level_non_negative check (level >= 0)
);

-- ----------------------------------------------------------------------------
-- 1b) devices
-- ----------------------------------------------------------------------------
create table public.devices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  floor_id       uuid references public.floors (id) on delete cascade,
  name           text not null,
  type           text not null check (type in ('light', 'thermostat', 'lock', 'camera',
                                               'fan', 'tv', 'speaker', 'outlet',
                                               'iron', 'multiSwitch')),
  status         text not null default 'off' check (status in ('on', 'off', 'error', 'offline')),
  room_name      text,
  value          numeric,
  unit           text,
  icon_name      text,
  safety_timeout integer check (safety_timeout is null or safety_timeout > 0),
  last_updated   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1c) switch_circuits (multi-switch / gang-box devices)
-- ----------------------------------------------------------------------------
create table public.switch_circuits (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices (id) on delete cascade,
  name       text not null,
  status     text not null default 'off' check (status in ('on', 'off', 'error', 'disconnected')),
  power      numeric,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1d) schedules (time-based + safety-timeout)
-- ----------------------------------------------------------------------------
create table public.schedules (
  id                   uuid primary key default gen_random_uuid(),
  device_id            uuid not null references public.devices (id) on delete cascade,
  type                 text not null check (type in ('time', 'safety')),
  enabled              boolean not null default true,
  time                 time,
  action               text check (action in ('on', 'off')),
  days                 integer[],
  max_duration_minutes integer check (max_duration_minutes is null or max_duration_minutes > 0),
  created_at           timestamptz not null default now(),
  -- days: 0 = Sunday … 6 = Saturday (matches JS Date.getDay() / the app's UI)
  constraint schedules_days_valid check (days is null or days <@ array[0, 1, 2, 3, 4, 5, 6])
);

-- ----------------------------------------------------------------------------
-- 1e) floor_plan_pins
-- ----------------------------------------------------------------------------
create table public.floor_plan_pins (
  id         uuid primary key default gen_random_uuid(),
  floor_id   uuid not null references public.floors (id) on delete cascade,
  device_id  uuid not null references public.devices (id) on delete cascade,
  x          numeric not null check (x between 0 and 100),
  y          numeric not null check (y between 0 and 100),
  created_at timestamptz not null default now(),
  -- One pin per device per floor; also allows simple "upsert on conflict"
  constraint floor_plan_pins_floor_device_unique unique (floor_id, device_id)
);

-- ----------------------------------------------------------------------------
-- 1f) alerts (backs the notifications screen)
-- ----------------------------------------------------------------------------
create table public.alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  device_id  uuid references public.devices (id) on delete set null,
  type       text not null check (type in ('safety', 'error', 'offline', 'info')),
  title      text not null,
  message    text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2) INDEXES on every foreign key column (Postgres does NOT index FKs by default)
--    Unique indexes for PKs already exist. FKs + user-scoped queries get indexes.
-- ============================================================================
create index floors_user_idx          on public.floors (user_id);
create index devices_user_idx         on public.devices (user_id);
create index devices_floor_idx        on public.devices (floor_id);
create index switch_circuits_device_idx on public.switch_circuits (device_id);
create index schedules_device_idx     on public.schedules (device_id);
create index floor_plan_pins_floor_idx  on public.floor_plan_pins (floor_id);
create index floor_plan_pins_device_idx on public.floor_plan_pins (device_id);
create index alerts_user_idx          on public.alerts (user_id);
create index alerts_device_idx        on public.alerts (device_id);

-- ============================================================================
-- 3) updated_at TRIGGER (floors — extend to other tables if you want the same)
-- ============================================================================
create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger floors_updated_at
  before update on public.floors
  for each row execute function public.set_updated_at ();

-- To keep devices.updated_at in sync too (uncomment):
-- create trigger devices_updated_at
--   before update on public.devices
--   for each row execute function public.set_updated_at();

-- ============================================================================
-- 4) ROW-LEVEL SECURITY
--    Enable RLS on every table, then add per-table policies.
--    Direct ownership via user_id  → floors / devices / alerts
--    Inherited via parent device   → switch_circuits / schedules
--    Inherited via parent floor+device → floor_plan_pins
-- ============================================================================
alter table public.floors          enable row level security;
alter table public.devices         enable row level security;
alter table public.switch_circuits enable row level security;
alter table public.schedules       enable row level security;
alter table public.floor_plan_pins enable row level security;
alter table public.alerts          enable row level security;

-- --- floors (direct) ---
create policy "floors select own" on public.floors
  for select using (auth.uid () = user_id);
create policy "floors insert own" on public.floors
  for insert with check (auth.uid () = user_id);
create policy "floors update own" on public.floors
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "floors delete own" on public.floors
  for delete using (auth.uid () = user_id);

-- --- devices (direct + safeguard: only attach to your own floor) ---
create policy "devices select own" on public.devices
  for select using (auth.uid () = user_id);
create policy "devices insert own" on public.devices
  for insert with check (
    auth.uid () = user_id
    and (
      floor_id is null
      or exists (
        select 1 from public.floors f where f.id = floor_id and f.user_id = auth.uid ()
      )
    )
  );
create policy "devices update own" on public.devices
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "devices delete own" on public.devices
  for delete using (auth.uid () = user_id);

-- --- switch_circuits (ownership via parent device) ---
create policy "circuits select own" on public.switch_circuits
  for select using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "circuits insert own" on public.switch_circuits
  for insert with check (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "circuits update own" on public.switch_circuits
  for update using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  ) with check (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "circuits delete own" on public.switch_circuits
  for delete using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );

-- --- schedules (ownership via parent device) ---
create policy "schedules select own" on public.schedules
  for select using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "schedules insert own" on public.schedules
  for insert with check (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "schedules update own" on public.schedules
  for update using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  ) with check (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "schedules delete own" on public.schedules
  for delete using (
    exists (
      select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid ()
    )
  );

-- --- floor_plan_pins (ownership via parent floor + device) ---
create policy "pins select own" on public.floor_plan_pins
  for select using (
    exists (
      select 1 from public.floors f where f.id = floor_id and f.user_id = auth.uid ()
    )
  );
create policy "pins insert own" on public.floor_plan_pins
  for insert with check (
    exists (
      select 1
      from public.floors f
      where f.id = floor_id and f.user_id = auth.uid ()
    )
    and exists (
      select 1
      from public.devices d
      where d.id = device_id and d.user_id = auth.uid ()
    )
  );
create policy "pins update own" on public.floor_plan_pins
  for update using (
    exists (
      select 1 from public.floors f where f.id = floor_id and f.user_id = auth.uid ()
    )
  ) with check (
    exists (
      select 1 from public.floors f where f.id = floor_id and f.user_id = auth.uid ()
    )
  );
create policy "pins delete own" on public.floor_plan_pins
  for delete using (
    exists (
      select 1 from public.floors f where f.id = floor_id and f.user_id = auth.uid ()
    )
  );

-- --- alerts (direct) ---
create policy "alerts select own" on public.alerts
  for select using (auth.uid () = user_id);
create policy "alerts insert own" on public.alerts
  for insert with check (auth.uid () = user_id);
create policy "alerts update own" on public.alerts
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "alerts delete own" on public.alerts
  for delete using (auth.uid () = user_id);

-- ============================================================================
-- 5) REALTIME (postgres_changes)
--    Required for live UI sync (Supabase realtime subscriptions).
--    Run AFTER tables exist; re-running will error on tables already published.
-- ============================================================================
alter publication supabase_realtime add table public.floors;
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.switch_circuits;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.floor_plan_pins;
alter publication supabase_realtime add table public.alerts;

-- ============================================================================
-- Done. Sanity checks you can run:
--   select tablename from pg_tables where schemaname = 'public';
--   select tablename, policyname from pg_policies where schemaname = 'public';
-- ============================================================================