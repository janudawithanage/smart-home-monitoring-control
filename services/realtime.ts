/**
 * realtime
 *
 * Thin wrapper around Supabase postgres_changes subscriptions. Screens use
 * this to receive live INSERT/UPDATE/DELETE events and keep local state in
 * sync without a manual refresh.
 */

import { supabase } from './supabase';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export type TableName = 'floors' | 'devices' | 'schedules' | 'switch_circuits' | 'floor_plan_pins' | 'alerts';

/**
 * Subscribe to changes on a public table.
 *
 * @param table     table to watch
 * @param mapRow    converts a raw DB row (snake_case) to a domain object
 * @param onChange  called on every event with the mapped new/old rows
 * @param filter    optional postgres_changes filter, e.g. 'id=eq.<uuid>'
 * @returns         unsubscribe function (removes the channel)
 */
export function subscribeToTable<T>(
  table: TableName,
  mapRow: (row: Record<string, unknown>) => T,
  onChange: (event: RealtimeEvent, newRow?: T, oldRow?: T) => void,
  filter?: string,
): () => void {
  const channel = supabase
    .channel(`realtime:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => {
        const event = payload.eventType as RealtimeEvent;
        const newRow = payload.new ? mapRow(payload.new as Record<string, unknown>) : undefined;
        const oldRow = payload.old ? mapRow(payload.old as Record<string, unknown>) : undefined;
        onChange(event, newRow, oldRow);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
