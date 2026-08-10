/**
 * deviceService
 *
 * Provides CRUD-like helpers for devices and floors.
 * Currently backed by in-memory mock data; swap out the implementations
 * to call Supabase (or any REST API) without changing the callers.
 */

import { removeDevicePin, setDevicePin, setFloorPlanImage } from '@/data/floorPlanData';
import { DEVICES, FLOORS, setDEVICES, setFLOORS } from '@/data/mockData';
import { Device, DeviceStatus, Floor } from '@/types/device';

// ─── Floors ──────────────────────────────────────────────────────────────────

export async function getFloors(): Promise<Floor[]> {
  // TODO: replace with Supabase call
  return Promise.resolve(FLOORS);
}

export async function getFloorById(id: string): Promise<Floor | undefined> {
  return Promise.resolve(FLOORS.find((f) => f.id === id));
}

export async function addFloor(
  name: string,
  level: number,
  floorPlanUri?: string,
): Promise<Floor> {
  const newFloor: Floor = {
    id: `f${Date.now()}`,
    name,
    level,
    deviceCount: 0,
    activeDeviceCount: 0,
    floorPlanUri,
  };
  setFLOORS([...FLOORS, newFloor]);
  // If a floor plan image was provided, register it in the config store
  if (floorPlanUri) {
    setFloorPlanImage(newFloor.id, floorPlanUri);
  }
  return Promise.resolve({ ...newFloor });
}

export async function updateFloor(
  id: string,
  patch: Partial<Pick<Floor, 'name' | 'level' | 'floorPlanUri'>>,
): Promise<Floor | undefined> {
  const idx = FLOORS.findIndex((f) => f.id === id);
  if (idx === -1) return undefined;
  setFLOORS(FLOORS.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  // Sync the floor plan image config when the URI changes
  if (patch.floorPlanUri !== undefined) {
    setFloorPlanImage(id, patch.floorPlanUri);
  }
  return Promise.resolve({ ...FLOORS[idx] });
}

export async function deleteFloor(id: string): Promise<boolean> {
  const before = FLOORS.length;
  setFLOORS(FLOORS.filter((f) => f.id !== id));
  return Promise.resolve(FLOORS.length < before);
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

/**
 * Add a new device.
 */
export async function addDevice(
  fields: Pick<Device, 'name' | 'type' | 'floorId' | 'roomName'> &
    Partial<Pick<Device, 'value' | 'unit'>>,
): Promise<Device> {
  const newDevice: Device = {
    id: `d${Date.now()}`,
    status: 'off',
    lastUpdated: new Date().toISOString(),
    ...fields,
  };
  setDEVICES([...DEVICES, newDevice]);
  // Update floor device count
  const floorIdx = FLOORS.findIndex((f) => f.id === fields.floorId);
  if (floorIdx !== -1) {
    setFLOORS(
      FLOORS.map((f, i) =>
        i === floorIdx ? { ...f, deviceCount: f.deviceCount + 1 } : f,
      ),
    );
  }
  return Promise.resolve({ ...newDevice });
}

/**
 * Persist the pin position for a device on its floor plan.
 */
export function setDevicePinPosition(
  floorId: string,
  deviceId: string,
  x: number,
  y: number,
): void {
  setDevicePin(floorId, deviceId, x, y);
}

/**
 * Remove the floor plan pin for a device.
 */
export function removeDevicePinPosition(floorId: string, deviceId: string): void {
  removeDevicePin(floorId, deviceId);
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
