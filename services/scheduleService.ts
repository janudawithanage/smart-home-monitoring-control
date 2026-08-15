/**
 * scheduleService
 *
 * CRUD operations for device schedules, backed by Supabase.
 * Supports both time-based and safety timeout schedules.
 */

import { supabase } from './supabase';
import { subscribeToTable, RealtimeEvent } from './realtime';
import { Schedule } from '@/types/device';

// ─── Time zone conversion ─────────────────────────────────────────────────────
// The DB stores schedule `time` in UTC; the app's domain model uses the device's
// local time. These helpers convert across that boundary using the device's real
// time zone (via Date), not a hard-coded offset.
//
// DST note: "today" is used as the reference date, so conversion is exact for
// time zones without DST (e.g. Sri Lanka). For DST-observing zones a schedule
// recurring across a transition could be off by an hour on the far side.

function parseHm(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h || 0, m || 0];
}

/** Local "HH:MM" → UTC "HH:MM" (used on write). */
function localTimeToUtc(time: string): string {
  const [h, m] = parseHm(time);
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

/** UTC "HH:MM" → local "HH:MM" (used on read). */
function utcTimeToLocal(time: string): string {
  const [h, m] = parseHm(time);
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
  return `${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`;
}

// ─── Row → domain mapper (snake_case DB columns → camelCase type) ────────────

interface ScheduleRow {
  id: string;
  device_id: string;
  type: 'time' | 'safety';
  enabled: boolean;
  time: string | null;
  action: 'on' | 'off' | null;
  days: number[] | null;
  max_duration_minutes: number | null;
  created_at: string;
}

function mapSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    deviceId: row.device_id,
    type: row.type,
    enabled: row.enabled,
    time: row.time ? utcTimeToLocal(row.time.slice(0, 5)) : undefined, // UTC "HH:MM:SS" → local "HH:MM"
    action: row.action ?? undefined,
    days: row.days ?? undefined,
    maxDurationMinutes: row.max_duration_minutes ?? undefined,
  };
}

// ─── Realtime subscription ───────────────────────────────────────────────────

/**
 * Subscribe to changes on the `schedules` table. Returns an unsubscribe fn.
 * Use `filter` (e.g. `device_id=eq.<uuid>`) to narrow to one device's schedules.
 */
export function subscribeToSchedules(
  onChange: (event: RealtimeEvent, schedule?: Schedule) => void,
  filter?: string,
): () => void {
  return subscribeToTable<Schedule>(
    'schedules',
    (row) => mapSchedule(row as unknown as ScheduleRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
    filter,
  );
}

// ─── Get Schedules ───────────────────────────────────────────────────────────

export async function getAllSchedules(): Promise<Schedule[]> {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapSchedule(row as ScheduleRow));
  } catch (error) {
    console.error('getAllSchedules failed:', error);
    return [];
  }
}

export async function getScheduleById(id: string): Promise<Schedule | undefined> {
  try {
    const { data, error } = await supabase.from('schedules').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapSchedule(data as ScheduleRow) : undefined;
  } catch (error) {
    console.error('getScheduleById failed:', error);
    return undefined;
  }
}

export async function getSchedulesForDevice(deviceId: string): Promise<Schedule[]> {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapSchedule(row as ScheduleRow));
  } catch (error) {
    console.error('getSchedulesForDevice failed:', error);
    return [];
  }
}

// ─── Create Schedule ─────────────────────────────────────────────────────────

export async function addSchedule(data: Omit<Schedule, 'id'>): Promise<Schedule> {
  const { data: row, error } = await supabase
    .from('schedules')
    .insert({
      device_id: data.deviceId,
      type: data.type,
      enabled: data.enabled,
      time: data.time ? localTimeToUtc(data.time) : null,
      action: data.action ?? null,
      days: data.days ?? null,
      max_duration_minutes: data.maxDurationMinutes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSchedule(row as ScheduleRow);
}

// ─── Update Schedule ─────────────────────────────────────────────────────────

export async function updateSchedule(
  id: string,
  patch: Partial<Omit<Schedule, 'id' | 'deviceId'>>,
): Promise<Schedule | undefined> {
  try {
    const dbPatch: Record<string, unknown> = {};
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
    if (patch.time !== undefined) dbPatch.time = localTimeToUtc(patch.time);
    if (patch.action !== undefined) dbPatch.action = patch.action;
    if (patch.days !== undefined) dbPatch.days = patch.days;
    if (patch.maxDurationMinutes !== undefined) dbPatch.max_duration_minutes = patch.maxDurationMinutes;

    const { data, error } = await supabase
      .from('schedules')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapSchedule(data as ScheduleRow) : undefined;
  } catch (error) {
    console.error('updateSchedule failed:', error);
    return undefined;
  }
}

// ─── Toggle Schedule ─────────────────────────────────────────────────────────

export async function toggleSchedule(id: string): Promise<Schedule | undefined> {
  const schedule = await getScheduleById(id);
  if (!schedule) return undefined;
  return updateSchedule(id, { enabled: !schedule.enabled });
}

// ─── Delete Schedule ─────────────────────────────────────────────────────────

export async function deleteSchedule(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteSchedule failed:', error);
    return false;
  }
}

// ─── Schedule Evaluation (for simulating schedule execution) ────────────────

/**
 * Check if a schedule should trigger now.
 * This would typically run in a background service or be handled by the backend.
 * Note: `schedule.time` is local time (mapSchedule converts UTC → local), and
 * `now` is local, so the comparison is timezone-consistent.
 */
export function shouldScheduleTrigger(schedule: Schedule, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false;

  if (schedule.type === 'time' && schedule.time && schedule.days) {
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return schedule.days.includes(currentDay) && currentTime === schedule.time;
  }

  // Safety schedules are handled differently (not time-based triggers)
  return false;
}

/**
 * Get all schedules that should trigger now.
 */
export async function getTriggeredSchedules(now: Date = new Date()): Promise<Schedule[]> {
  const schedules = await getAllSchedules();
  return schedules.filter((s) => shouldScheduleTrigger(s, now));
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export async function deleteAllSchedulesForDevice(deviceId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .delete()
      .eq('device_id', deviceId)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  } catch (error) {
    console.error('deleteAllSchedulesForDevice failed:', error);
    return 0;
  }
}

export async function enableAllSchedulesForDevice(deviceId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedules')
      .update({ enabled: true })
      .eq('device_id', deviceId);
    if (error) throw error;
  } catch (error) {
    console.error('enableAllSchedulesForDevice failed:', error);
  }
}

export async function disableAllSchedulesForDevice(deviceId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedules')
      .update({ enabled: false })
      .eq('device_id', deviceId);
    if (error) throw error;
  } catch (error) {
    console.error('disableAllSchedulesForDevice failed:', error);
  }
}
