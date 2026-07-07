#!/bin/sh
set -e

# `prisma migrate deploy` (not `migrate dev`) is the correct command for a
# production container: it applies already-committed migration files
# without ever prompting or generating new ones, and is safe to run on
# every container start (a no-op if the schema is already up to date).
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting SentinelAI backend..."
exec node dist/src/main.js
