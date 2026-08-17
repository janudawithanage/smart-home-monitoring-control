# Hardware Simulator Dashboard

Web-based companion simulator for the Smart Home Monitoring & Control mini-project. It represents
the home's physical appliances, listens to Supabase realtime, and reflects every database change
visually — and writes appliance-side changes (relay, faults, gang switches) straight back.

```bash
cd Simulation
cp .env.example .env          # SUPABASE_URL + SUPABASE_ANON_KEY (same pair as the app)
docker compose up --build     # → http://localhost:8080
```

Local development instead of Docker:

```bash
npm install && npm run dev    # → http://localhost:5173
```

Sign in with the same account you use in the mobile app — row-level security scopes the bench to
that home's devices.

**Full write-up: [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)** — synchronisation mechanism, floor
representation, simulator operations, and the Docker packaging.
