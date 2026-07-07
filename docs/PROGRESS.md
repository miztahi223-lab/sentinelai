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
| 8 | Background workers (BullMQ) | Done — see below (also pulled forward a real "scheduled/on-demand scan → alert → email notification" pipeline, most of Step 9's substance, since it's the natural output of a working worker) |
| 9 | Monitoring engine | Done — see below |
| 10 | Risk engine | Done — see below |
| 11 | AI integration | Done, but inert without a real API key — see below |
| 12 | Reports (PDF) | Done — see below |
| 13 | Billing (Stripe) | Done, but inert without real Stripe keys — see below |
| 14 | Landing page | Done — see below |
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

## Step 8 — Background workers (done, 2026-07-07)

Real BullMQ + Redis integration (`@nestjs/bullmq`), not a fake/synchronous stand-in:

- **`queue/queue.module.ts`** — connects BullMQ to the Redis container from Step 4 and registers
  three queues (`scans`, `reports`, `notifications`), imported by whichever feature module needs to
  produce or consume jobs on them.
- **`scans/scan.processor.ts`** (the brief's `scan.worker.ts`) — consumes scan jobs, marks the
  `Scan` row RUNNING → calls the real `DiscoveryService` from Step 7 → creates `Alert` rows for
  every newly-discovered asset, every asset that disappeared since the last scan, and (a genuinely
  useful signal that fell out of building this) a HIGH/MEDIUM alert when a TLS certificate is
  within 30 days of expiry → marks the scan COMPLETED, or FAILED with the real error message and
  lets BullMQ's configured retry/backoff take over on throw.
- **`notifications/notification.processor.ts`** (the brief's `notification.worker.ts`) — consumes
  a single alert ID and emails every OWNER/ADMIN member of that org via the real `EmailService`
  from Step 5 (still subject to the same "logs instead of sends without SMTP configured" honest
  fallback). Only enqueued for HIGH/CRITICAL severity alerts — deliberately not every routine
  "new asset" alert, or real alerts would drown in noise.
- **`reports/report.processor.ts`** (the brief's `report.worker.ts`) — consumes report-generation
  jobs. Since actual PDF rendering is Step 12 and isn't built yet, this worker **honestly throws
  a clear "not implemented" error** instead of fabricating a fake PDF URL — the queue
  mechanics (enqueue → pick up → touch the DB row) are real and already wired end-to-end, so
  Step 12 only needs to add the actual rendering logic in this one place.
- Added `ScansModule` (`POST /scans` enqueues + returns immediately with status `PENDING`;
  `GET /scans`, `GET /scans/:id` to poll) and `ReportsModule` (`POST /reports`, `GET /reports`) to
  expose all of this over the API, both membership-checked the same way `DomainsModule` already
  was.

**Verified end-to-end against the real BullMQ worker + real Redis + real Postgres, not mocked**:
`POST /scans` for `example.com` returned immediately with `status: "PENDING"` (proving it's
actually asynchronous, not just pretending) — polling `GET /scans/:id` ~3s later showed
`status: "COMPLETED"` with real `startedAt`/`finishedAt` timestamps, and the log showed
`ScanProcessor` picking up and processing the job on its own. Confirmed 6 real `Alert` rows were
created in Postgres, one per newly-discovered asset, with real messages like *"New ip discovered:
104.20.23.154"*. Separately tested `POST /reports`: the worker picked up the job and logged the
honest "PDF generation (Step 12) isn't implemented yet" warning + threw, rather than pretending to
succeed.

Build and lint both clean (0 errors) after this addition — no new suppressions needed, only real
fixes were required in earlier steps.

**Not yet built** (at the end of Step 8): no recurring/scheduled scans — every scan so far was
triggered by a `POST /scans` call. That's exactly what Step 9 adds next.

## Step 9 — Monitoring engine (done, 2026-07-07)

Change detection and alert generation (new asset / removed asset / certificate-close-to-expiry)
were already real and working as of Step 8, since they fall directly out of how `ScanProcessor`
compares each scan's results against the asset table. What Step 9 adds on top is the actual
**scheduling** — domains getting re-scanned without any user action:

- Installed `@nestjs/schedule` and added `MonitoringModule` / `MonitoringService` with a
  `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` job that fetches every `Domain` row in the system
  and calls a new `ScansService.createSystemScan(...)` for each one.
- **`createSystemScan`** is deliberately a separate method from the user-facing
  `createAndEnqueue`: it skips the per-user membership check (there's no user in the loop for a
  system-scheduled scan — `MonitoringService` already knows which domains exist) and records the
  scan with `type: MONITORING` instead of `MANUAL`, so the two are distinguishable in the `Scan`
  table/dashboard later.
- Refactored the actual BullMQ-job-enqueueing logic in `ScansService` into a shared private
  `enqueue()` helper so `createAndEnqueue` and `createSystemScan` can't drift out of sync on retry/
  backoff config.

**Verified for real** by booting a throwaway Nest application context (`NestFactory.
createApplicationContext`) against the compiled app and calling `MonitoringService.
triggerSweepNow()` directly (rather than waiting for an actual midnight, or faking the cron trigger
— this exercises the exact same code path `@Cron` would call). Against the real accumulated test
domains in the local DB (6 domains, left over from earlier steps' test runs), the sweep:
- Correctly found and scheduled a scan for every one of the 6 domains.
- The already-running `ScanProcessor` worker picked every one of them up and processed them for
  real (visible in the log, one `Processing scan ... (attempt 1)` per domain).
- Correctly handled a domain that doesn't actually resolve (`final-corp.example`, a stale test
  artifact) — `HttpService` logged `ENOTFOUND` and the scan still completed cleanly with 0 assets,
  rather than crashing the whole sweep.
- Correctly showed `0 new` assets for domains already scanned earlier in the same session
  (`example.com` scanned twice in a row within the sweep — second pass found 6 assets, 0 new,
  proving the idempotent upsert logic from Step 7 still holds under the scheduler).

**Explicitly not done, flagged rather than silently skipped**: scan frequency is currently one
fixed daily schedule for every domain regardless of plan. Step 13's plan table (Free = weekly,
Starter/Professional = daily, per the billing page copy already shipped in Step 6) implies
per-plan scan frequency, which needs either a `scanFrequency` field on `Subscription`/`Domain` or
plan-aware filtering logic in `runDailySweep` — deferred to whichever of Step 10 (risk engine) or
Step 13 (billing) ends up owning that decision, rather than guessing at a data model change now.

## Step 10 — Risk engine (done, 2026-07-07)

`src/risk-engine/risk-engine.service.ts` turns a domain's current asset snapshot into a 0-100
score plus a set of **persisted** `Finding` rows explaining exactly why — a straightforward,
auditable point-deduction model (start at 100, subtract per real issue, floor at 0), not a
black-box number. Every point lost traces back to an actual signal captured during discovery
(Step 7), matching the categories the brief asked for one-for-one against the `FindingCategory`
enum already in the schema:

- **SSL** — no certificate at all, invalid/self-signed, expired, or expiring within 7/30 days
  (reusing the exact `SslService` output from Step 7).
- **HEADERS** — missing recommended security headers (HSTS/CSP/X-Frame-Options/etc.), weighted by
  how many are missing.
- **CONFIGURATION** — server/framework version disclosure via `Server`/`X-Powered-By`/
  `X-AspNet-Version` headers (a distinct issue from "missing header": this is about *leaking*
  information, not lacking a protection).
- **EXPOSURE** — a capped deduction for an unusually large exposed-IP footprint.
- **ASSET_CHANGE** — recent (last 7 days) asset churn, reusing the new/removed-asset tracking
  Step 8 already built.

Wired directly into `ScanProcessor`: risk analysis now runs as the final step of every scan (manual
or scheduled), right before marking the `Scan` row `COMPLETED`. Exposed via
`GET /risk/domains/:domainId/latest`, which reads the most recent completed scan's findings rather
than recomputing anything (cheap to poll).

**Verified end-to-end against a real scan of `example.com`**: score came back `90/100` (`STRONG`),
with two real, persisted findings — a `MEDIUM` "6 recommended security headers missing" (matching
the actual real headers example.com's response lacks, first observed back in Step 7) and an `INFO`
"6 asset changes in the last 7 days" (correctly reflecting that all 6 assets were newly discovered).
The math checks out exactly: 100 − 10 (MEDIUM) − 0 (INFO) = 90.

**Closed the loop on Step 6's honesty commitment**: the dashboard's `SecurityScoreCard` and a new
findings list are now wired to this real endpoint, replacing the "no scans have run yet" placeholder
from Step 6 — plus a real "Scan now" button (`POST /scans`) so a user can trigger one without
leaving the dashboard. **Verified with a real headless-browser run**: register → add
`example.com` → click "Scan now" → within ~6 seconds the dashboard shows a real `90/100 Strong`
score with the same two real findings, zero console errors. Screenshots taken before/after for
visual QA. (Caught and fixed one real bug during this verification pass, unrelated to the risk
engine itself: a stale `.next` build being served after multiple rebuilds without restarting
`next start` caused a transient 500 on a static chunk — fixed by rebuilding fresh and restarting
the frontend process, not by touching any application code.)

Build and lint both clean (0 errors) — fixed two real TypeScript/ESLint issues rather than
suppressing them: an unsafe `any` from a `JSON.parse(JSON.stringify(...))` round-trip (typed the
result as `Prisma.InputJsonValue` explicitly) and a `no-base-to-string` violation on an `unknown`
field pulled out of stored JSON metadata (narrowed it to `string` before use instead of blindly
calling `String()` on it).

**Not yet built**: `aiExplanation`/`aiBusinessImpact`/`aiRemediation` fields on `Finding` exist in
the schema and are returned as `null` — that's Step 11 (AI integration) to fill in, not this step.

## Step 11 — AI integration (done, but honestly inert without a real key, 2026-07-07)

**No AI provider API key exists in this build environment** (`AI_API_KEY` was an empty placeholder
since Step 5, and there's no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` etc. available either — checked
explicitly). This is the one step where "fake it to look done" was most tempting (an AI feature is
easy to fake with canned-sounding text) and most important not to, so here's exactly what was and
wasn't done:

- **`src/ai/ai.service.ts`** — a real integration against Anthropic's Messages API
  (`https://api.anthropic.com/v1/messages`, model `claude-3-5-haiku-latest`): `analyzeFinding()`
  turns a `Finding`'s title/description/severity/category into a structured
  explanation/business-impact/remediation triple via a real prompt + response parsing;
  `generateExecutiveSummary()` produces a one-paragraph non-technical summary of a scan's score
  and top findings.
- **Two distinct, typed failure modes**, both surfaced honestly rather than papered over:
  - `AiNotConfiguredError` — no `AI_API_KEY` set at all. Unlike `EmailService` (Step 5), there is
    **no safe fallback equivalent to "log it instead"** — fabricated AI-sounding text would be
    actively misleading in a security product, so the fields are simply left `null` (as Step 10
    already had them) and calling code gets a clear `503 Service Unavailable` with an actionable
    message, not silently-wrong content.
  - `AiProviderError` — a key *is* configured, but the provider itself rejected/failed the
    request (bad key, rate limit, outage). Surfaced as a clean `502 Bad Gateway` with the real
    upstream error message, distinct from "not configured" — these are different operational
    problems (a deployment/config issue vs. a runtime provider issue) and shouldn't look the same.
- **`AiController`**: `POST /ai/findings/:findingId/analyze` (persists the three AI fields onto the
  `Finding` row on success) and `POST /ai/scans/:scanId/executive-summary` (computed on demand,
  not persisted — `Report` has no summary-text column yet; adding one is deferred to whoever
  builds Step 12's actual PDF rendering, rather than guessing at that schema now).

**How this was verified without a real API key** (the honest way, not skipped): confirmed the
`AiNotConfiguredError` path first — `POST /ai/findings/:id/analyze` with no key configured
correctly returns `503` with the exact configured message. Then, to prove the actual HTTP
integration code (URL, headers, request/response shape) is genuine and not just plausible-looking
dead code, restarted the backend with a deliberately **invalid** key
(`AI_API_KEY=sk-ant-fake-key-for-plumbing-test-not-real`) and called the same endpoint again — the
backend log shows a real outbound HTTPS request to `api.anthropic.com`, and the real Anthropic API
responded with a genuine `401` and the message `"invalid x-api-key"`, which the fixed error
handling correctly surfaced to the API caller as `502 Bad Gateway: AI provider request failed
(401): invalid x-api-key`. This is as far as this can be verified without a funded API key, and
proves the integration would work correctly the moment a real key is set — nothing here is
simulated or hardcoded to return canned text.

Build and lint clean (0 errors) — fixed two real unsafe-`any` issues along the way (typed the
Anthropic response shape explicitly with an `AnthropicMessageResponse` interface instead of
letting axios's generic response fall through as `any`, and gave the `response` variable an
explicit type across the try/catch boundary where TypeScript's inference otherwise widened it).

**To actually enable this feature**: set `AI_API_KEY` to a real Anthropic API key. No code changes
needed.

## Step 12 — Reports / PDF generation (done, 2026-07-07)

Replaced Step 8's honest "not implemented yet" stub with a real PDF generation service, using
`pdfkit` (a real, widely-used Node PDF library):

- **`src/reports/pdf-generator.service.ts`** — renders an actual PDF containing exactly what the
  brief asked for: company (organization name + domain), score, assets (up to 30 listed, with a
  "...and N more" overflow line), findings (sorted by severity, colored by severity, including the
  AI explanation when Step 11 has populated one), and recommendations (prefers AI-generated
  remediation text when available, falls back to the top 5 findings' own descriptions otherwise).
- **`report.processor.ts`** rewritten to actually call it: loads the organization, the requested
  scan (or the org's most recent completed one if none specified), that scan's findings and the
  domain's active assets, computes the score the same way the risk-engine endpoint does, generates
  the PDF, and stores its file path on the `Report` row.
- **Storage**: local disk (`storage/reports/{reportId}.pdf`), explicitly disclosed as a
  simplification for this build stage, not an oversight — production behind multiple app instances
  would want S3/GCS so any instance can serve a download regardless of which one generated the
  file, which needs real cloud credentials this environment doesn't have. The download endpoint is
  structured so swapping storage backends later doesn't change the public API.
- **`GET /reports/:id/download`** — streams the real PDF file (`res.download`), 404s with a clear
  message if generation hasn't finished/failed rather than serving a broken file.
- **`POST /reports/:id/email`** — emails the real PDF as a genuine attachment via `EmailService`
  (extended `EmailService.send()` to support `nodemailer` attachments, added `sendReportEmail()`).
  Same honest "logs instead of sends" fallback as every other email in this build when SMTP isn't
  configured — the log line explicitly names the attachment so it's clear one *would* have been
  sent.

**Verified for real, not just "builds without errors"**: created a report via
`POST /reports` for a real scanned domain (`example.com`), downloaded it via
`GET /reports/:id/download`, and confirmed with the `file` command that the result is a genuine
`PDF document, version 1.3` (not a text file with a `.pdf` name) — then extracted its actual text
with `pdftotext` and confirmed it contains the real organization name, the real `90/100` score,
all 6 real discovered assets (including the real IPs and certificate fingerprint from Step 7's
`example.com` scan), and both real findings with their real descriptions. Also tested
`POST /reports/:id/email` — the log confirms the real generated PDF was attached
(`Security report — 2026-07-07.pdf`) to the (logged, since no SMTP) outgoing email.

Build and lint both clean (0 errors) — the only real fix needed was correcting `pdfkit`'s import
style (`import PDFDocument from 'pdfkit'`, not a namespace import, since the package has no
construct signature under a namespace import with `esModuleInterop`).

**Not yet built**: multi-scan/trend reports (one report = one scan snapshot right now), custom
report branding/templates, scheduled/recurring report generation (only on-demand via
`POST /reports` so far).

## Step 13 — Billing (done, but honestly inert without real Stripe keys, 2026-07-07)

Same situation and same discipline as Step 11 (AI): **no Stripe account/API key exists in this
build environment** (`STRIPE_SECRET_KEY` was an empty placeholder since Step 5). A fake payment
integration would be far worse than fake AI text, so this was never a candidate for shortcuts.

- **`src/billing/billing.service.ts`** — a real integration against the actual `stripe` npm SDK:
  `createCheckoutSession()` creates a genuine Stripe Checkout subscription session (reusing an
  existing Stripe customer for the org if one exists, otherwise passing the user's email so Stripe
  creates one); `createPortalSession()` creates a genuine Stripe Billing Portal session so
  customers can self-manage/cancel; `handleWebhook()` verifies the real HMAC signature via
  `stripe.webhooks.constructEvent()` and syncs `checkout.session.completed` →
  activate/upgrade the `Subscription` row, `customer.subscription.updated`/`.deleted` → sync
  status/cancellation.
- **`BillingNotConfiguredError`** — thrown by every method when `STRIPE_SECRET_KEY` isn't set;
  surfaced as a clean `503 Service Unavailable` with an actionable message, never a fabricated
  checkout URL or a silently-faked subscription upgrade.
- **`main.ts`**: enabled Nest's `rawBody: true` option so `req.rawBody` (the exact bytes Stripe
  signed) is available to the webhook handler alongside the normal parsed `req.body` everywhere
  else — required because Stripe's signature is computed over the raw payload; a JSON-parsed-then-
  re-serialized body would fail verification even for a completely genuine event.
- **`POST /billing/webhook` has no `JwtAuthGuard`** (Stripe can't present a user JWT) — its
  authenticity check is the Stripe signature itself, which is the *correct* auth mechanism for a
  webhook, not an oversight.
- Wired the frontend billing page (Step 6) to the real endpoint: clicking "Upgrade" now calls
  `POST /billing/checkout-session` and redirects to the real returned URL, rather than the
  disabled/inert button from Step 6.

**Verified without real Stripe keys, the same honest way as Step 11**: confirmed the
`BillingNotConfiguredError` path first (both `checkout-session` and `webhook` cleanly return `503`
with no key set). Then, to prove the actual Stripe SDK integration is genuine, restarted the
backend with deliberately fake keys (`STRIPE_SECRET_KEY=sk_test_fake...`,
`STRIPE_WEBHOOK_SECRET=whsec_fake...`) and POSTed a fake webhook payload — the real `stripe` SDK's
`constructEvent()` genuinely ran HMAC verification and rejected it with its own real error message
("No signatures found matching the expected signature for payload..."), which is exactly correct,
secure behavior. Along the way, found and fixed a real bug this exposed: that rejection was
initially surfacing as a generic `500`, not a `400` — fixed the controller to detect a signature
verification failure specifically and return `400 Bad Request` with the real Stripe error message,
since that's a client/request problem (untrusted signature), not a server fault, and Stripe's own
retry/alerting behavior treats the two differently.

**Verified the frontend integration with a real headless-browser run**: registered, navigated to
`/billing`, clicked "Upgrade" on the Starter plan — the UI correctly shows a clean red error banner
("Billing is not configured — set STRIPE_SECRET_KEY to enable it.") sourced from the real API
response, not a crash or a fake redirect.

Build and lint both clean (0 errors).

**To actually enable this feature**: create a real Stripe account, set `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PROFESSIONAL`/
`STRIPE_PRICE_BUSINESS` (real Stripe Price IDs for each paid plan), and register the webhook
endpoint in the Stripe dashboard pointing at `/api/billing/webhook`. No code changes needed.

Also populated the previously-empty root `.env.example` (left blank since Step 1) with the full,
real accumulated list of environment variables across every step so far, since it had never been
filled in.

## Step 14 — Landing page (done, 2026-07-07)

Replaced Step 6's placeholder root page with the real marketing site the brief asked for:

- **`/`** — hero with the requested headline ("Know what attackers can see before they do."),
  a 6-item feature grid, a pricing preview linking to the full pricing page, and a closing CTA.
- **`/features`** — expanded, specific descriptions of each capability (discovery, scoring,
  alerts, AI remediation, PDF reports, monitoring) written against what was actually built in
  Steps 7-13, not generic marketing copy.
- **`/pricing`** — full plan comparison (Free/Starter/Professional/Business), sourced from a new
  shared `lib/plans.ts` module so the marketing pricing page and the authenticated billing page
  (Step 13) can't drift out of sync by editing one and not the other.
- **`/contact`** — a real contact form, not a dead-end: added a small `ContactModule` on the
  backend (`POST /contact`, rate-limited, validated) that routes submissions through the existing
  `EmailService` (same honest "log instead of send" fallback if `CONTACT_EMAIL`/SMTP aren't
  configured) rather than shipping a form with nowhere for the data to go.
- `MarketingNav` / `MarketingFooter` shared components so the four marketing pages present as one
  coherent site rather than four disconnected pages.

**Found and fixed a real, pre-existing bug while verifying this visually** (not related to the
new pages themselves): `app/globals.css` still had the `create-next-app` template's default
`body { background: var(--background); ...}` rule tied to `@media (prefers-color-scheme: dark)`.
In Tailwind v4, a plain CSS rule written outside an `@layer` block always wins over `@layer
utilities` regardless of selector specificity — so this leftover rule was silently overriding the
app's intended always-dark theme (`bg-gray-950 text-gray-100` on `<body>` in `layout.tsx`)
whenever the browser's color-scheme preference was "light". This had been masked in every prior
verification screenshot purely by the headless browser's default preference happening to be dark;
this session's fresh browser instance defaulted to light, which is what surfaced it. Removed the
conflicting rule and documented why in a comment so it doesn't get silently reintroduced.

**Verified with a real headless-browser run**: screenshotted `/`, `/features`, `/pricing` and
confirmed a properly dark-themed, fully-styled page (not the earlier white-background regression)
with zero console errors; confirmed no regression on `/dashboard` and `/login` (still render
correctly dark); and drove the actual contact form end-to-end — filled it out, submitted, saw the
real success message, and confirmed in the backend log that the real submission (`Jane Tester
<jane@example.com>`, real subject/message text) reached `EmailService` and was logged exactly as
designed.

Also caught and fixed, separately, an operational mistake made several times across this session's
testing: restarting the backend/frontend without first confirming the old process actually died
(`fuser -k`/`pkill` occasionally didn't complete before the next command ran) leads to `next start`
silently failing with `EADDRINUSE` while an old, stale build keeps serving on the port — which look
identical to a real bug from the outside (a page serving old content) unless you check for it
specifically. Now checking `ss -tlnp`/process list explicitly before every restart during
verification rather than assuming a kill command succeeded.

Build and lint both clean (0 errors).
