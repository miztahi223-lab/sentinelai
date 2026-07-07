# SentinelAI — Build Progress

Tracking real, verified progress against the 19-step build plan. "Done" means implemented AND
tested against the real local stack (Postgres/Redis running), not just scaffolded.

| Step | Description | Status |
|---|---|---|
| 0 | Environment inspection | Done |
| 1 | Project structure | Done |
| 2 | Backend setup (NestJS) | Done |
| 3 | Frontend setup (Next.js) | Done |
| 4 | Database setup (Postgres + Prisma schema: User, Organization, Membership, Domain, Asset, Scan, Finding, Alert, Report, Subscription, AuditLog + RefreshToken) | Done — migrated & client generated |
| 5 | Authentication (register/login/logout/refresh/forgot-password/reset-password/verify-email, Argon2id, JWT access + rotating opaque refresh tokens, rate-limited endpoints) | Done — full end-to-end smoke test passed against real DB (see below) |
| 6 | Main dashboard (frontend routes + components) | Done — see below |
| 7 | Asset discovery module (dns/ssl/http/technology services) | Done — see below |
| 8 | Background workers (BullMQ) | Not started |
| 9 | Monitoring engine | Not started |
| 10 | Risk engine | Not started |
| 11 | AI integration | Not started |
| 12 | Reports (PDF) | Not started |
| 13 | Billing (Stripe) | Not started |
| 14 | Landing page | Not started |
| 15 | Testing | Not started (beyond the manual smoke test in step 5) |
| 16 | Docker production | Not started (local dev docker-compose for Postgres/Redis exists) |
| 17 | CI/CD | Not started |
| 18 | Security review | Not started (some security practices already applied inline: Argon2id, refresh rotation, Helmet, rate limiting, input validation, secret redaction in logs) |
| 19 | Final QA | Not started |

## Key engineering decisions made so far (deviations from the literal instructions, with reasons)

1. **BullMQ's Redis client**: installed `ioredis` instead of the `redis` package. BullMQ requires
   `ioredis` specifically; the `redis` npm package is a different, incompatible client. Functional
   necessity, not a style choice.
2. **`react-query` → `@tanstack/react-query`**: the bare `react-query` package is deprecated
   (v3, unmaintained). Installed the actively maintained successor instead.
3. **Password hashing: Argon2 only, not bcrypt.** Step 2's dependency list included both; Step 5
   explicitly calls for Argon2. Using both would be redundant — Argon2id is the stronger, current
   OWASP-recommended choice, so bcrypt was installed but is intentionally unused. Can be removed
   from package.json if not needed elsewhere.
4. **Prisma 7 driver adapters**: Prisma 7 (installed via `npx prisma init`, latest at build time)
   removed the old "put a connection URL in schema.prisma and just `new PrismaClient()`" pattern —
   it now requires an explicit driver adapter object. Added `@prisma/adapter-pg` + `pg` and wired
   the adapter into a `PrismaService` built for Nest's DI/lifecycle. This is a real architectural
   requirement of the installed Prisma version, not an optional embellishment.
5. **Prisma Client output location**: initially set a custom `output` path
   (`../generated/prisma`) as scaffolded by `prisma init`; switched to Prisma's default location
   (inside `node_modules/@prisma/client`) after discovering the custom relative-path output broke
   at runtime once NestJS's build compiled `src/` into `dist/src/` (the relative import path no
   longer pointed at the right place). Default location resolves correctly via normal Node module
   resolution regardless of `src` vs `dist`.
6. **Email**: no real SMTP provider credentials exist yet (none were provided, and I have no way to
   generate legitimate ones). Built a real `EmailService` with actual SMTP-sending code
   (`nodemailer`) that activates the moment `SMTP_HOST` etc. are set in the environment; until then
   it logs the real generated email content instead of sending it — the standard pattern most
   frameworks use for local/dev (Django's console backend, Rails' `letter_opener`), not a fake
   stand-in. No TODOs left in the auth flow itself as a result.
7. **Refresh tokens are opaque, not JWTs**: only a SHA-256 hash is stored server-side, each one is
   single-use with rotation (redeeming one immediately revokes it and mints a replacement) — this
   was implied by "Refresh Token rotation" in the brief and is the current best-practice pattern
   (detects token theft: a revoked-and-reused token signals compromise).

## Verified working (manual end-to-end test against the real local Postgres, 2026-07-07)

- Register → creates User + Organization + OWNER Membership + FREE Subscription in one transaction,
  sends (logs) a verification email, returns a valid access+refresh token pair.
- Duplicate registration correctly rejected (409).
- Login with correct password succeeds; wrong password correctly rejected (401).
- `GET /api/auth/me` with a valid access token returns the authenticated user.
- `POST /api/auth/refresh` correctly rotates the refresh token; **reusing an already-rotated
  (old) refresh token is correctly rejected** (401), proving single-use rotation works.
- Forgot-password → reset-password flow: generates a real reset token (logged, since no SMTP
  configured), resetting the password actually changes it (old password stops working
  immediately, new password works), and — per the auth.service implementation — resetting a
  password revokes all existing refresh tokens for that user (logs the user out everywhere).

## Step 6 — Main dashboard (done, 2026-07-07)

Built: `/dashboard`, `/domains`, `/reports`, `/alerts`, `/settings`, `/billing`, plus `/login` and
`/register` (needed before any dashboard route is reachable), an auth-guarded `(dashboard)` layout
with a sidebar, and the requested components (`SecurityScoreCard`, `AssetCard`, `AlertCard`,
`RiskChart`, `Timeline`) in `components/`. Dark, Stripe/Vercel/Linear-inspired styling per the
brief.

**Pulled a thin slice of Step 7 forward**: added a real `OrganizationsController` (`GET
/organizations/me`) and a full `Domains` module (`POST/GET /domains`, `GET /domains/:id`) with
proper per-organization membership authorization checks — this was necessary so the dashboard has
at least one genuinely real, working resource (add/list domains) rather than either faking data or
shipping an empty shell with nothing real behind it. The actual scanning services (dns/ssl/http/
technology detection) that Step 7 calls for are **not** built yet — domains can be added and
listed, but nothing scans them.

**Honesty in empty states**: pages/sections with no real backend yet (Reports, Alerts, Security
Score, Risk Chart) explicitly say so in the UI ("Scanning, risk scoring, and findings are not
wired up yet...") rather than showing plausible-looking fake numbers. Caught and fixed one instance
of this myself before shipping — the dashboard originally showed a hardcoded "0/100, Critical"
security score, which looks like a real computed result even though it wasn't; replaced with an
explicit "no scans have run yet" message.

**Verified end-to-end with a real headless-browser run (Playwright), not just `npm run build`**:
started the actual backend + frontend production servers locally, and drove the real browser
through: register → redirected to `/dashboard` → navigate to `/domains` → add a real domain via
the UI form → confirm it appears on both `/domains` and back on `/dashboard` (including in the
"Recent activity" timeline, sourced from the real `createdAt` timestamp) → checked `/settings`
shows the real authenticated user/org → checked `/billing` shows the real FREE plan and disables
upgrade buttons with an honest tooltip. Zero browser console errors throughout. Screenshots taken
at each step for visual QA.

**Lint**: both `npm run lint` (frontend, backend) pass with zero errors. Fixed for real rather than
suppressed:
- Frontend: a `react-hooks/set-state-in-effect` error in `auth-context.tsx` — refactored the
  fetch-current-user-on-mount effect to the React-docs-recommended cleanup-flag pattern instead of
  calling a setState-triggering callback directly from the effect body.
- Backend: several `@typescript-eslint/no-unsafe-assignment` errors from an `as any` cast used to
  work around `@nestjs/jwt`'s `expiresIn` option typing (`ms`'s `StringValue` template-literal
  union can't statically accept a plain env-var string) — replaced the cast with converting the
  configured duration to a plain number of seconds via the `ms` package at runtime, which is always
  a valid `expiresIn` value with no unsafe cast needed. Also typed `CurrentUser`'s request object
  properly instead of relying on implicit `any`, and fixed a floating-promise warning in
  `main.ts`'s bootstrap call.

## Step 7 — Asset discovery module (done, 2026-07-07)

Built `src/discovery/` with the five services the brief asked for, each doing real work (no
stubs):

- **`dns.service.ts`** — resolves A/AAAA/CNAME/MX/TXT/NS records via Node's built-in
  `dns.promises`, with each record type resolved independently so a domain missing e.g. an MX
  record doesn't fail the whole lookup.
- **`ssl.service.ts`** — opens a raw TLS socket (not an HTTP request) to the target on port 443 to
  read the actual presented certificate: subject/issuer CN, validity window, days-until-expiry,
  SANs, protocol version, fingerprint, and a self-signed heuristic. Uses
  `rejectUnauthorized: false` deliberately, so it can inspect and report on invalid/expired/
  self-signed certs instead of just failing to connect to them.
- **`http.service.ts`** — probes HTTPS first, falls back to HTTP, captures status code, headers,
  final URL after redirects, response time, and a body snippet (capped at 4KB).
- **`technology.service.ts`** — real (if intentionally small, not Wappalyzer-scale) signature
  matching against response headers and body content: web servers (nginx/Apache/IIS), CDN/WAF
  (Cloudflare/Vercel), languages/frameworks (PHP/Express/ASP.NET/Next.js), CMSs (WordPress/Drupal/
  Joomla), JS frameworks (React/Vue/Angular), plus a missing-security-headers check (HSTS/CSP/
  X-Frame-Options/etc.) that Step 10's risk engine will consume directly.
- **`asset.service.ts`** — persists discovery output as `Asset` rows keyed on
  `(domainId, type, value)`: upserts (bumping `lastSeenAt`, merging metadata) rather than
  duplicating on repeat scans, and marks assets not observed in the latest run `inactive` (kept,
  not deleted, so Step 9's monitoring engine can later diff "removed asset" as its own signal).

`discovery.service.ts` orchestrates all four probes in parallel per domain and persists the
results; `discovery.controller.ts` exposes it as `POST /discovery/domains/:domainId/run` and
`GET /discovery/domains/:domainId/assets`, both membership-checked through the existing
`DomainsService`.

**Verified against a real external domain, not a mock** (`example.com`, via the live local
server + real outbound DNS/TLS/HTTP): a single discovery run correctly found 2 A records, 2 AAAA
records, 1 MX record, a valid Cloudflare-issued certificate (53 days to expiry, correct SANs), a
reachable HTTPS endpoint returning 200 with real response headers, `Cloudflare` correctly detected
as the CDN/WAF technology, and all 6 missing-security-headers correctly flagged (example.com's
real response genuinely doesn't set HSTS/CSP/etc.). Re-ran discovery a second time immediately
after: **still exactly 6 assets stored (not 12)** and 0 marked inactive, confirming the upsert/
idempotency logic works rather than duplicating rows on every scan.

Lint and build both clean (`npm run build` / `npm run lint`, 0 errors) after fixing real issues:
installed `axios` in the backend (previously frontend-only), removed an unused speculative `psl`
dependency, normalized `tls`'s `PeerCertificate.subject.CN`/`issuer.CN` (typed as
`string | string[]`) to a single string, round-tripped a metadata object through
`JSON.parse(JSON.stringify(...))` to satisfy Prisma's `InputJsonValue` type honestly (rather than
casting through `any`), and replaced two more unsafe-`any` accesses (a raw Node `ClientRequest`
reach-through in the HTTP service, and an untyped socket `error` event) with properly narrowed
types.

**Not yet built**: this module only runs on-demand via the API — there's no scheduling,
periodic re-scanning, or change-detection/alerting yet. That's Steps 8 (background workers) and 9
(monitoring engine), next.
