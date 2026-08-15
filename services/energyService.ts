/**
 * energyService
 *
 * Real energy-usage computation backed by the `device_usage_log` table (populated
 * by the `devices_log_session` trigger — see supabase/device_usage_log.sql).
 *
 * Wattage is an assumption: real hardware draw isn't knowable for a simulated
 * smart home, so we use reasonable typical per-type appliance wattage below.
 * kWh = wattage × (logged on-time in hours) / 1000.
 */

import { supabase } from './supabase';
import { Colors } from '@/constants/colors';
import { Device, DeviceType } from '@/types/device';

export interface EnergyData {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  kwh: number;
  cost: number;
  color: string;
  percentage: number;
}

export type EnergyPeriod = 'today' | 'week' | 'month';

const COST_PER_KWH = 0.15;

// Reasonable typical appliance wattage per device type (assumptions, configurable).
const WATTAGE: Record<DeviceType, number> = {
  light: 10,
  fan: 75,
  tv: 150,
  speaker: 20,
  thermostat: 2500,
  lock: 2,
  camera: 5,
  outlet: 200,
  iron: 1200,
  multiSwitch: 10,
};

function periodStart(period: EnergyPeriod): Date {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

interface UsageRow {
  device_id: string;
  duration_seconds: number;
}

/**
 * Compute per-device energy usage for a period. Returns real kWh derived from
 * logged on-time sessions (plus any currently-running session), ranked desc.
 */
export async function computeEnergyData(
  devices: Device[],
  period: EnergyPeriod,
): Promise<EnergyData[]> {
  const since = periodStart(period).toISOString();

  let rows: UsageRow[] = [];
  try {
    const { data, error } = await supabase.rpc('device_usage_seconds', { since });
    if (error) throw error;
    rows = (data ?? []) as UsageRow[];
  } catch (error) {
    console.error('computeEnergyData failed:', error);
    return [];
  }

  const deviceById = new Map(devices.map((d) => [d.id, d]));

  const data: EnergyData[] = rows
    .map((row) => {
      const device = deviceById.get(row.device_id);
      if (!device) return null;
      const seconds = Number(row.duration_seconds) || 0;
      if (seconds <= 0) return null;
      const watts = WATTAGE[device.type] ?? 10;
      const kwh = (watts * seconds) / 3600 / 1000;
      const cost = kwh * COST_PER_KWH;
      const color = (Colors.device as Record<string, string>)[device.type] ?? Colors.accent.blue;
      return {
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        kwh,
        cost,
        color,
        percentage: 0,
      };
    })
    .filter((d): d is EnergyData => d !== null);

  const totalKwh = data.reduce((sum, d) => sum + d.kwh, 0);
  return data
    .map((d) => ({ ...d, percentage: totalKwh > 0 ? (d.kwh / totalKwh) * 100 : 0 }))
    .sort((a, b) => b.kwh - a.kwh);
}
