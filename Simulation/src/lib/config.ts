/**
 * Resolves Supabase credentials from (in order):
 *   1. window.__SIM_CONFIG__  — injected at container start by docker/entrypoint.sh
 *   2. Vite env vars          — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (local dev)
 *
 * The runtime source wins so a single built image can target any project.
 */

declare global {
  interface Window {
    __SIM_CONFIG__?: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
  }
}

const runtime = typeof window !== 'undefined' ? window.__SIM_CONFIG__ : undefined;

export const SUPABASE_URL =
  runtime?.SUPABASE_URL?.trim() || (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';

export const SUPABASE_ANON_KEY =
  runtime?.SUPABASE_ANON_KEY?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  '';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
