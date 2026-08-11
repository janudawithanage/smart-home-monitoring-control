/**
 * scheduleService
 *
 * Provides CRUD operations for device schedules.
 * Supports both time-based and safety timeout schedules.
 */

import { DEVICES } from '@/data/mockData';
import { Schedule } from '@/types/device';

// In-memory storage for schedules
// In a real app, this would be persisted to AsyncStorage, Supabase, or similar
let SCHEDULES: Schedule[] = [
  // Example schedules
  {
    id: 's1',
    deviceId: 'd4', // Iron
    type: 'safety',
    enabled: true,
    maxDurationMinutes: 30,
  },
  {
    id: 's2',
    deviceId: 'd1',
    type: 'time',
    enabled: true,
    time: '07:00',
    action: 'on',
    days: [1, 2, 3, 4, 5], // Weekdays
  },
  {
    id: 's3',
    deviceId: 'd1',
    type: 'time',
    enabled: true,
    time: '23:00',
    action: 'off',
    days: [0, 1, 2, 3, 4, 5, 6], // Every day
  },
];

// ─── Get Schedules ───────────────────────────────────────────────────────────

export async function getAllSchedules(): Promise<Schedule[]> {
  return Promise.resolve([...SCHEDULES]);
}

export async function getScheduleById(id: string): Promise<Schedule | undefined> {
  return Promise.resolve(SCHEDULES.find((s) => s.id === id));
}

export async function getSchedulesForDevice(deviceId: string): Promise<Schedule[]> {
  return Promise.resolve(SCHEDULES.filter((s) => s.deviceId === deviceId));
}

// ─── Create Schedule ─────────────────────────────────────────────────────────

export async function addSchedule(
  data: Omit<Schedule, 'id'>
): Promise<Schedule> {
  const newSchedule: Schedule = {
    id: `s${Date.now()}`,
    ...data,
  };

  SCHEDULES.push(newSchedule);

  // Update the device's schedules array
  const device = DEVICES.find((d) => d.id === data.deviceId);
  if (device) {
    device.schedules = device.schedules || [];
    device.schedules.push(newSchedule);
  }

  return Promise.resolve({ ...newSchedule });
}

// ─── Update Schedule ─────────────────────────────────────────────────────────

export async function updateSchedule(
  id: string,
  patch: Partial<Omit<Schedule, 'id' | 'deviceId'>>
): Promise<Schedule | undefined> {
  const idx = SCHEDULES.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;

  SCHEDULES[idx] = { ...SCHEDULES[idx], ...patch };

  // Update in device's schedules array
  const device = DEVICES.find((d) => d.id === SCHEDULES[idx].deviceId);
  if (device && device.schedules) {
    const deviceScheduleIdx = device.schedules.findIndex((s) => s.id === id);
    if (deviceScheduleIdx !== -1) {
      device.schedules[deviceScheduleIdx] = { ...SCHEDULES[idx] };
    }
  }

  return Promise.resolve({ ...SCHEDULES[idx] });
}

// ─── Toggle Schedule ─────────────────────────────────────────────────────────

export async function toggleSchedule(id: string): Promise<Schedule | undefined> {
  const schedule = SCHEDULES.find((s) => s.id === id);
  if (!schedule) return undefined;

  return updateSchedule(id, { enabled: !schedule.enabled });
}

// ─── Delete Schedule ─────────────────────────────────────────────────────────

export async function deleteSchedule(id: string): Promise<boolean> {
  const schedule = SCHEDULES.find((s) => s.id === id);
  if (!schedule) return false;

  const before = SCHEDULES.length;
  SCHEDULES = SCHEDULES.filter((s) => s.id !== id);

  // Remove from device's schedules array
  const device = DEVICES.find((d) => d.id === schedule.deviceId);
  if (device && device.schedules) {
    device.schedules = device.schedules.filter((s) => s.id !== id);
  }

  return Promise.resolve(SCHEDULES.length < before);
}

// ─── Schedule Evaluation (for simulating schedule execution) ────────────────

/**
 * Check if a schedule should trigger now.
 * This would typically run in a background service or be handled by the backend.
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
  return Promise.resolve(SCHEDULES.filter((s) => shouldScheduleTrigger(s, now)));
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export async function deleteAllSchedulesForDevice(deviceId: string): Promise<number> {
  const before = SCHEDULES.length;
  SCHEDULES = SCHEDULES.filter((s) => s.deviceId !== deviceId);

  // Clear from device
  const device = DEVICES.find((d) => d.id === deviceId);
  if (device) {
    device.schedules = [];
  }

  return Promise.resolve(before - SCHEDULES.length);
}

export async function enableAllSchedulesForDevice(deviceId: string): Promise<void> {
  SCHEDULES.forEach((s) => {
    if (s.deviceId === deviceId) {
      s.enabled = true;
    }
  });

  // Update device
  const device = DEVICES.find((d) => d.id === deviceId);
  if (device && device.schedules) {
    device.schedules.forEach((s) => {
      s.enabled = true;
    });
  }

  return Promise.resolve();
}

export async function disableAllSchedulesForDevice(deviceId: string): Promise<void> {
  SCHEDULES.forEach((s) => {
    if (s.deviceId === deviceId) {
      s.enabled = false;
    }
  });

  // Update device
  const device = DEVICES.find((d) => d.id === deviceId);
  if (device && device.schedules) {
    device.schedules.forEach((s) => {
      s.enabled = false;
    });
  }

  return Promise.resolve();
}
