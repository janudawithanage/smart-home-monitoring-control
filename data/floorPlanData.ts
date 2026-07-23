/**
 * floorPlanData.ts
 *
 * Defines device positions on the floor plan image.
 * Coordinates are (x, y) as a percentage (0–100) of the image width/height.
 * This makes positioning resolution-independent.
 */

export interface DevicePin {
  deviceId: string;
  /** X position as % of image width (0 = left, 100 = right) */
  x: number;
  /** Y position as % of image height (0 = top, 100 = bottom) */
  y: number;
}

export interface FloorPlanConfig {
  floorId: string;
  /** Floor plan image asset (require(...)) */
  image: any;
  /** Dimensions of the image canvas to use for positioning (logical px) */
  canvasWidth: number;
  canvasHeight: number;
  pins: DevicePin[];
}

// ─── Floor Plan Configs ───────────────────────────────────────────────────────

export const FLOOR_PLAN_CONFIGS: FloorPlanConfig[] = [
  {
    floorId: 'f0',
    image: require('@/assets/images/floor_plan_ground.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      // Living Room Light  (d1) – centre of living room
      { deviceId: 'd1', x: 35, y: 38 },
      // Kitchen Light (d2) – kitchen area
      { deviceId: 'd2', x: 72, y: 46 },
      // Front Door Lock (d3) – entrance
      { deviceId: 'd3', x: 50, y: 66 },
      // Living Room Thermostat (d4) – living room right wall
      { deviceId: 'd4', x: 25, y: 50 },
      // Kitchen TV (d5) – kitchen
      { deviceId: 'd5', x: 80, y: 55 },
      // Garage Camera (d6) – garage corner
      { deviceId: 'd6', x: 16, y: 78 },
    ],
  },
  {
    floorId: 'f1',
    image: require('@/assets/images/floor_plan_preview.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      // Master Bedroom Light (d7)
      { deviceId: 'd7', x: 30, y: 30 },
      // Bedroom Fan (d8)
      { deviceId: 'd8', x: 45, y: 28 },
      // Bathroom Light (d9)
      { deviceId: 'd9', x: 75, y: 22 },
      // Smart Speaker (d10)
      { deviceId: 'd10', x: 28, y: 44 },
      // Hallway Outlet (d11)
      { deviceId: 'd11', x: 52, y: 62 },
    ],
  },
  {
    floorId: 'f2',
    image: require('@/assets/images/floor_plan_preview.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      // Study Light (d12)
      { deviceId: 'd12', x: 38, y: 32 },
      // Study Camera (d13)
      { deviceId: 'd13', x: 60, y: 28 },
      // Attic Fan (d14)
      { deviceId: 'd14', x: 22, y: 55 },
      // Guest Room TV (d15)
      { deviceId: 'd15', x: 70, y: 55 },
    ],
  },
];

export function getFloorPlanConfig(floorId: string): FloorPlanConfig | undefined {
  return FLOOR_PLAN_CONFIGS.find((c) => c.floorId === floorId);
}

// Safety device types — these show special safety information in the detail sheet
export const SAFETY_DEVICE_TYPES = ['lock', 'fan'] as const;

// Camera device types — these show camera placeholder UI
export const CAMERA_DEVICE_TYPES = ['camera'] as const;

// Multi-switch capable types — show multiple sub-controls
export const MULTI_SWITCH_TYPES = ['outlet', 'fan'] as const;

/** Safety info copy per device type */
export const SAFETY_INFO: Record<string, { title: string; body: string; icon: string }> = {
  lock: {
    title: 'Security Device',
    body: 'This lock secures your entrance. Ensure it is locked when leaving home. You can check lock status remotely.',
    icon: 'shield-checkmark-outline',
  },
  fan: {
    title: 'Safety Reminder',
    body: 'Never leave fans running in unoccupied rooms for extended periods. Check for unusual sounds or overheating.',
    icon: 'warning-outline',
  },
  thermostat: {
    title: 'Temperature Control',
    body: 'Keep temperatures between 18–26 °C for optimal comfort and energy efficiency.',
    icon: 'thermometer-outline',
  },
  outlet: {
    title: 'Power Safety',
    body: 'Ensure devices plugged into this outlet are rated for the circuit capacity. Unplug appliances when not in use.',
    icon: 'flash-outline',
  },
};
