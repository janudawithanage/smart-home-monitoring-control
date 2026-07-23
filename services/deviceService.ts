/**
 * deviceService
 *
 * Provides CRUD-like helpers for devices and floors.
 * Currently backed by in-memory mock data; swap out the implementations
 * to call Supabase (or any REST API) without changing the callers.
 */

import { DEVICES, FLOORS } from '@/data/mockData';
import { Device, DeviceStatus, Floor } from '@/types/device';

// ─── Floors ──────────────────────────────────────────────────────────────────

export async function getFloors(): Promise<Floor[]> {
  // TODO: replace with Supabase call
  return Promise.resolve(FLOORS);
}

export async function getFloorById(id: string): Promise<Floor | undefined> {
  return Promise.resolve(FLOORS.find((f) => f.id === id));
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export async function getDevices(): Promise<Device[]> {
  return Promise.resolve(DEVICES);
}

export async function getDeviceById(id: string): Promise<Device | undefined> {
  return Promise.resolve(DEVICES.find((d) => d.id === id));
}

export async function getDevicesByFloor(floorId: string): Promise<Device[]> {
  return Promise.resolve(DEVICES.filter((d) => d.floorId === floorId));
}

/**
 * Toggle the status of a device between 'on' and 'off'.
 * Returns the updated device.
 */
export async function toggleDevice(id: string): Promise<Device | undefined> {
  const device = DEVICES.find((d) => d.id === id);
  if (!device) return undefined;

  // Only toggle devices that are on/off; leave error/offline unchanged
  if (device.status === 'on') {
    device.status = 'off';
  } else if (device.status === 'off') {
    device.status = 'on';
  }
  device.lastUpdated = new Date().toISOString();
  return Promise.resolve({ ...device });
}

/**
 * Update any device property (e.g. brightness value).
 */
export async function updateDevice(
  id: string,
  patch: Partial<Pick<Device, 'status' | 'value' | 'name'>>,
): Promise<Device | undefined> {
  const idx = DEVICES.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  Object.assign(DEVICES[idx], patch, { lastUpdated: new Date().toISOString() });
  return Promise.resolve({ ...DEVICES[idx] });
}

// ─── Summary helpers ─────────────────────────────────────────────────────────

export function countActiveDevices(devices: Device[]): number {
  return devices.filter((d) => d.status === 'on').length;
}

export function getStatusLabel(status: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    on: 'Active',
    off: 'Off',
    error: 'Error',
    offline: 'Offline',
  };
  return map[status];
}
