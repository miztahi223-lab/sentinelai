# syntax=docker/dockerfile:1

# --- deps: install all dependencies (including dev, needed to build) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# --- build: compile TypeScript + generate the Prisma client ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- prod-deps: production-only node_modules, kept in its own stage so ---
# --- the final image never contains dev dependencies (tsc, eslint, jest, etc.) ---
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

# --- runtime: the actual image that ships ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user rather than the container default root — a
# compromised Node process shouldn't have root inside its own container.
RUN addgroup -S domecortex && adduser -S domecortex -G domecortex

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /app/storage/reports && chown -R domecortex:domecortex /app

USER domecortex

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
