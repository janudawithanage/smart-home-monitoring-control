# ─── Stage 1: build the static bundle ────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first so edits to src/ reuse the cached install layer.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ─── Stage 2: serve it ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Supabase URL / anon key are NOT baked into the bundle. entrypoint.sh writes
# them into /usr/share/nginx/html/config.js at container start, so the same
# image can be pointed at any project by changing env vars alone.
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-sim-config.sh

RUN chmod +x /docker-entrypoint.d/40-sim-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://localhost/ || exit 1
