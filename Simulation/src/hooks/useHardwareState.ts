/**
 * useHardwareState
 *
 * The simulator's "wiring loom". It loads one snapshot of the home from
 * Supabase, then keeps that snapshot current purely from postgres_changes
 * events — there is no polling and no manual refresh anywhere in the app.
 *
 * Every event is also pushed onto a bounded log so the demo can *show* the
 * synchronisation happening, not just its result.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type {
  AlertRow,
  CircuitRow,
  ConnectionState,
  DeviceRow,
  FloorRow,
  LogEntry,
  PinRow,
} from '../lib/types';

const MAX_LOG_ENTRIES = 200;

/** Replace-or-append by id, keeping list order stable across updates. */
function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const idx = list.findIndex((item) => item.id === row.id);
  if (idx === -1) return [...list, row];
  const next = [...list];
  next[idx] = row;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

export interface HardwareState {
  floors: FloorRow[];
  devices: DeviceRow[];
  circuits: CircuitRow[];
  pins: PinRow[];
  alerts: AlertRow[];
  log: LogEntry[];
  connection: ConnectionState;
  loading: boolean;
  error: string | null;
  appendLog: (entry: Omit<LogEntry, 'id' | 'at'>) => void;
  clearLog: () => void;
  reload: () => void;
}

export function useHardwareState(sessionUserId: string | null): HardwareState {
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [circuits, setCircuits] = useState<CircuitRow[]>([]);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /** Device names, kept in a ref so log lines can name a device without
   *  re-creating the realtime subscriptions on every state change. */
  const deviceNames = useRef(new Map<string, string>());

  const appendLog = useCallback((entry: Omit<LogEntry, 'id' | 'at'>) => {
    setLog((prev) =>
      [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, MAX_LOG_ENTRIES),
    );
  }, []);

  const clearLog = useCallback(() => setLog([]), []);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // ─── Initial snapshot ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const [floorsRes, devicesRes, circuitsRes, pinsRes, alertsRes] = await Promise.all([
        supabase.from('floors').select('id, name, level, floor_plan_url').order('level'),
        supabase.from('devices').select('*').order('created_at'),
        supabase.from('switch_circuits').select('*').order('position'),
        supabase.from('floor_plan_pins').select('id, floor_id, device_id, x, y'),
        supabase
          .from('alerts')
          .select('id, device_id, type, title, message, read, created_at')
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      if (cancelled) return;

      const failure =
        floorsRes.error ?? devicesRes.error ?? circuitsRes.error ?? pinsRes.error ?? alertsRes.error;
      if (failure) {
        setError(failure.message);
        setLoading(false);
        return;
      }

      const deviceRows = (devicesRes.data ?? []) as DeviceRow[];
      deviceNames.current = new Map(deviceRows.map((d) => [d.id, d.name]));

      setFloors((floorsRes.data ?? []) as FloorRow[]);
      setDevices(deviceRows);
      setCircuits((circuitsRes.data ?? []) as CircuitRow[]);
      setPins(((pinsRes.data ?? []) as PinRow[]).map((p) => ({ ...p, x: Number(p.x), y: Number(p.y) })));
      setAlerts((alertsRes.data ?? []) as AlertRow[]);
      setLoading(false);
      appendLog({
        source: 'simulator',
        tone: 'info',
        text: `Snapshot loaded — ${deviceRows.length} appliance(s) across ${
          floorsRes.data?.length ?? 0
        } floor(s).`,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId, reloadToken, appendLog]);

  // ─── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionUserId) return;

    const nameOf = (id: string | undefined | null) =>
      (id && deviceNames.current.get(id)) || 'Unknown appliance';

    const channel: RealtimeChannel = supabase
      .channel('hardware-simulator')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload: RealtimePostgresChangesPayload<DeviceRow>) => {
          const row = payload.new as DeviceRow | undefined;
          const old = payload.old as Partial<DeviceRow> | undefined;

          if (payload.eventType === 'DELETE') {
            if (old?.id) {
              setDevices((prev) => removeById(prev, old.id!));
              appendLog({ source: 'devices', tone: 'warn', text: `${nameOf(old.id)} removed.` });
            }
            return;
          }
          if (!row) return;

          deviceNames.current.set(row.id, row.name);
          setDevices((prev) => upsert(prev, row));

          if (payload.eventType === 'INSERT') {
            appendLog({ source: 'devices', tone: 'info', text: `${row.name} connected (${row.type}).` });
          } else if (old?.status && old.status !== row.status) {
            appendLog({
              source: 'devices',
              tone: row.status === 'on' ? 'on' : row.status === 'off' ? 'off' : 'warn',
              text: `${row.name}: ${old.status} → ${row.status.toUpperCase()}`,
            });
          } else if (old?.value !== row.value && row.value != null) {
            appendLog({
              source: 'devices',
              tone: 'info',
              text: `${row.name}: level set to ${row.value}${row.unit ?? ''}`,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'switch_circuits' },
        (payload: RealtimePostgresChangesPayload<CircuitRow>) => {
          const row = payload.new as CircuitRow | undefined;
          const old = payload.old as Partial<CircuitRow> | undefined;

          if (payload.eventType === 'DELETE') {
            if (old?.id) setCircuits((prev) => removeById(prev, old.id!));
            return;
          }
          if (!row) return;

          setCircuits((prev) => upsert(prev, row));
          if (payload.eventType === 'UPDATE' && old?.status !== row.status) {
            appendLog({
              source: 'switch_circuits',
              tone: row.status === 'on' ? 'on' : row.status === 'off' ? 'off' : 'warn',
              text: `${nameOf(row.device_id)} · ${row.name}: ${row.status.toUpperCase()}`,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload: RealtimePostgresChangesPayload<AlertRow>) => {
          const row = payload.new as AlertRow | undefined;
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<AlertRow> | undefined;
            if (old?.id) setAlerts((prev) => removeById(prev, old.id!));
            return;
          }
          if (!row) return;
          setAlerts((prev) => upsert(prev, row).slice(-25));
          if (payload.eventType === 'INSERT') {
            appendLog({ source: 'alerts', tone: 'warn', text: `ALERT · ${row.title}` });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'floors' },
        (payload: RealtimePostgresChangesPayload<FloorRow>) => {
          const row = payload.new as FloorRow | undefined;
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<FloorRow> | undefined;
            if (old?.id) setFloors((prev) => removeById(prev, old.id!));
            return;
          }
          if (row) setFloors((prev) => upsert(prev, row).sort((a, b) => a.level - b.level));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'floor_plan_pins' },
        (payload: RealtimePostgresChangesPayload<PinRow>) => {
          const row = payload.new as PinRow | undefined;
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<PinRow> | undefined;
            if (old?.id) setPins((prev) => removeById(prev, old.id!));
            return;
          }
          if (row) setPins((prev) => upsert(prev, { ...row, x: Number(row.x), y: Number(row.y) }));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          appendLog({ source: 'simulator', tone: 'info', text: 'Realtime channel subscribed.' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('error');
          appendLog({ source: 'simulator', tone: 'warn', text: `Realtime channel ${status}.` });
        } else if (status === 'CLOSED') {
          setConnection('connecting');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionUserId, appendLog]);

  return useMemo(
    () => ({
      floors,
      devices,
      circuits,
      pins,
      alerts,
      log,
      connection,
      loading,
      error,
      appendLog,
      clearLog,
      reload,
    }),
    [floors, devices, circuits, pins, alerts, log, connection, loading, error, appendLog, clearLog, reload],
  );
}
