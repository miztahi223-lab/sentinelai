import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors from Server Components, Route Handlers, Server Actions,
// and the edge proxy (proxy.ts) that Next's own error boundaries don't see.
export const onRequestError = Sentry.captureRequestError;
