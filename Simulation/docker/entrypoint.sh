#!/bin/sh
# Regenerates config.js from environment variables on every container start.
# The nginx base image runs everything in /docker-entrypoint.d/ before nginx
# itself starts, so the file is always in place before the first request.
set -eu

TARGET=/usr/share/nginx/html/config.js

: "${SUPABASE_URL:=}"
: "${SUPABASE_ANON_KEY:=}"

cat > "$TARGET" <<EOF
window.__SIM_CONFIG__ = {
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}",
};
EOF

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "[simulator] WARNING: SUPABASE_URL / SUPABASE_ANON_KEY are unset — the dashboard cannot connect." >&2
else
  echo "[simulator] runtime config written for ${SUPABASE_URL}"
fi
