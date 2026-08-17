/**
 * Abstract grid view of one floor, drawn over the same floor plan image the
 * mobile app bundles (assets/images/floor_plan_preview.png).
 *
 * Geometry matches the app exactly: a 360 × 432 canvas rendered `cover`, with
 * pins placed at the 0–100 % coordinates stored in `floor_plan_pins`. A pin
 * dragged on the phone therefore lands on the same spot of the same room here.
 */

import defaultFloorPlan from '../assets/floor_plan_preview.png';
import type { DeviceRow, FloorRow, PinRow } from '../lib/types';

interface Props {
  floor: FloorRow;
  devices: DeviceRow[];
  pins: PinRow[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string | null) => void;
}

export function FloorPlanBoard({ floor, devices, pins, selectedDeviceId, onSelect }: Props) {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const placed = pins
    .filter((pin) => pin.floor_id === floor.id && byId.has(pin.device_id))
    .map((pin) => ({ pin, device: byId.get(pin.device_id)! }));

  const unplaced = devices.filter((d) => !placed.some((p) => p.device.id === d.id));

  // A floor may carry its own uploaded plan; otherwise fall back to the same
  // bundled preview the app uses for every floor.
  const planImage = floor.floor_plan_url || defaultFloorPlan;

  return (
    <section className="floorplan">
      <div className="floorplan-head">
        <h2>{floor.name} · grid</h2>
        <span className="muted">
          {placed.length} pinned · {unplaced.length} unpinned
        </span>
      </div>

      <div className="floorplan-canvas">
        <div
          className="floorplan-grid"
          style={{ backgroundImage: `url(${planImage})` }}
          onClick={() => onSelect(null)}
        >
          <div className="floorplan-mesh" />

          {placed.length === 0 && (
            <p className="floorplan-empty">
              No pins on this floor yet — place devices on the floor plan in the mobile app and they
              appear here instantly.
            </p>
          )}

          {placed.map(({ pin, device }) => (
            <button
              key={pin.id}
              type="button"
              className={`plan-pin plan-pin--${device.status} ${
                selectedDeviceId === device.id ? 'is-selected' : ''
              }`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              title={`${device.name} — ${device.status}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(selectedDeviceId === device.id ? null : device.id);
              }}
            >
              <span className="plan-pin-dot" />
              <span className="plan-pin-label">{device.name}</span>
            </button>
          ))}
        </div>
      </div>

      {unplaced.length > 0 && (
        <p className="floorplan-unplaced">
          Not pinned: {unplaced.map((d) => d.name).join(', ')}
        </p>
      )}
    </section>
  );
}
