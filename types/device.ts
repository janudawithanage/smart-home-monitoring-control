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

export type DeviceStatus = 'on' | 'off' | 'error' | 'offline';

export type SwitchCircuitStatus = 'on' | 'off' | 'error' | 'disconnected';

export interface SwitchCircuit {
  id: string;
  name: string;
  status: SwitchCircuitStatus;
  power?: number; // watts
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  floorId: string;
  roomName: string;
  /** Current value — brightness 0–100, temperature in °C, volume 0–100, etc. */
  value?: number;
  unit?: string;
  iconName?: string;
  lastUpdated: string; // ISO date string
  /** For multi-switch devices, stores individual switch states */
  circuits?: SwitchCircuit[];
}

export interface Floor {
  id: string;
  name: string;
  level: number; // 0 = ground, 1 = first, etc.
  deviceCount: number;
  activeDeviceCount: number;
  /** URI of the user-uploaded floor plan image (file:// URI or bundled asset path) */
  floorPlanUri?: string;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
}
