/**
 * Row shapes mirrored from supabase/schema.sql. The simulator works directly in
 * snake_case (no domain mapping layer) because it is a faithful view of the
 * hardware records as the database stores them.
 */

export type DeviceType =
  | 'light'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'fan'
  | 'tv'
  | 'speaker'
  | 'outlet'
  | 'iron'
  | 'multiSwitch';

/** devices.status — the four operational states required by the spec. */
export type DeviceStatus = 'on' | 'off' | 'error' | 'offline';

/** switch_circuits.status — per-gang state ('disconnected' instead of 'offline'). */
export type CircuitStatus = 'on' | 'off' | 'error' | 'disconnected';

export interface FloorRow {
  id: string;
  name: string;
  level: number;
  floor_plan_url: string | null;
}

export interface DeviceRow {
  id: string;
  floor_id: string | null;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  room_name: string | null;
  value: number | null;
  unit: string | null;
  icon_name: string | null;
  safety_timeout: number | null;
  /** Set by the set_device_on_since trigger; drives the safety countdown. */
  on_since: string | null;
  last_updated: string;
}

export interface CircuitRow {
  id: string;
  device_id: string;
  name: string;
  status: CircuitStatus;
  power: number | null;
  position: number;
}

export interface PinRow {
  id: string;
  floor_id: string;
  device_id: string;
  x: number;
  y: number;
}

export interface AlertRow {
  id: string;
  device_id: string | null;
  type: 'safety' | 'error' | 'offline' | 'info';
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

/** One line in the simulator's live event console. */
export interface LogEntry {
  id: string;
  at: string;
  source: 'devices' | 'switch_circuits' | 'alerts' | 'floors' | 'floor_plan_pins' | 'simulator';
  text: string;
  tone: 'info' | 'on' | 'off' | 'warn';
}

export type ConnectionState = 'connecting' | 'live' | 'error';
