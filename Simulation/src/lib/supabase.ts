import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './config';

/**
 * Browser Supabase client for the hardware simulator.
 *
 * Uses the *anon* key and a normal user session, so every read and write goes
 * through the same row-level-security policies as the mobile app — the
 * simulator can only ever see the appliances of the account it signs into.
 */
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key',
  {
    auth: {
      storage: window.localStorage,
      storageKey: 'smart-home-simulator-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  },
);
