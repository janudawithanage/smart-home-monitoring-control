/**
 * Hardware Simulator Dashboard.
 *
 * Represents the physical appliances of a smart home. It holds no state of its
 * own: the database is the single source of truth, the simulator subscribes to
 * it, and any control on this page writes back to the very same rows.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { ApplianceCard } from './components/ApplianceCard';
import { EventLog } from './components/EventLog';
import { FloorPlanBoard } from './components/FloorPlanBoard';
import { LoginScreen } from './components/LoginScreen';
import { useHardwareState } from './hooks/useHardwareState';
import { supabase } from './lib/supabase';
import './styles.css';

const CONNECTION_COPY = {
  connecting: 'Connecting',
  live: 'Live',
  error: 'Disconnected',
} as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const state = useHardwareState(session?.user?.id ?? null);
  const { floors, devices, circuits, pins, alerts, log, connection, loading, error } = state;

  // Default to the lowest floor once the snapshot lands; also recover if the
  // selected floor is deleted from the phone while the bench is open.
  useEffect(() => {
    if (floors.length === 0) {
      setActiveFloorId(null);
      return;
    }
    if (!activeFloorId || !floors.some((f) => f.id === activeFloorId)) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const floorDevices = useMemo(
    () => devices.filter((d) => d.floor_id === activeFloorId),
    [devices, activeFloorId],
  );

  const visibleDevices = useMemo(
    () => (selectedDeviceId ? floorDevices.filter((d) => d.id === selectedDeviceId) : floorDevices),
    [floorDevices, selectedDeviceId],
  );

  const circuitsByDevice = useMemo(() => {
    const map = new Map<string, typeof circuits>();
    for (const circuit of circuits) {
      const list = map.get(circuit.device_id) ?? [];
      list.push(circuit);
      map.set(circuit.device_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [circuits]);

  const activeCount = floorDevices.filter((d) => d.status === 'on').length;
  const faultCount = floorDevices.filter((d) => d.status === 'error' || d.status === 'offline').length;
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? null;

  if (!authReady) return <div className="boot">Starting bench…</div>;
  if (!session) return <LoginScreen />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark" />
          <div>
            <h1>Hardware Simulator</h1>
            <p className="muted small">Smart Home Monitoring &amp; Control · appliance bench</p>
          </div>
        </div>

        <div className="topbar-status">
          <span className={`conn conn--${connection}`}>
            <i />
            {CONNECTION_COPY[connection]}
          </span>
          <span className="muted small">{session.user.email}</span>
          <button type="button" className="ghost-btn" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error">
          {error} <button type="button" className="ghost-btn" onClick={state.reload}>Retry</button>
        </p>
      )}

      <nav className="floor-tabs">
        {floors.map((floor) => {
          const count = devices.filter((d) => d.floor_id === floor.id).length;
          const on = devices.filter((d) => d.floor_id === floor.id && d.status === 'on').length;
          return (
            <button
              key={floor.id}
              type="button"
              className={`floor-tab ${floor.id === activeFloorId ? 'is-active' : ''}`}
              onClick={() => {
                setActiveFloorId(floor.id);
                setSelectedDeviceId(null);
              }}
            >
              <span className="floor-tab-name">{floor.name}</span>
              <span className="floor-tab-meta">
                {on}/{count} on
              </span>
            </button>
          );
        })}
        {floors.length === 0 && !loading && (
          <span className="muted small">No floors yet — add one in the mobile app.</span>
        )}
      </nav>

      <main className="body">
        <div className="stage">
          <div className="stage-summary">
            <div className="stat">
              <strong>{floorDevices.length}</strong>
              <span>appliances</span>
            </div>
            <div className="stat stat--on">
              <strong>{activeCount}</strong>
              <span>powered</span>
            </div>
            <div className={`stat ${faultCount ? 'stat--fault' : ''}`}>
              <strong>{faultCount}</strong>
              <span>faulted</span>
            </div>
            {selectedDeviceId && (
              <button type="button" className="ghost-btn" onClick={() => setSelectedDeviceId(null)}>
                Show all
              </button>
            )}
          </div>

          {activeFloor && (
            <FloorPlanBoard
              floor={activeFloor}
              devices={floorDevices}
              pins={pins}
              selectedDeviceId={selectedDeviceId}
              onSelect={setSelectedDeviceId}
            />
          )}

          {loading ? (
            <p className="muted">Loading appliances…</p>
          ) : visibleDevices.length === 0 ? (
            <p className="muted">No appliances on this floor.</p>
          ) : (
            <div className="appliance-grid">
              {visibleDevices.map((device) => (
                <ApplianceCard
                  key={device.id}
                  device={device}
                  circuits={circuitsByDevice.get(device.id) ?? []}
                  onLog={(text, tone) => state.appendLog({ source: 'simulator', tone, text })}
                />
              ))}
            </div>
          )}
        </div>

        <EventLog log={log} alerts={alerts} onClear={state.clearLog} />
      </main>
    </div>
  );
}
