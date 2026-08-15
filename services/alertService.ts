/**
 * alertService
 *
 * CRUD + realtime helpers for the `alerts` table (backing the notifications
 * screen). Alerts are a distinct domain from device/floor/schedule CRUD, so
 * they live in their own service file.
 *
 * User scoping is handled by RLS (`alerts select/insert/update/delete own`
 * policies on `user_id`), so no explicit user filter is needed here — Supabase
 * Realtime also respects RLS, so `subscribeToAlerts` only ever delivers the
 * current user's own alerts.
 */

import { supabase } from './supabase';
import { subscribeToTable, RealtimeEvent } from './realtime';

export type AlertType = 'safety' | 'error' | 'offline' | 'info';

export interface Alert {
  id: string;
  deviceId: string | null;
  type: AlertType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AlertRow {
  id: string;
  user_id: string;
  device_id: string | null;
  type: AlertType;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    deviceId: row.device_id,
    type: row.type,
    title: row.title,
    message: row.message ?? '',
    read: row.read,
    createdAt: row.created_at,
  };
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getAlerts(): Promise<Alert[]> {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapAlert(row as AlertRow));
  } catch (error) {
    console.error('getAlerts failed:', error);
    return [];
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function markAlertRead(alertId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('id', alertId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('markAlertRead failed:', error);
    return false;
  }
}

export async function markAllAlertsRead(): Promise<void> {
  try {
    const { error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('read', false);
    if (error) throw error;
  } catch (error) {
    console.error('markAllAlertsRead failed:', error);
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteAlert(alertId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('alerts').delete().eq('id', alertId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteAlert failed:', error);
    return false;
  }
}

/** Bulk-delete the user's alerts (backs the "Clear All" action). */
export async function deleteAllAlerts(): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase.from('alerts').delete().eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('deleteAllAlerts failed:', error);
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Insert a new alert for the current user. Reusable by safety-cutoff and
 * schedule-execution logic.
 */
export async function createAlert(
  deviceId: string | null,
  type: AlertType,
  title: string,
  message?: string,
): Promise<Alert | null> {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('alerts')
      .insert({ user_id: userId, device_id: deviceId, type, title, message: message ?? null })
      .select()
      .single();
    if (error) throw error;
    return mapAlert(data as AlertRow);
  } catch (error) {
    console.error('createAlert failed:', error);
    return null;
  }
}

// ─── Realtime ────────────────────────────────────────────────────────────────

/**
 * Subscribe to changes on the `alerts` table for the current user.
 * RLS scopes delivery to the user's own alerts; no server filter needed.
 */
export function subscribeToAlerts(
  onChange: (event: RealtimeEvent, alert?: Alert) => void,
): () => void {
  return subscribeToTable<Alert>(
    'alerts',
    (row) => mapAlert(row as unknown as AlertRow),
    (event, newRow, oldRow) => onChange(event, newRow ?? oldRow),
  );
}
