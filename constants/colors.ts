/**
 * Smart Home – Design Token Colors
 * Dark-first palette inspired by the luxury deep-navy theme used in login.
 */

export const Colors = {
  // Backgrounds
  bg: {
    primary: '#0a1628',
    secondary: '#0f1e3a',
    card: '#111f38',
    elevated: '#162340',
  },

  // Brand / accent
  accent: {
    blue: '#4d7cf4',
    blueDark: '#3d6bea',
    blueLight: '#5a8aff',
    cyan: '#00c6ff',
    purple: '#7c5cbf',
  },

  // Status
  status: {
    on: '#4ade80',      // green
    off: '#475569',     // slate
    error: '#f87171',   // red
    offline: '#f59e0b', // amber
  },

  // Text
  text: {
    primary: '#ffffff',
    secondary: '#c0cce8',
    muted: '#8a9bc0',
    placeholder: '#4a5a7a',
  },

  // Border / divider
  border: {
    default: 'rgba(61, 107, 234, 0.2)',
    focused: '#4d7cf4',
    subtle: 'rgba(255,255,255,0.06)',
  },

  // Device type accent colors
  device: {
    light: '#fbbf24',
    thermostat: '#f97316',
    lock: '#a78bfa',
    camera: '#60a5fa',
    fan: '#34d399',
    tv: '#818cf8',
    speaker: '#e879f9',
    outlet: '#fbbf24',     // amber/yellow for electrical power
    iron: '#fb923c',
    multiSwitch: '#2dd4bf',
  },
} as const;
