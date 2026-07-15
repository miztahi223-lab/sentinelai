import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// The backend's own responses already carry a full hardened header set via
// helmet (see apps/backend/src/main.ts) — the `/security` page's claim of
// "standard hardening headers... applied to every response" was only true
// for the API, not for the pages this Next.js server itself renders. This
// mirrors the same real headers on the frontend's own HTML responses too.
//
// `'unsafe-inline'` is required on both `script-src` (the homepage's real
// JSON-LD structured data, rendered as inline `<script>` tags) and
// `style-src` (a couple of components set real inline `style` attributes,
// e.g. `TiltCard`'s 3D transform) — the same tradeoff helmet's own default
// CSP already makes for `style-src` on the backend.
const API_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    ).origin;
  } catch {
    return "http://localhost:3001";
  }
})();

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${API_ORIGIN}`,
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained `.next/standalone` server bundle
  // (only the production node_modules a request actually needs, traced via
  // webpack) — this is what makes the production Docker image small and
  // avoids copying the entire node_modules tree into the final image.
  // Requires running the built app via `npm start` (which copies
  // `public/`/`.next/static` into `.next/standalone/` and runs
  // `.next/standalone/server.js`) — plain `next start` prints a warning and
  // won't correctly serve static assets against a standalone build.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

// Same "inert until a real credential exists" pattern as SENTRY_DSN itself:
// no real Sentry org/project/auth token exists in this build environment, so
// source map upload is silently skipped (Sentry's build plugin warns and
// no-ops without SENTRY_AUTH_TOKEN rather than failing the build).
// `tunnelRoute` sends Sentry's own requests through this app's own origin
// (a rewritten same-origin route) instead of directly to sentry.io, so the
// existing strict `connect-src 'self' ...` CSP above never needs to be
// loosened for it, and ad-blockers that block sentry.io directly don't
// silently drop error reports either.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
