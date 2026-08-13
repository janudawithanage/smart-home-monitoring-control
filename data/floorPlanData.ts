/**
 * floorPlanData.ts
 *
 * Defines device positions on the floor plan image.
 * Coordinates are (x, y) as a percentage (0–100) of the image width/height.
 * This makes positioning resolution-independent.
 *
 * Configs are mutable at runtime so that:
 *   - user-uploaded floor plan images can be stored per floor
 *   - device pin positions can be saved after the user places them
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
  /**
   * Floor plan image source.
   *   - Bundled assets: require('@/assets/images/…') — returned as a number
   *   - User-uploaded: a `file://…` URI string
   */
  image: any;
  /** Dimensions of the image canvas to use for positioning (logical px) */
  canvasWidth: number;
  canvasHeight: number;
  pins: DevicePin[];
}

// ─── Mutable floor plan configs ───────────────────────────────────────────────

/**
 * Bundled default floor plan image used when a floor has no custom image.
 * No backend/Storage involved — new floors just render this asset.
 */
export const DEFAULT_FLOOR_PLAN_IMAGE = require('@/assets/images/floor_plan_preview.png');

export let FLOOR_PLAN_CONFIGS: FloorPlanConfig[] = [
  {
    floorId: 'f0',
    image: require('@/assets/images/floor_plan_ground.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      { deviceId: 'd1', x: 35, y: 38 },
      { deviceId: 'd2', x: 72, y: 46 },
      { deviceId: 'd3', x: 50, y: 66 },
      { deviceId: 'd4', x: 25, y: 50 },
      { deviceId: 'd5', x: 80, y: 55 },
      { deviceId: 'd6', x: 16, y: 78 },
      { deviceId: 'd16', x: 60, y: 75 },
    ],
  },
  {
    floorId: 'f1',
    image: require('@/assets/images/floor_plan_preview.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      { deviceId: 'd7',  x: 30, y: 30 },
      { deviceId: 'd8',  x: 45, y: 28 },
      { deviceId: 'd9',  x: 75, y: 22 },
      { deviceId: 'd10', x: 28, y: 44 },
      { deviceId: 'd11', x: 52, y: 62 },
    ],
  },
  {
    floorId: 'f2',
    image: require('@/assets/images/floor_plan_preview.png'),
    canvasWidth: 360,
    canvasHeight: 432,
    pins: [
      { deviceId: 'd12', x: 38, y: 32 },
      { deviceId: 'd13', x: 60, y: 28 },
      { deviceId: 'd14', x: 22, y: 55 },
      { deviceId: 'd15', x: 70, y: 55 },
    ],
  },
];

/** Internal setter — keeps the reference in sync (mirrors pattern from mockData). */
export function setFLOOR_PLAN_CONFIGS(next: FloorPlanConfig[]) {
  FLOOR_PLAN_CONFIGS = next;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getFloorPlanConfig(floorId: string): FloorPlanConfig | undefined {
  const existing = FLOOR_PLAN_CONFIGS.find((c) => c.floorId === floorId);
  // Always resolve to a valid image: keep a custom image if present, otherwise
  // fall back to the bundled default so the canvas renders for every floor
  // (including newly created ones) with no upload/Storage required.
  return {
    floorId,
    image: existing?.image ?? DEFAULT_FLOOR_PLAN_IMAGE,
    canvasWidth: existing?.canvasWidth ?? 360,
    canvasHeight: existing?.canvasHeight ?? 432,
    pins: existing?.pins ?? [],
  };
}

/**
 * Create or overwrite the floor plan image for a floor.
 * `imageSource` can be a `require(…)` result or a `file://…` URI string.
 */
export function setFloorPlanImage(floorId: string, imageSource: any): void {
  const existing = FLOOR_PLAN_CONFIGS.find((c) => c.floorId === floorId);
  if (existing) {
    setFLOOR_PLAN_CONFIGS(
      FLOOR_PLAN_CONFIGS.map((c) =>
        c.floorId === floorId ? { ...c, image: imageSource } : c,
      ),
    );
  } else {
    // New floor — create an empty config
    setFLOOR_PLAN_CONFIGS([
      ...FLOOR_PLAN_CONFIGS,
      {
        floorId,
        image: imageSource,
        canvasWidth: 360,
        canvasHeight: 432,
        pins: [],
      },
    ]);
  }
}

/**
 * Upsert the pin position for a device on a given floor.
 */
export function setDevicePin(floorId: string, deviceId: string, x: number, y: number): void {
  const config = FLOOR_PLAN_CONFIGS.find((c) => c.floorId === floorId);
  if (!config) {
    // Create a config shell if the floor has no plan yet
    setFLOOR_PLAN_CONFIGS([
      ...FLOOR_PLAN_CONFIGS,
      { floorId, image: null, canvasWidth: 360, canvasHeight: 432, pins: [{ deviceId, x, y }] },
    ]);
    return;
  }

  const pinExists = config.pins.some((p) => p.deviceId === deviceId);
  const updatedPins = pinExists
    ? config.pins.map((p) => (p.deviceId === deviceId ? { ...p, x, y } : p))
    : [...config.pins, { deviceId, x, y }];

  setFLOOR_PLAN_CONFIGS(
    FLOOR_PLAN_CONFIGS.map((c) =>
      c.floorId === floorId ? { ...c, pins: updatedPins } : c,
    ),
  );
}

/**
 * Remove the pin for a device from a floor's config.
 */
export function removeDevicePin(floorId: string, deviceId: string): void {
  setFLOOR_PLAN_CONFIGS(
    FLOOR_PLAN_CONFIGS.map((c) =>
      c.floorId === floorId
        ? { ...c, pins: c.pins.filter((p) => p.deviceId !== deviceId) }
        : c,
    ),
  );
}

// ─── Safety / camera / multi-switch metadata ─────────────────────────────────

export const SAFETY_DEVICE_TYPES = ['lock', 'fan'] as const;
export const CAMERA_DEVICE_TYPES = ['camera'] as const;
export const MULTI_SWITCH_TYPES  = ['outlet', 'fan'] as const;

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
  iron: {
    title: '🔥 Iron Safety',
    body: 'Always unplug the iron after use. Auto cutoff activates after the set duration. Never leave unattended.',
    icon: 'warning-outline',
  },
};
