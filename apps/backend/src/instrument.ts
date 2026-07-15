import * as Sentry from '@sentry/nestjs';

// Same "inert until a real credential exists" pattern as
// STRIPE_SECRET_KEY/AI_API_KEY (see billing.service.ts) — SENTRY_DSN is unset
// in this build environment, so `enabled` stays false until a real DSN is
// configured, rather than silently trying (and failing) to send events.
export function resolveSentryOptions(
  env: NodeJS.ProcessEnv = process.env,
): Sentry.NodeOptions {
  const dsn = env.SENTRY_DSN;
  return {
    dsn,
    enabled: !!dsn,
    environment: env.NODE_ENV ?? 'development',
    tracesSampleRate: dsn ? 0.1 : 0,
  };
}

// Must be the very first import in main.ts (before @nestjs/core, pg, etc.) so
// Sentry's auto-instrumentation can hook into those modules before they're
// required.
Sentry.init(resolveSentryOptions());
