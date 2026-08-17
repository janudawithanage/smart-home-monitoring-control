/**
 * One physical appliance on the bench.
 *
 * Read path : every field shown comes from the `devices` / `switch_circuits`
 *             rows, refreshed by realtime events.
 * Write path: the relay button and the fault-injection controls write straight
 *             back to the same rows, which is what the phone then observes.
 */

import { useState } from 'react';

import { ApplianceVisual } from './ApplianceVisual';
import { CameraFeed, mockStreamUri } from './CameraFeed';
import { setCircuitStatus, setDeviceStatus } from '../lib/hardware';
import { useNow } from '../hooks/useNow';
import type { CircuitRow, CircuitStatus, DeviceRow, DeviceStatus } from '../lib/types';

const STATUS_LABEL: Record<DeviceStatus, string> = {
  on: 'ON',
  off: 'OFF',
  error: 'ERROR',
  offline: 'DISCONNECTED',
};

/** Brightness/level drives how strongly the visual lights up. */
function intensityOf(device: DeviceRow): number {
  if (device.status !== 'on') return 0;
  if (device.value == null) return 1;
  const pct = Math.max(0, Math.min(100, Number(device.value)));
  // Dimmable devices report 0–100; anything else (e.g. °C) just reads as full.
  return device.type === 'light' || device.type === 'speaker' ? 0.25 + (pct / 100) * 0.75 : 1;
}

function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface Props {
  device: DeviceRow;
  circuits: CircuitRow[];
  onLog: (text: string, tone: 'info' | 'warn') => void;
}

export function ApplianceCard({ device, circuits, onLog }: Props) {
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);

  const intensity = intensityOf(device);
  const isFaulted = device.status === 'error' || device.status === 'offline';

  // Safety countdown: on_since is stamped by the DB trigger, safety_timeout is
  // the configured max_on_duration in minutes. The pg_cron job is the authority
  // that actually flips the row — this is only the visible fuse burning down.
  const timeoutMinutes = device.safety_timeout;
  const onSince = device.on_since ? Date.parse(device.on_since) : null;
  const remainingSeconds =
    device.status === 'on' && timeoutMinutes && onSince
      ? (onSince + timeoutMinutes * 60_000 - now) / 1000
      : null;

  async function write(action: () => Promise<string | null>, description: string) {
    setBusy(true);
    const error = await action();
    setBusy(false);
    onLog(error ? `${description} failed: ${error}` : description, error ? 'warn' : 'info');
  }

  const toggleRelay = () =>
    write(
      () => setDeviceStatus(device.id, device.status === 'on' ? 'off' : 'on'),
      `Bench relay: ${device.name} → ${device.status === 'on' ? 'OFF' : 'ON'}`,
    );

  const injectStatus = (status: DeviceStatus, label: string) =>
    write(() => setDeviceStatus(device.id, status), `${label}: ${device.name}`);

  const cycleCircuit = (circuit: CircuitRow) => {
    const next: CircuitStatus = circuit.status === 'on' ? 'off' : 'on';
    return write(
      () => setCircuitStatus(circuit.id, next),
      `Gang switch: ${device.name} · ${circuit.name} → ${next.toUpperCase()}`,
    );
  };

  const totalPower = circuits.reduce(
    (sum, c) => sum + (c.status === 'on' ? Number(c.power ?? 0) : 0),
    0,
  );

  return (
    <article className={`appliance status-${device.status}`}>
      <header className="appliance-head">
        <div>
          <h3>{device.name}</h3>
          <p className="appliance-meta">
            {device.room_name || 'Unassigned room'} · {device.type}
          </p>
        </div>
        <span className={`status-pill status-pill--${device.status}`}>{STATUS_LABEL[device.status]}</span>
      </header>

      <div className="appliance-stage">
        {device.type === 'camera' ? (
          <CameraFeed device={device} />
        ) : (
          <ApplianceVisual device={device} intensity={intensity} />
        )}
      </div>

      {device.type === 'multiSwitch' && circuits.length > 0 && (
        <div className="gang-list">
          <div className="gang-list-head">
            <span>{circuits.length}-gang unit</span>
            <span>{totalPower ? `${totalPower} W drawn` : 'idle'}</span>
          </div>
          {circuits.map((circuit) => (
            <button
              key={circuit.id}
              type="button"
              className={`gang-row gang-row--${circuit.status}`}
              disabled={busy}
              onClick={() => void cycleCircuit(circuit)}
            >
              <span className="gang-name">{circuit.name}</span>
              {circuit.power != null && <span className="gang-power">{circuit.power} W</span>}
              <span className={`gang-led gang-led--${circuit.status}`} />
              <span className="gang-status">{circuit.status.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {device.value != null && device.type !== 'multiSwitch' && (
        <div className="level-row">
          <span>Level</span>
          <div className="level-track">
            <div className="level-fill" style={{ width: `${Math.min(100, Number(device.value))}%` }} />
          </div>
          <span className="level-value">
            {device.value}
            {device.unit ?? ''}
          </span>
        </div>
      )}

      {remainingSeconds != null && (
        <div className={`safety-row ${remainingSeconds <= 60 ? 'is-critical' : ''}`}>
          <span className="safety-label">Safety cutoff</span>
          <span className="safety-clock">
            {remainingSeconds > 0 ? formatRemaining(remainingSeconds) : 'cutoff due'}
          </span>
          <span className="safety-note">max {timeoutMinutes} min</span>
        </div>
      )}

      {device.type === 'camera' && <p className="stream-uri">{mockStreamUri(device)}</p>}

      <footer className="appliance-actions">
        <button
          type="button"
          className={`relay-btn ${device.status === 'on' ? 'is-on' : ''}`}
          disabled={busy || isFaulted}
          onClick={() => void toggleRelay()}
          title={isFaulted ? 'Clear the fault before switching the relay' : 'Switch the physical relay'}
        >
          {device.status === 'on' ? 'Switch off' : 'Switch on'}
        </button>

        <div className="fault-group">
          {device.status !== 'error' && (
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => void injectStatus('error', 'Injected fault')}>
              Fault
            </button>
          )}
          {device.status !== 'offline' && (
            <button
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => void injectStatus('offline', 'Unplugged')}
            >
              Unplug
            </button>
          )}
          {isFaulted && (
            <button type="button" className="ghost-btn ghost-btn--ok" disabled={busy} onClick={() => void injectStatus('off', 'Restored')}>
              Restore
            </button>
          )}
        </div>
      </footer>

      <p className="appliance-stamp">
        last write {new Date(device.last_updated).toLocaleTimeString()}
      </p>
    </article>
  );
}
