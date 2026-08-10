export type DeviceType =
  | 'light'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'fan'
  | 'tv'
  | 'speaker'
  | 'outlet';

export type DeviceStatus = 'on' | 'off' | 'error' | 'offline';

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
