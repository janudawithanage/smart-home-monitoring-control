# Companion Hardware Simulator — How It Works

A web-based **Hardware Simulator Dashboard** that stands in for the physical appliances of the
Smart Home Monitoring & Control system. It listens directly to the Supabase database and reflects
every change visually, in real time — and it can push appliance-side changes back, so the mobile
app and the "hardware" stay in sync in both directions.

Built with **React 19 + TypeScript + Vite**, served by **nginx** inside a Docker container.
Everything lives in `Simulation/`; no file outside that folder was touched.

---

## 1. Where it sits in the system

```
┌──────────────────┐        writes / reads         ┌──────────────────────────┐
│   Mobile app     │ ────────────────────────────► │                          │
│  (Expo Router)   │ ◄──────────────────────────── │       Supabase           │
└──────────────────┘   postgres_changes (WS)       │  Postgres + Realtime     │
                                                   │  + RLS + pg_cron         │
┌──────────────────┐   postgres_changes (WS)       │                          │
│ Hardware         │ ◄──────────────────────────── │  devices                 │
│ Simulator        │ ────────────────────────────► │  switch_circuits         │
│ (this folder)    │        writes / reads         │  floors / pins / alerts  │
└──────────────────┘                               └──────────────────────────┘
```

Neither client talks to the other. **The database is the only source of truth**, and both sides are
peers of it. That is exactly how a real IoT deployment behaves: the phone never addresses the lamp,
it writes a desired state to the cloud, and the lamp observes it.

The simulator holds **no local state of its own**. Every pixel on screen is a pure function of a row
in Postgres.

---

## 2. The synchronisation mechanism

### 2.1 Snapshot, then stream

On sign-in the simulator performs exactly **one** read pass (`src/hooks/useHardwareState.ts`):

| Table | What it provides |
|---|---|
| `floors` | the floor tabs |
| `devices` | every appliance: type, status, value, `safety_timeout`, `on_since` |
| `switch_circuits` | individual gangs of each multi-switch unit |
| `floor_plan_pins` | 0–100 % pin coordinates for the grid view |
| `alerts` | the most recent 25 safety/error notifications |

From that moment on there is **no polling and no refresh button**. A single Supabase realtime
channel carries `postgres_changes` events for all five tables, and each event is folded into local
React state by id:

```ts
supabase.channel('hardware-simulator')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, handleDevice)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'switch_circuits' }, handleCircuit)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, handleAlert)
  // … floors, floor_plan_pins
  .subscribe(status => setConnection(status === 'SUBSCRIBED' ? 'live' : …));
```

`INSERT` and `UPDATE` upsert the row into the matching list; `DELETE` removes it by primary key.
Because the mobile app uses the *same* mechanism (`services/realtime.ts`), a write from either side
reaches the other in roughly the round-trip time of one WebSocket frame.

The **connection pill** in the top bar exposes the channel state (`Live` / `Connecting` /
`Disconnected`), so a demo never has to guess whether the socket is healthy.

### 2.2 Which direction each control moves

| Action | Written by | Observed by |
|---|---|---|
| Toggle a device in the app | mobile → `devices.status` | simulator lights up |
| Drag a pin on the floor plan | mobile → `floor_plan_pins` | simulator pin moves |
| **Switch on / Switch off** on a card | simulator → `devices.status` | mobile card flips |
| **Fault** / **Unplug** / **Restore** | simulator → `devices.status` (`error` / `offline` / `off`) | mobile shows ERROR / DISCONNECTED |
| Tap a gang row | simulator → `switch_circuits.status` | mobile multi-switch screen |
| Safety cutoff fires | `pg_cron` job → `devices.status` + `alerts` | **both** clients simultaneously |

The last row is the interesting one: nothing in either client performs that write. The database
does it on its own, and both clients simply observe it.

### 2.3 Security model

The simulator signs in with the **anon key plus the homeowner's email/password** — the same
credentials used in the mobile app. No service-role key exists anywhere in this folder.

Consequently every read and write passes through the row-level-security policies in
`supabase/schema.sql`: the bench can only ever see and control the appliances belonging to the
account it authenticated as. Sessions persist in `localStorage` under a simulator-specific key, so
running the bench and the app's web build side by side does not clash.

---

## 3. Floor representation

Each floor is a tab (ordered by `floors.level`). Selecting one filters the appliance grid to the
devices whose `floor_id` matches.

Above the grid is the **abstract grid board** (`src/components/FloorPlanBoard.tsx`), the simulator's
counterpart to the app's floor-plan screen:

- The board draws the **same floor plan the app bundles** — `assets/images/floor_plan_preview.png`,
  copied into `src/assets/` so the container is self-contained (the simulator must not reach into
  the Expo project at build time). If a floor carries its own `floors.floor_plan_url`, that image
  wins; otherwise every floor renders the shared preview, exactly as the app does via
  `DEFAULT_FLOOR_PLAN_IMAGE` in `data/floorPlanData.ts`.
- **Geometry is matched to the app**: a 360 × 432 canvas (`aspect-ratio: 360 / 432`) painted
  `cover`, the same values the app's `Image` uses. Without that, identical percentages would land on
  different rooms in the two views.
- The abstract grid mesh is a 10 × 12 cell overlay drawn *on top* of the plan, with a dark tint so
  pins and labels stay readable against a light architectural drawing.
- Pins are positioned with `left: x%` / `top: y%` straight from `floor_plan_pins`. Those are the
  identical percentages the mobile app writes, which is what keeps the two views geometrically
  consistent at any window size.
- Pin colour encodes status: green = ON, grey = OFF, red = ERROR, dim = DISCONNECTED.
- Clicking a pin focuses that single appliance card; clicking the background clears the focus.
- Devices with no pin row are listed underneath, so nothing is silently invisible.

---

## 4. Simulator operations (per appliance type)

Each card renders a small SVG rig driven purely by the row's `status` (and `value`, where the device
is dimmable). `src/components/ApplianceVisual.tsx` holds the rigs.

| Type | Visual behaviour |
|---|---|
| `light` | Bulb with a radial glow whose opacity tracks `value` (brightness 0–100) |
| `outlet` | Socket with live-contact indicator and a pulsing power LED |
| `iron` | Sole plate heats red and emits steam while ON; pairs with the safety countdown |
| `multiSwitch` | Gang box; each `switch_circuits` row is a clickable rocker with its own LED and wattage |
| `camera` | Mock stream — synthesised scene, drifting subject, scanlines, REC dot, burnt-in clock, and a deterministic `rtsp://sim.local:8554/…` URI. Falls back to `NO SIGNAL` / `SENSOR FAULT` tiles when the row is not `on` |
| `fan` | Blades spin, speed derived from `value` |
| `thermostat` | Dial arc + numeric readout from `value` / `unit` |
| `lock` | Shackle closes when `on`, opens when `off` |
| `tv`, `speaker` | Animated screen content / pulsing driver cone |

**Status vocabulary.** `devices.status` is one of `on`, `off`, `error`, `offline`; the badge renders
`offline` as **DISCONNECTED** to match the wording in the specification. `switch_circuits.status`
uses `disconnected` directly for the same idea at gang level.

### 4.1 Safety countdown

For any device with a `safety_timeout` (minutes), a live fuse is displayed while it is ON:

```
remaining = on_since + safety_timeout × 60s − now
```

`on_since` is stamped by the `set_device_on_since` trigger (`supabase/safety_cutoff.sql`), so the
countdown is anchored to the database's own notion of when the appliance started drawing power —
not to when this browser tab happened to open. Under a minute the row turns red and pulses.

The countdown is **advisory only**. The authority is the `pg_cron` job, which flips the row to `off`
and inserts a `safety` alert. When it fires, the simulator receives two realtime events: the device
goes dark, and the alert appears in the side panel. That is the requirement's server-side cutoff
demonstrated end to end, with the app closed if you like.

### 4.2 Fault injection

Real hardware fails; the bench can too. Each card offers:

- **Fault** → writes `status = 'error'`
- **Unplug** → writes `status = 'offline'`
- **Restore** → writes `status = 'off'`

While a device is faulted its relay button is disabled — you must clear the fault first, mirroring
the app's own rule that `error`/`offline` devices are not toggleable (`services/deviceService.ts`
leaves those statuses unchanged).

### 4.3 Event console

The right-hand panel is a 200-line rolling log of every event the bench observed or wrote, colour
coded by tone, plus the five most recent alerts. During a demo this is the visible proof of the sync
loop: toggle on the phone and the line lands here before the animation finishes.

---

## 5. Running it

### 5.1 Docker (the intended deployment)

```bash
cd Simulation
cp .env.example .env          # fill in SUPABASE_URL + SUPABASE_ANON_KEY
docker compose up --build     # → http://localhost:8080
```

Change the host port with `SIM_PORT=9000 docker compose up`.

Without compose:

```bash
docker build -t smart-home-simulator .
docker run --rm -p 8080:80 \
  -e SUPABASE_URL=https://YOUR-REF.supabase.co \
  -e SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  smart-home-simulator
```

**How the image is built** (`Dockerfile`, two stages):

1. `node:22-alpine` installs dependencies and runs `tsc -b && vite build`.
2. `nginx:1.27-alpine` serves the resulting `dist/`, with gzip, immutable caching for hashed assets,
   and an SPA fallback (`docker/nginx.conf`).

**Credentials are not baked into the image.** `docker/entrypoint.sh` runs from nginx's
`/docker-entrypoint.d/` on every container start and regenerates `/usr/share/nginx/html/config.js`
from the environment:

```js
window.__SIM_CONFIG__ = { SUPABASE_URL: "…", SUPABASE_ANON_KEY: "…" };
```

`src/lib/config.ts` reads that object first and falls back to Vite's `VITE_*` env vars for local
development. So one built image can be pointed at a different Supabase project by changing an
environment variable — no rebuild. `config.js` is served `no-store` so a stale copy is never cached.

### 5.2 Local development

```bash
cd Simulation
npm install
cp .env.example .env     # the VITE_* pair is the one used here
npm run dev              # → http://localhost:5173
```

### 5.3 Prerequisites in Supabase

Run these once in the SQL editor (all already in the repo, unchanged by this work):

1. `supabase/schema.sql` — tables, RLS, and the realtime publication
2. `supabase/safety_cutoff.sql` — `on_since` column, trigger, and the `pg_cron` cutoff job
3. `supabase/device_usage_log.sql` — usage sessions behind the app's energy reporting
4. `supabase/schedule_executor.sql` — the time-based schedule runner

Realtime must include the tables the bench watches — step 1 already does this:

```sql
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.switch_circuits;
-- … floors, floor_plan_pins, alerts
```

> **Note on multi-switch data.** The `switch_circuits` table is real and the simulator reads it
> live, but the app's multi-switch screen (`app/multi-switch/[id].tsx`) still renders locally mocked
> gangs. To see populated gang boxes on the bench, insert circuit rows for a `multiSwitch` device —
> `sql/demo_circuits.sql` in this folder has a ready statement.

---

## 6. Demo script (≈2 minutes)

1. Open the bench next to the phone. The pill reads **Live**.
2. Toggle a light in the app → the bulb glows here instantly; a green line appears in the console.
3. Hit **Fault** on the same card → the phone's card flips to ERROR without a refresh.
4. **Restore**, then turn on the iron with a 1-minute `safety_timeout` → the fuse counts down,
   turns red under a minute, and at zero the `pg_cron` job turns the device off and pushes a safety
   alert. Both the phone and the bench react at the same moment, from a write neither of them made.
5. Drag a device pin on the app's floor plan → the pin slides across the bench's grid board.

---

## 7. File map

```
Simulation/
├── Dockerfile                     two-stage build → nginx
├── docker-compose.yml             one-command run, env-driven
├── docker/
│   ├── entrypoint.sh              writes config.js from env at container start
│   └── nginx.conf                 SPA fallback, gzip, cache policy
├── .env.example                   credential template (copy to .env)
├── index.html                     loads /config.js before the bundle
├── public/config.js               dev placeholder (overwritten in Docker)
├── sql/demo_circuits.sql          optional seed for multi-switch gangs
├── src/
│   ├── App.tsx                    shell: floor tabs, grid, summary, console
│   ├── main.tsx
│   ├── styles.css
│   ├── assets/
│   │   └── floor_plan_preview.png copy of the app's bundled floor plan
│   ├── hooks/
│   │   ├── useHardwareState.ts    snapshot + realtime subscriptions + log
│   │   └── useNow.ts              1 s clock for countdowns and the camera OSD
│   ├── lib/
│   │   ├── config.ts              runtime-then-buildtime credential resolution
│   │   ├── supabase.ts            anon-key browser client
│   │   ├── hardware.ts            write path (status, circuits, alerts)
│   │   └── types.ts               row shapes mirrored from schema.sql
│   └── components/
│       ├── LoginScreen.tsx        email/password sign-in (RLS scoping)
│       ├── FloorPlanBoard.tsx     abstract grid + pins
│       ├── ApplianceCard.tsx      one appliance: state, controls, safety fuse
│       ├── ApplianceVisual.tsx    SVG rigs per device type
│       ├── CameraFeed.tsx         mock stream / no-signal tiles
│       └── EventLog.tsx           alerts + rolling realtime console
└── HOW_IT_WORKS.md                this document
```
