// Shared by sentry.server.config.ts, sentry.edge.config.ts, and
// instrumentation-client.ts so the three runtimes can never diverge on the
// same "inert until a real DSN is configured" gating logic — the same class
// of bug (duplicated config logic) this codebase has fixed at the source
// before rather than copying (see the free-scan/authenticated-scan scoring
// util).
export function resolveSentryOptions(env: NodeJS.ProcessEnv = process.env) {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: !!dsn,
    environment: env.NODE_ENV ?? "development",
    tracesSampleRate: dsn ? 0.1 : 0,
  };
}
