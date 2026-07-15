# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked in at build time since Next.js inlines NEXT_PUBLIC_* vars into the
# client bundle — it cannot be swapped at container-start time the way
# server-only env vars can. Override via a build arg for a different API
# origin per environment.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Same "baked in at build time" reasoning as NEXT_PUBLIC_API_URL above —
# used by sitemap.ts/robots.ts/the root layout's Open Graph metadata.
# Falls back to a localhost value (honest for a build with no real domain
# yet) rather than a fake placeholder domain.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Same "baked in at build time" reasoning — DSNs are safe to expose
# client-side by design (not a secret). SENTRY_ORG/PROJECT/AUTH_TOKEN are
# only used by the build-time source-map-upload step (optional — the build
# skips it without a real token rather than failing).
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG=""
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_PROJECT=""
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN=""
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
RUN npm run build

# --- runtime: only the standalone server output + static assets, nothing else ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# The standalone server (`.next/standalone/server.js`) binds to
# `process.env.HOSTNAME` if it's set, falling back to 0.0.0.0 otherwise.
# Docker/Podman automatically set HOSTNAME to the container's own hostname
# (e.g. its short container ID), which the container's own DNS resolves to
# its *specific* container IP rather than all interfaces — so without this
# override the server ends up reachable from other containers via the
# network (which is how the app still worked through nginx) but NOT via
# localhost/127.0.0.1 inside its own container, which breaks anything that
# checks it that way (this Dockerfile's own HEALTHCHECK included — this
# exact failure mode is what surfaced it during verification).
ENV HOSTNAME=0.0.0.0

RUN addgroup -S domecortex && adduser -S domecortex -G domecortex

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER domecortex

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
