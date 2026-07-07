import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (the underlying request-interception mechanism is unchanged — just the
// file name/export). next-intl's `createMiddleware` returns a plain
// `(request) => response` function regardless of what the consuming file
// is called, so it's used here as-is under the new name.
export default createIntlMiddleware(routing);

export const config = {
  // Match every path except Next's internals, API-proxy-shaped paths, and
  // anything that looks like a static file request (has a dot in the last
  // segment, e.g. favicon.ico) — those should never get locale-redirected.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
