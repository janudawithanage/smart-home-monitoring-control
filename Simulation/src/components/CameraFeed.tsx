/**
 * Mock camera stream. The DB stores no video, so the "sensor" is synthesised
 * here: a static scene plus a drifting subject, scanlines and a burnt-in clock.
 * The stream only runs while devices.status = 'on'; error/offline rows render
 * the corresponding no-signal card, exactly like a real NVR tile would.
 */

import { useNow } from '../hooks/useNow';
import type { DeviceRow } from '../lib/types';

/** Deterministic mock RTSP URI so the same camera always shows the same path. */
export function mockStreamUri(device: DeviceRow): string {
  return `rtsp://sim.local:8554/${device.id.slice(0, 8)}/${device.type}`;
}

export function CameraFeed({ device }: { device: DeviceRow }) {
  const now = useNow(1000);
  const live = device.status === 'on';
  const offline = device.status === 'offline';
  const faulted = device.status === 'error';

  // Subject drifts across the frame on a slow loop — enough motion to prove the
  // tile is live without pulling in a video asset.
  const phase = (now / 1000) % 12;
  const subjectX = 18 + Math.abs(6 - phase) * 12;

  if (!live) {
    return (
      <div className={`camera-frame camera-frame--dead ${faulted ? 'is-fault' : ''}`}>
        <div className="camera-noise" />
        <span className="camera-dead-label">
          {offline ? 'NO SIGNAL' : faulted ? 'SENSOR FAULT' : 'STANDBY'}
        </span>
      </div>
    );
  }

  return (
    <div className="camera-frame">
      <svg viewBox="0 0 200 120" className="camera-scene" role="img" aria-label={`${device.name} live view`}>
        <rect width="200" height="120" fill="#0f1620" />
        <rect y="78" width="200" height="42" fill="#16202c" />
        <rect x="12" y="42" width="46" height="36" fill="#1c2836" />
        <rect x="150" y="34" width="38" height="44" fill="#1a2532" />
        <rect x="158" y="42" width="22" height="16" fill="#243447" />
        <ellipse cx={subjectX} cy="96" rx="9" ry="3" fill="rgba(0,0,0,0.45)" />
        <g transform={`translate(${subjectX} 0)`}>
          <circle cx="0" cy="72" r="6" fill="#4b5a6d" />
          <rect x="-6" y="78" width="12" height="16" rx="4" fill="#3d4b5c" />
        </g>
      </svg>
      <div className="camera-scanlines" />
      <div className="camera-osd">
        <span className="camera-rec">
          <i />
          REC
        </span>
        <span>{new Date(now).toLocaleTimeString()}</span>
      </div>
      <div className="camera-uri">{mockStreamUri(device)}</div>
    </div>
  );
}
