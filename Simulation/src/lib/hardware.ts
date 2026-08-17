/**
 * Write path — "the appliance talking back".
 *
 * Everything here writes to the same tables the mobile app reads, which is what
 * makes the sync bidirectional: a fault raised on this dashboard lands in the
 * phone's UI over realtime, with no polling on either side.
 */

import { supabase } from './supabase';
import type { CircuitStatus, DeviceStatus } from './types';

/** Push a new operational status for a physical appliance. */
export async function setDeviceStatus(deviceId: string, status: DeviceStatus): Promise<string | null> {
  const { error } = await supabase
    .from('devices')
    .update({ status, last_updated: new Date().toISOString() })
    .eq('id', deviceId);
  return error?.message ?? null;
}

/** Push a new status for one gang of a multi-switch unit. */
export async function setCircuitStatus(circuitId: string, status: CircuitStatus): Promise<string | null> {
  const { error } = await supabase.from('switch_circuits').update({ status }).eq('id', circuitId);
  return error?.message ?? null;
}

/**
 * Raise an alert from the hardware side (e.g. a simulated fault). RLS requires
 * user_id to be the signed-in user, so it is read from the live session.
 */
export async function raiseAlert(
  deviceId: string | null,
  type: 'safety' | 'error' | 'offline' | 'info',
  title: string,
  message: string,
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return 'Not authenticated';

  const { error } = await supabase
    .from('alerts')
    .insert({ user_id: userId, device_id: deviceId, type, title, message });
  return error?.message ?? null;
}
