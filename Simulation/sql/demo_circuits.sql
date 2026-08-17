-- ============================================================================
-- OPTIONAL demo seed — multi-switch gangs for the hardware simulator.
-- Run in the Supabase SQL editor while signed in as the owner of the device
-- (RLS on switch_circuits checks ownership through the parent device).
--
-- Nothing in the app depends on this; it only gives the simulator's gang-box
-- card something to render.
-- ============================================================================

-- 1) Find the multiSwitch device you want to populate:
--    select id, name, room_name from public.devices where type = 'multiSwitch';

-- 2) Seed a 3-gang unit (replace the UUID with the id from step 1):
insert into public.switch_circuits (device_id, name, status, power, position)
values
  ('00000000-0000-0000-0000-000000000000', 'Ceiling light', 'off', 18,  0),
  ('00000000-0000-0000-0000-000000000000', 'Wall lamp',     'off', 9,   1),
  ('00000000-0000-0000-0000-000000000000', 'Exhaust fan',   'off', 45,  2);

-- 3) Verify:
--    select name, status, power from public.switch_circuits order by position;
