/**
 * Live console of everything the bench has observed or written. This is the
 * visible proof of the sync loop during a demo: toggle on the phone, watch the
 * line appear here before the animation finishes.
 */

import type { AlertRow, LogEntry } from '../lib/types';

interface Props {
  log: LogEntry[];
  alerts: AlertRow[];
  onClear: () => void;
}

export function EventLog({ log, alerts, onClear }: Props) {
  const recentAlerts = alerts.slice(0, 5);

  return (
    <aside className="console">
      <div className="console-block">
        <div className="console-head">
          <h2>Safety alerts</h2>
          <span className="muted">{alerts.length} recent</span>
        </div>
        {recentAlerts.length === 0 ? (
          <p className="muted small">No alerts raised.</p>
        ) : (
          <ul className="alert-list">
            {recentAlerts.map((alert) => (
              <li key={alert.id} className={`alert-item alert-item--${alert.type}`}>
                <strong>{alert.title}</strong>
                {alert.message && <span>{alert.message}</span>}
                <time>{new Date(alert.created_at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="console-block console-block--grow">
        <div className="console-head">
          <h2>Realtime event log</h2>
          <button type="button" className="ghost-btn" onClick={onClear}>
            Clear
          </button>
        </div>
        <ul className="log-list">
          {log.length === 0 && <li className="muted small">Waiting for database events…</li>}
          {log.map((entry) => (
            <li key={entry.id} className={`log-line log-line--${entry.tone}`}>
              <time>{entry.at}</time>
              <span className="log-source">{entry.source}</span>
              <span className="log-text">{entry.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
