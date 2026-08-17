/**
 * deviceService
 *
 * CRUD helpers for devices and floors, backed by Supabase.
 * Function names and signatures are unchanged so UI callers need no edits.
 */

import { supabase } from './supabase';
import { subscribeToTable, RealtimeEvent } from './realtime';
import { Device, DeviceStatus, Floor, SwitchCircuit } from '@/types/device';

// ─── Row → domain mappers (snake_case DB columns → camelCase types) ──────────

interface DeviceRow {
  id: string;
  user_id: string;
  floor_id: string;
  name: string;
  type: Device['type'];
  status: DeviceStatus;
  room_name: string | null;
  value: number | null;
  unit: string | null;
  icon_name: string | null;
  safety_timeout: number | null;
  last_updated: string;
  created_at: string;
}

interface FloorRow {
  id: string;
  user_id: string;
  name: string;
  level: number;
  device_count: number;
  active_device_count: number;
  floor_plan_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    floorId: row.floor_id,
    roomName: row.room_name ?? '',
    value: row.value ?? undefined,
    unit: row.unit ?? undefined,
    iconName: row.icon_name ?? undefined,
    safetyTimeout: row.safety_timeout ?? undefined,
    lastUpdated: row.last_updated,
  };
}

function mapFloor(row: FloorRow): Floor {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    deviceCount: row.device_count,
    activeDeviceCount: row.active_device_count,
  };
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ─── Realtime subscriptions ──────────────────────────────────────────────────

/**
 * Subscribe to changes on the `devices` table. Returns an unsubscribe fn.
 * Use `filter` (e.g. `id=eq.<uuid>`) to narrow to a single device.
 */
export function subscribeToDevices(
  onChange: (event: RealtimeEvent, device?: Device) => void,
  filter?: string,
): () => void {
  return subscribeToTable<Device>(
    'devices',
    (row) => mapDevice(row as unknown as DeviceRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
    filter,
  );
}

/**
 * Subscribe to changes on the `floors` table. Returns an unsubscribe fn.
 */
export function subscribeToFloors(
  onChange: (event: RealtimeEvent, floor?: Floor) => void,
  filter?: string,
): () => void {
  return subscribeToTable<Floor>(
    'floors',
    (row) => mapFloor(row as unknown as FloorRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
    filter,
  );
}

// ─── Floors ──────────────────────────────────────────────────────────────────

export async function getFloors(): Promise<Floor[]> {
  try {
    const [{ data: floorRows, error: floorsError }, { data: deviceRows, error: devicesError }] =
      await Promise.all([
        supabase.from('floors').select('*').order('level', { ascending: true }),
        supabase.from('devices').select('floor_id, status'),
      ]);

    if (floorsError) throw floorsError;
    if (devicesError) throw devicesError;

    // Compute live counts so cards never show a stale 0 after inserts.
    const counts = new Map<string, { total: number; active: number }>();
    for (const d of deviceRows ?? []) {
      const cur = counts.get(d.floor_id) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (d.status === 'on') cur.active += 1;
      counts.set(d.floor_id, cur);
    }

    return (floorRows ?? []).map((row) => {
      const c = counts.get(row.id) ?? { total: 0, active: 0 };
      return { ...mapFloor(row as FloorRow), deviceCount: c.total, activeDeviceCount: c.active };
    });
  } catch (error) {
    console.error('getFloors failed:', error);
    return [];
  }
}

export async function getFloorById(id: string): Promise<Floor | undefined> {
  try {
    const { data, error } = await supabase.from('floors').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapFloor(data as FloorRow) : undefined;
  } catch (error) {
    console.error('getFloorById failed:', error);
    return undefined;
  }
}

export async function addFloor(
  name: string,
  level: number,
): Promise<Floor> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('floors')
    .insert({ user_id: userId, name, level, floor_plan_url: null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapFloor(data as FloorRow);
}

export async function updateFloor(
  id: string,
  patch: Partial<Pick<Floor, 'name' | 'level'>>,
): Promise<Floor | undefined> {
  try {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.level !== undefined) dbPatch.level = patch.level;

    const { data, error } = await supabase
      .from('floors')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapFloor(data as FloorRow) : undefined;
  } catch (error) {
    console.error('updateFloor failed:', error);
    return undefined;
  }
}

export async function deleteFloor(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('floors').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteFloor failed:', error);
    return false;
  }
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export async function getDevices(): Promise<Device[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapDevice(row as DeviceRow));
  } catch (error) {
    console.error('getDevices failed:', error);
    return [];
  }
}

export async function getDeviceById(id: string): Promise<Device | undefined> {
  try {
    const { data, error } = await supabase.from('devices').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapDevice(data as DeviceRow) : undefined;
  } catch (error) {
    console.error('getDeviceById failed:', error);
    return undefined;
  }
}

export async function getDevicesByFloor(floorId: string): Promise<Device[]> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('floor_id', floorId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapDevice(row as DeviceRow));
  } catch (error) {
    console.error('getDevicesByFloor failed:', error);
    return [];
  }
}

/**
 * Toggle the status of a device between 'on' and 'off'.
 * Returns the updated device.
 */
export async function toggleDevice(id: string): Promise<Device | undefined> {
  try {
    const { data: current, error: readError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return undefined;

    // Only toggle devices that are on/off; leave error/offline unchanged.
    const status =
      current.status === 'on' ? 'off' : current.status === 'off' ? 'on' : current.status;

    const { data, error } = await supabase
      .from('devices')
      .update({ status, last_updated: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapDevice(data as DeviceRow) : undefined;
  } catch (error) {
    console.error('toggleDevice failed:', error);
    return undefined;
  }
}

/**
 * Update any device property (e.g. brightness value, safety timeout).
 * `safetyTimeout` accepts `null` to clear the timeout (disable auto-shutoff).
 */
export async function updateDevice(
  id: string,
  patch: Partial<Pick<Device, 'status' | 'value' | 'name'>> & { safetyTimeout?: number | null },
): Promise<Device | undefined> {
  try {
    const dbPatch: Record<string, unknown> = { last_updated: new Date().toISOString() };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.value !== undefined) dbPatch.value = patch.value;
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.safetyTimeout !== undefined) dbPatch.safety_timeout = patch.safetyTimeout;

    const { data, error } = await supabase
      .from('devices')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapDevice(data as DeviceRow) : undefined;
  } catch (error) {
    console.error('updateDevice failed:', error);
    return undefined;
  }
}

/**
 * Add a new device.
 */
export async function addDevice(
  fields: Pick<Device, 'name' | 'type' | 'floorId' | 'roomName'> &
    Partial<Pick<Device, 'value' | 'unit'>> & { safetyTimeout?: number | null },
): Promise<Device> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      floor_id: fields.floorId,
      name: fields.name,
      type: fields.type,
      status: 'off',
      room_name: fields.roomName,
      value: fields.value ?? null,
      unit: fields.unit ?? null,
      safety_timeout: fields.safetyTimeout ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapDevice(data as DeviceRow);
}

export async function deleteDevice(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('devices').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteDevice failed:', error);
    return false;
  }
}

// ─── Switch Circuits (multi-switch / gang-box devices) ────────────────────────

interface SwitchCircuitRow {
  id: string;
  device_id: string;
  name: string;
  status: SwitchCircuit['status'];
  power: number | string | null;
  position: number;
  created_at: string;
}

function mapCircuit(row: SwitchCircuitRow): SwitchCircuit {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    power: row.power != null ? Number(row.power) : undefined,
  };
}

const DEFAULT_CIRCUIT_NAMES = ['Ceiling Light', 'Wall Light', 'Desk Lamp', 'Fan', 'Accent Light'];

/**
 * Number of circuits a multi-switch device has. Mirrors the screen's heuristic:
 * parse "N-Switch" from the device name, defaulting to 3.
 */
function getSwitchCount(name: string): number {
  const match = name.match(/(\d+)-Switch/);
  return match ? parseInt(match[1], 10) : 3;
}

/**
 * Subscribe to changes on the `switch_circuits` table. Returns an unsubscribe fn.
 * Use `filter` (e.g. `device_id=eq.<uuid>`) to scope to one device.
 */
export function subscribeToSwitchCircuits(
  onChange: (event: RealtimeEvent, circuit?: SwitchCircuit) => void,
  filter?: string,
): () => void {
  return subscribeToTable<SwitchCircuit>(
    'switch_circuits',
    (row) => mapCircuit(row as unknown as SwitchCircuitRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
    filter,
  );
}

/**
 * Fetch all circuits for a multi-switch device, ordered by position.
 * If the device is a multiSwitch with no circuits yet (e.g. added before
 * circuit creation was wired), lazily create default circuits and return them.
 */
export async function getCircuitsForDevice(deviceId: string): Promise<SwitchCircuit[]> {
  try {
    const { data, error } = await supabase
      .from('switch_circuits')
      .select('*')
      .eq('device_id', deviceId)
      .order('position', { ascending: true });
    if (error) throw error;

    if ((data ?? []).length > 0) {
      return (data ?? []).map((row) => mapCircuit(row as SwitchCircuitRow));
    }

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('name, type')
      .eq('id', deviceId)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device || device.type !== 'multiSwitch') return [];

    const count = getSwitchCount(device.name);
    const rows = Array.from({ length: count }, (_, i) => ({
      device_id: deviceId,
      name: `Switch ${i + 1} — ${DEFAULT_CIRCUIT_NAMES[i] ?? 'Device'}`,
      status: 'off',
      power: null,
      position: i,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('switch_circuits')
      .insert(rows)
      .select()
      .order('position', { ascending: true });
    if (insertError) throw insertError;
    return (inserted ?? []).map((row) => mapCircuit(row as SwitchCircuitRow));
  } catch (error) {
    console.error('getCircuitsForDevice failed:', error);
    return [];
  }
}

/**
 * Toggle an individual switch circuit between 'on' and 'off'.
 * Returns the updated circuit.
 */
export async function toggleCircuit(id: string): Promise<SwitchCircuit | undefined> {
  try {
    const { data: current, error: readError } = await supabase
      .from('switch_circuits')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return undefined;

    const status =
      current.status === 'on' ? 'off' : current.status === 'off' ? 'on' : current.status;
    const power = status === 'on' ? 40 + Math.random() * 60 : 0;

    const { data, error } = await supabase
      .from('switch_circuits')
      .update({ status, power })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapCircuit(data as SwitchCircuitRow) : undefined;
  } catch (error) {
    console.error('toggleCircuit failed:', error);
    return undefined;
  }
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
  supabase
    .from('floor_plan_pins')
    .upsert({ floor_id: floorId, device_id: deviceId, x, y }, { onConflict: 'floor_id,device_id' })
    .then(({ error }) => {
      if (error) console.error('setDevicePinPosition failed:', error.message);
    });
}

/**
 * Remove the floor plan pin for a device.
 */
export function removeDevicePinPosition(floorId: string, deviceId: string): void {
  supabase
    .from('floor_plan_pins')
    .delete()
    .eq('floor_id', floorId)
    .eq('device_id', deviceId)
    .then(({ error }) => {
      if (error) console.error('removeDevicePinPosition failed:', error.message);
    });
}

/**
 * Position of a device pin on a floor plan (0–100 % of image width/height).
 * Matches the shape used by data/floorPlanData.ts without importing it.
 */
export interface PinPosition {
  deviceId: string;
  x: number;
  y: number;
}

interface PinRow {
  id: string;
  floor_id: string;
  device_id: string;
  x: number | string;
  y: number | string;
  created_at: string;
}

function mapPin(row: PinRow): PinPosition {
  return {
    deviceId: row.device_id,
    x: Number(row.x),
    y: Number(row.y),
  };
}

/**
 * Fetch all pin positions for a floor.
 */
export async function getPinsForFloor(floorId: string): Promise<PinPosition[]> {
  try {
    const { data, error } = await supabase
      .from('floor_plan_pins')
      .select('device_id, x, y')
      .eq('floor_id', floorId);
    if (error) throw error;
    return (data ?? []).map((row) => mapPin(row as PinRow));
  } catch (error) {
    console.error('getPinsForFloor failed:', error);
    return [];
  }
}

/**
 * Subscribe to changes on the `floor_plan_pins` table. Returns an unsubscribe fn.
 * Use `filter` (e.g. `floor_id=eq.<uuid>`) to scope to a single floor.
 */
export function subscribeToFloorPlanPins(
  onChange: (event: RealtimeEvent, pin?: PinPosition) => void,
  filter?: string,
): () => void {
  return subscribeToTable<PinPosition>(
    'floor_plan_pins',
    (row) => mapPin(row as unknown as PinRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
    filter,
  );
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
