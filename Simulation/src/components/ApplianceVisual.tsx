/**
 * The "physical" half of the simulator: a small SVG rig per appliance type that
 * reacts to the row's status. Nothing here holds state — every pixel is a pure
 * function of what the database currently says.
 */

import type { DeviceRow, DeviceStatus } from '../lib/types';

interface VisualProps {
  device: DeviceRow;
  /** 0–1 intensity: 0 when off/faulted, brightness fraction when on. */
  intensity: number;
}

const FAULT_STROKE = '#f97362';

function faultTint(status: DeviceStatus): string | undefined {
  if (status === 'error') return FAULT_STROKE;
  if (status === 'offline') return '#6b7280';
  return undefined;
}

function LightBulb({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const glow = intensity;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Light bulb">
      <defs>
        <radialGradient id={`glow-${device.id}`}>
          <stop offset="0%" stopColor="#ffe6a3" stopOpacity={0.95 * glow} />
          <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="52" r="46" fill={`url(#glow-${device.id})`} />
      <path
        d="M60 20c-14 0-25 11-25 25 0 10 6 16 9 21 2 3 3 6 3 9h26c0-3 1-6 3-9 3-5 9-11 9-21 0-14-11-25-25-25z"
        fill={tint ? 'none' : `rgba(255,214,102,${0.15 + 0.75 * glow})`}
        stroke={tint ?? '#f6c453'}
        strokeWidth="3"
      />
      <path d="M48 84h24M50 92h20M53 100h14" stroke={tint ?? '#9aa4b2'} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function Outlet({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const live = intensity > 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Power outlet">
      <rect x="22" y="16" width="76" height="88" rx="12" fill="#141a24" stroke={tint ?? '#2c3546'} strokeWidth="3" />
      <circle cx="60" cy="52" r="26" fill="none" stroke={tint ?? '#3c465c'} strokeWidth="3" />
      <rect x="49" y="40" width="7" height="18" rx="3" fill={live ? '#4ade80' : '#3c465c'} />
      <rect x="64" y="40" width="7" height="18" rx="3" fill={live ? '#4ade80' : '#3c465c'} />
      <circle cx="60" cy="66" r="4" fill={live ? '#4ade80' : '#3c465c'} />
      <circle cx="60" cy="90" r="6" fill={live ? '#4ade80' : '#252c3a'}>
        {live && <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

function Iron({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const hot = intensity > 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Clothes iron">
      <path
        d="M24 78c0-16 16-30 40-30h30c4 0 6 3 5 7l-5 23H28c-2 0-4-2-4-4z"
        fill={hot ? 'rgba(249,115,98,0.22)' : '#1a2130'}
        stroke={tint ?? (hot ? '#f97362' : '#3c465c')}
        strokeWidth="3"
      />
      <path d="M34 48c4-14 16-22 30-22h20" fill="none" stroke={tint ?? '#6b7684'} strokeWidth="5" strokeLinecap="round" />
      <rect x="22" y="86" width="80" height="8" rx="4" fill={hot ? '#f97362' : '#2c3546'} />
      {hot && (
        <g stroke="#f97362" strokeWidth="3" strokeLinecap="round" opacity="0.75">
          <path d="M40 26c4-5-4-9 0-14">
            <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M56 24c4-5-4-9 0-14">
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.4s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </svg>
  );
}

function Fan({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const spinning = intensity > 0;
  const duration = spinning ? `${Math.max(0.35, 1.4 - intensity)}s` : '0s';
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Ceiling fan">
      <circle cx="60" cy="60" r="44" fill="#141a24" stroke={tint ?? '#2c3546'} strokeWidth="3" />
      <g>
        {spinning && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 60"
            to="360 60 60"
            dur={duration}
            repeatCount="indefinite"
          />
        )}
        {[0, 120, 240].map((angle) => (
          <ellipse
            key={angle}
            cx="60"
            cy="36"
            rx="9"
            ry="22"
            fill={tint ?? (spinning ? '#60a5fa' : '#49546b')}
            transform={`rotate(${angle} 60 60)`}
          />
        ))}
      </g>
      <circle cx="60" cy="60" r="9" fill="#0d1219" stroke={tint ?? '#6b7684'} strokeWidth="3" />
    </svg>
  );
}

function Lock({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const engaged = intensity > 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Smart lock">
      <path
        d={engaged ? 'M42 52V38a18 18 0 0 1 36 0v14' : 'M42 52V38a18 18 0 0 1 34-6'}
        fill="none"
        stroke={tint ?? (engaged ? '#4ade80' : '#f6c453')}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="32" y="52" width="56" height="46" rx="10" fill="#141a24" stroke={tint ?? '#2c3546'} strokeWidth="3" />
      <circle cx="60" cy="72" r="6" fill={engaged ? '#4ade80' : '#f6c453'} />
      <rect x="57" y="76" width="6" height="12" rx="3" fill={engaged ? '#4ade80' : '#f6c453'} />
    </svg>
  );
}

function Thermostat({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const active = intensity > 0;
  const reading = device.value ?? 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Thermostat">
      <circle cx="60" cy="60" r="42" fill="#141a24" stroke={tint ?? (active ? '#60a5fa' : '#2c3546')} strokeWidth="4" />
      <circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke={active ? '#60a5fa' : 'transparent'}
        strokeWidth="4"
        strokeDasharray={`${Math.min(100, Math.max(0, reading)) * 2.64} 264`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="66" textAnchor="middle" className="visual-readout">
        {reading}
        {device.unit ?? '°C'}
      </text>
    </svg>
  );
}

function Screen({ device, intensity, label }: VisualProps & { label: string }) {
  const tint = faultTint(device.status);
  const active = intensity > 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label={label}>
      <rect x="16" y="24" width="88" height="58" rx="8" fill={active ? '#12263f' : '#141a24'} stroke={tint ?? '#2c3546'} strokeWidth="3" />
      {active && (
        <g opacity="0.7">
          <rect x="24" y="34" width="30" height="6" rx="3" fill="#60a5fa">
            <animate attributeName="width" values="30;62;30" dur="3s" repeatCount="indefinite" />
          </rect>
          <rect x="24" y="48" width="52" height="6" rx="3" fill="#3b82f6" opacity="0.6" />
          <rect x="24" y="62" width="40" height="6" rx="3" fill="#3b82f6" opacity="0.4" />
        </g>
      )}
      <rect x="46" y="86" width="28" height="6" rx="3" fill={tint ?? '#3c465c'} />
      <rect x="34" y="94" width="52" height="6" rx="3" fill={tint ?? '#2c3546'} />
    </svg>
  );
}

function Speaker({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  const active = intensity > 0;
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Speaker">
      <rect x="34" y="14" width="52" height="92" rx="14" fill="#141a24" stroke={tint ?? '#2c3546'} strokeWidth="3" />
      <circle cx="60" cy="44" r="15" fill="none" stroke={tint ?? (active ? '#a78bfa' : '#3c465c')} strokeWidth="3">
        {active && <animate attributeName="r" values="13;17;13" dur="1.2s" repeatCount="indefinite" />}
      </circle>
      <circle cx="60" cy="82" r="9" fill="none" stroke={tint ?? (active ? '#a78bfa' : '#3c465c')} strokeWidth="3" />
    </svg>
  );
}

function GangBox({ device, intensity }: VisualProps) {
  const tint = faultTint(device.status);
  return (
    <svg viewBox="0 0 120 120" className="visual-svg" role="img" aria-label="Multi-switch gang box">
      <rect x="24" y="18" width="72" height="84" rx="10" fill="#141a24" stroke={tint ?? '#2c3546'} strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="38" y={30 + i * 26} width="44" height="18" rx="5" fill="#0d1219" stroke="#3c465c" strokeWidth="2" />
          <rect
            x={intensity > 0 ? 62 : 40}
            y={32 + i * 26}
            width="18"
            height="14"
            rx="4"
            fill={intensity > 0 ? '#4ade80' : '#49546b'}
          />
        </g>
      ))}
    </svg>
  );
}

export function ApplianceVisual({ device, intensity }: VisualProps) {
  switch (device.type) {
    case 'light':
      return <LightBulb device={device} intensity={intensity} />;
    case 'outlet':
      return <Outlet device={device} intensity={intensity} />;
    case 'iron':
      return <Iron device={device} intensity={intensity} />;
    case 'fan':
      return <Fan device={device} intensity={intensity} />;
    case 'lock':
      return <Lock device={device} intensity={intensity} />;
    case 'thermostat':
      return <Thermostat device={device} intensity={intensity} />;
    case 'tv':
      return <Screen device={device} intensity={intensity} label="Television" />;
    case 'speaker':
      return <Speaker device={device} intensity={intensity} />;
    case 'multiSwitch':
      return <GangBox device={device} intensity={intensity} />;
    default:
      return <Screen device={device} intensity={intensity} label={device.type} />;
  }
}
