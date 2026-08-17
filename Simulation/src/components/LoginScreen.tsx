/**
 * The simulator authenticates as the homeowner (anon key + email/password), so
 * row-level security scopes it to exactly the appliances that account owns.
 * There is no service-role key anywhere in this app.
 */

import { useState, type FormEvent } from 'react';

import { supabase } from '../lib/supabase';
import { isConfigured } from '../lib/config';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="login-chip">HARDWARE SIMULATOR</span>
          <h1>Smart Home Appliance Bench</h1>
          <p>
            Sign in with the same account you use in the mobile app. The bench then mirrors that
            home&apos;s physical appliances in real time.
          </p>
        </div>

        {!isConfigured && (
          <p className="login-error">
            Supabase credentials are missing. Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> (or the Docker env vars) and reload.
          </p>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            autoComplete="username"
            required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button className="primary-btn" type="submit" disabled={busy || !isConfigured}>
          {busy ? 'Connecting…' : 'Connect bench'}
        </button>
      </form>
    </div>
  );
}
