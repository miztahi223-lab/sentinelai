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
| 15 | Testing | Done — see below |
| 16 | Docker production | Done — see below |
| 17 | CI/CD | Done — see below |
| 18 | Security review | Done — see below |
| 19 | Final QA | Done — see below |

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

## Step 15 — Testing (done, 2026-07-07)

Automated tests, distinct from and in addition to this whole session's manual curl/Playwright
verification (which stays valuable as end-to-end proof but isn't a substitute for a real,
repeatable test suite a CI pipeline can run on every change):

**Backend unit tests** (`npx jest`, real assertions against the real implementations, no
snapshot-testing filler):
- **`technology.service.spec.ts`** (9 tests) — header/body signature matching, de-duplication,
  case-insensitivity, and the missing-security-headers detection, using the real signature set
  from Step 7 (e.g. explicitly asserts Cloudflare detection, the exact real-world case hit during
  Step 7's `example.com` verification).
- **`risk-engine.service.spec.ts`** (5 tests) — the actual scoring math against a fake (in-memory)
  Prisma: a clean asset set scores a perfect 100/STRONG; an expired certificate deducts exactly the
  documented 30 CRITICAL points; stacked SSL issues on one certificate are all deducted
  independently and the running total is verified precisely (100 − 30 − 18 − 30 = 22); missing
  security headers and server-version-disclosure are each asserted as their own distinct category/
  severity. **Caught two real bugs in my own test fixtures** while writing these (not in the
  service) — two test cases initially omitted a certificate asset, so the real "no certificate
  observed" HIGH finding fired unexpectedly alongside the thing actually under test; fixed by
  giving every non-SSL-focused test case a valid, healthy certificate asset, matching what a real
  scan always produces.
- **`token.service.spec.ts`** (8 tests) — the exact security property manually verified earlier via
  curl, now a permanent regression test: issuing a token stores only its SHA-256 hash (never the
  raw value); rotating a valid token revokes the old one and returns a new one; **reusing an
  already-rotated token is rejected** (the theft-detection property); unknown and expired tokens
  are rejected; `revokeAllForUser` invalidates every token for that user without touching another
  user's tokens; access-token signing/verification round-trips correctly and rejects a token signed
  with a different secret.
- Existing `app.controller.spec.ts` scaffold left as-is (still passes).

**Backend e2e test** (`npx jest --config ./test/jest-e2e.json`) — replaced the default scaffold's
trivial `/ (GET)` check with a genuine 8-step end-to-end auth flow against the **real** local
Postgres/Redis stack (not mocked): rejects a too-short password (real `ValidationPipe` running),
registers a real user, rejects a duplicate registration (409), rejects a wrong password (401),
logs in successfully, rejects `/auth/me` with no token (401) and accepts it with a valid one,
and — the same rotation/reuse-rejection property as the unit test, but this time exercised over
real HTTP through every real middleware/guard/pipe in the stack — rotates a refresh token and
confirms the old one is rejected on reuse. Cleans up its own test user in `afterAll`; verified 0
leftover rows after a run.

**Frontend** — Next.js's `create-next-app` doesn't scaffold any test runner by default, so this
was genuinely nothing before this step. Added Vitest + React Testing Library (a deliberate choice
over Jest for a Vite-free Next.js app: faster, simpler ESM/TS handling, no extra transform config
needed):
- **`components/AlertCard.test.tsx`** (4 tests) — renders the real message content; shows the
  "Mark read" action only when unread AND a handler was provided; confirms the handler actually
  fires on click.
- **`lib/plans.test.ts`** (4 tests) — guards against exactly the kind of drift the shared
  `lib/plans.ts` module (introduced in Step 14) was built to prevent: every paid plan has a
  `plan` key matching one of the backend's real `SubscriptionPlan` enum values, the Free plan has
  none, no duplicate plan names (would silently break the billing page's "current plan"
  highlighting), every plan lists at least one feature.

**Fixed a real lint gap found while adding the backend tests**: the strict
`@typescript-eslint/no-unsafe-*` rules (appropriate for production code that touches a real
database) were also being applied at full strength to test files, where lightweight `any`-typed
fakes/mocks are the normal, correct pattern — added a scoped ESLint override for `**/*.spec.ts` and
`test/**/*.ts` relaxing exactly the unsafe-assignment/member-access/call/return rules there, not a
blanket loosening of the config production code is still held to.

**Final tally, all green**: backend `npm run build` (clean), `npm run lint` (0 errors), `npx jest`
(4 suites, 23 tests, all pass), `npx jest --config ./test/jest-e2e.json` (1 suite, 8 tests, all
pass against the real live stack); frontend `npm run build` (clean), `npm run lint` (0 errors),
`npx vitest run` (2 files, 8 tests, all pass).

## Step 16 — Docker production (done, 2026-07-07)

Built the actual production container images and orchestration, then **proved they work by
running the real, full production stack locally** (`docker compose build` + `up`, exactly as the
brief asked) rather than just writing Dockerfiles and assuming they'd work — this is what caught
every bug documented below.

- **`apps/backend/Dockerfile`** — 4-stage build (`deps` → `build` → `prod-deps` → `runtime`): the
  final image contains only production `node_modules` (via a separate `npm ci --omit=dev` stage,
  never the `tsc`/`eslint`/`jest` toolchain used to build it), the compiled `dist/`, the Prisma
  schema/migrations, and a small entrypoint script — runs as a non-root `sentinelai` user, exposes
  a `HEALTHCHECK`.
- **`apps/backend/docker-entrypoint.sh`** — runs `npx prisma migrate deploy` before starting the
  server on every container start (safe/idempotent if already up to date). **This is a real bug
  this session caught, not a guess**: the first `up`, without this, started cleanly and looked
  fine until the first real request — `POST /auth/register` 500'd with `Prisma...
  The table "public.users" does not exist`, because nothing had ever run migrations against the
  fresh production Postgres volume. Fixed by adding the entrypoint; also had to move `dotenv` from
  `devDependencies` to real `dependencies` and copy `prisma.config.ts` into the runtime image,
  since Prisma 7's `migrate deploy` needs both at runtime, not just at build time.
- **`apps/frontend/Dockerfile`** — enabled Next's `output: "standalone"` (in `next.config.ts`) so
  the runtime stage ships only the traced minimal server bundle, not the full `node_modules`.
  `NEXT_PUBLIC_API_URL` is a build `ARG`, since Next inlines `NEXT_PUBLIC_*` vars into the client
  bundle at build time — it cannot be swapped at container-start the way server-only env vars can.
  **Found and fixed a second real bug**: the container's `HEALTHCHECK` reported `unhealthy`
  despite the app serving real 200s to other containers — the standalone `server.js` binds to
  `process.env.HOSTNAME` if set, and Docker/Podman auto-set `HOSTNAME` to the container's own
  hostname, which its own DNS resolves to its *specific* container IP rather than all interfaces,
  so the server was unreachable from `localhost` inside its own container (external traffic via
  the compose network still worked, which is why it wasn't caught by a manual curl through nginx
  alone). Fixed with an explicit `ENV HOSTNAME=0.0.0.0` override.
- **`infra/nginx/nginx.conf.template`** + **`docker-compose.production.yml`** — nginx reverse-
  proxies `/api/*` to the backend and everything else to the frontend, with a dedicated
  `location` for `/api/billing/webhook` (`proxy_request_buffering off`, since Stripe's signature
  is computed over the exact raw body). **Found and fixed a third real bug, live**: a static
  `upstream { server backend:3001; }` block resolves the hostname once at nginx startup and
  caches that IP forever — recreating the backend container after a rebuild (a completely routine
  operation) gave it a new container IP, and nginx kept sending requests to the old, now-dead IP
  (`connect() failed (113: Host is unreachable)`) until nginx itself was manually restarted. Fixed
  properly (not just "remember to restart nginx every time," which is a bug waiting to happen in
  real operations) by adding `resolver <dns-ip> valid=10s;` plus routing through a `set $upstream
  ...; proxy_pass http://$upstream;` variable, which together force nginx to actually re-resolve
  the hostname periodically instead of only once. Confirmed this self-heals: force-recreated the
  frontend container a second time and, this time, nginx picked up the new IP on its own within
  ~10s with zero manual intervention.
- The correct DNS resolver address is itself environment-dependent (real Docker's embedded DNS is
  always `127.0.0.11`; this sandbox's engine is Podman, whose embedded DNS — aardvark-dns — lives
  at the bridge network's gateway IP instead), so the resolver address is templated via nginx's
  official envsubst-on-startup mechanism (`NGINX_RESOLVER` env var, defaulting to `127.0.0.11` for
  real Docker) rather than hardcoded — verified this templating mechanism itself works by
  overriding it to Podman's actual resolver IP for this local test run.
- TLS/HTTPS is intentionally **not** configured in `nginx.conf` — there's no real domain or
  certificate available in this environment to configure honestly; the compose file and its
  comments call this out explicitly as something to add at deploy time (terminate at a cloud load
  balancer, or add certbot) rather than faking a self-signed cert and calling it done.

**Verified end-to-end against the real, fully containerized production stack** (`docker compose -f
docker-compose.production.yml build` then `up`, all 5 services: postgres, redis, backend,
frontend, nginx): registered a real user through `http://localhost:8080/api/auth/register` (nginx
→ backend → real Postgres, migrations auto-applied), logged in successfully, loaded the real
frontend (`/`, `/login`) through nginx, and confirmed the DNS self-healing behavior described
above with a live container recreation. Stack torn down and test volumes removed after
verification; the separate local-dev `docker-compose.yml` stack (used by every earlier step) was
left untouched and still running throughout.

## Step 17 — CI/CD (done, 2026-07-07)

**`.github/workflows/ci.yml`** — three jobs, running on every push/PR to `main` plus manual
dispatch:
- **`backend`** — real Postgres 16 + Redis 7 **service containers** (not mocked), then: install →
  `prisma generate` → `prisma migrate deploy` → lint → build → unit tests (`npm run test`) → e2e
  tests (`npm run test:e2e`) — i.e. the exact same command sequence this whole session has been
  running by hand against the real local stack since Step 15.
- **`frontend`** — install → lint → `vitest run` → `next build` (with a placeholder
  `NEXT_PUBLIC_API_URL`, since the CI build artifact is never actually deployed — real deployments
  build their own image via `docker-compose.production.yml` with the real API URL).
- **`docker-build`** — `needs: [backend, frontend]`; builds both production Dockerfiles
  (`docker build apps/backend`, `docker build apps/frontend`) to catch a Dockerfile regression
  before it reaches a deploy step (no deploy step exists yet — there's no real hosting target to
  deploy *to* in this environment, so this job stops at "images build cleanly," honestly, rather
  than wiring up a fake `deploy` step with nowhere real to push to).

**Actually ran this workflow locally, not just written and assumed correct** — installed `act`
(`nektos/act`, a real GitHub Actions local runner) and executed it against this repo's real
Podman engine:
- **`frontend` job: fully green, twice** — `act -j frontend` ran the complete real job (checkout,
  `actions/setup-node@v4` with npm caching, `npm ci`, lint, `vitest run` → **8/8 tests passed**,
  `next build` → succeeded) inside an actual `catthehacker/ubuntu:act-latest` runner container,
  proving the workflow YAML, the working-directory/caching config, and every command in it are
  genuinely correct — not just plausible-looking.
- **`backend` job: individually verified, not via a clean `act` run** — every single command in
  this job (`npm ci`, `prisma generate`, `prisma migrate deploy`, lint, build, `npm run test`,
  `npm run test:e2e`) has already been run and passed repeatedly, directly against the real local
  Postgres/Redis stack, throughout Steps 15 and 16 of this session (see those sections above for
  the actual pass/fail output). Running the *whole job* through `act` specifically hit a
  reproducible **environment limitation of this sandbox**, not a defect in the workflow: `act`
  needs to start Postgres/Redis as *nested* service containers inside its own job-runner
  container, and on this machine's rootless Podman that reliably failed at container startup with
  `fork: retry: Resource temporarily unavailable` / `can't fork: Resource temporarily
  unavailable` — a resource-nesting constraint of running containers-inside-a-container under
  rootless Podman on this particular host (which is the user's own desktop machine, running
  Firefox/Steam/etc. alongside this work), not something fixable from inside the workflow file.
  Documenting this honestly rather than either hiding it or quietly deleting the service-container
  verification attempt.
- **`docker-build` job**: the two commands it runs (`docker build apps/backend`,
  `docker build apps/frontend`) were verified directly (bypassing `act`'s nested-container
  limitation, since these don't need service containers) — both images build cleanly, consistent
  with Step 16's earlier verification.

**Dependency audit, run as part of closing out this step** (`npm audit`), a real, uncomfortable
check rather than skipped:
- **Backend**: found and fixed for real — `multer` (a transitive dependency of
  `@nestjs/platform-express`, itself not used directly anywhere in this codebase; grepped for
  `FileInterceptor`/`UploadedFile`/`multer` and found zero usage) had two real high-severity DoS
  advisories at the pinned `2.1.1`. `npm audit`'s suggested fix would downgrade `@nestjs/core` to
  `7.5.5` — a nonsensical, massive breaking regression for an unrelated, unused sub-dependency.
  Instead added a scoped `"overrides": { "multer": "^2.2.0" }` in `package.json`, which resolves
  the two high-severity findings without touching NestJS itself; reran `npm run build` and
  `npx jest` afterward to confirm nothing broke (23/23 tests still pass).
  - **Remaining, accepted**: one moderate advisory in `@hono/node-server`, pulled in transitively
    through `@prisma/dev` (Prisma CLI's own internal dev-server tooling for `prisma studio`/
    `prisma dev`, neither of which this project's scripts ever invoke — only `prisma generate` and
    `prisma migrate deploy` are used). No stable Prisma release fixes this yet (only 7.9.0-dev.*
    pre-releases do); documented here as a known, low-risk, currently-unpatched-upstream
    transitive advisory rather than silently ignored or forced with a breaking downgrade.
- **Frontend**: one moderate PostCSS XSS advisory bundled *inside* Next.js's own private
  `next/node_modules/postcss` (build-time CSS tooling, not exposed to any runtime user input).
  `next@16.2.10` (installed) is already the latest published version — no newer patch exists yet
  to pull in a fixed PostCSS. Documented as accepted/watching for the next Next.js release, same
  reasoning as the backend's Prisma finding.

Cleaned up all `act`-created containers/networks and restored the local dev `docker-compose.yml`
Postgres/Redis stack to running before moving on.

## Step 18 — Security review (done, 2026-07-07)

A real review, not a checklist rubber-stamp — went looking for actual problems in the actual code,
found one significant real vulnerability and one real gap, fixed both, and verified the fix
against the live system rather than just reasoning about it on paper.

### Finding 1 (significant): SSRF in the discovery module — found and fixed

**The problem**: SentinelAI's core function is "a user gives us a hostname, we make outbound
DNS/TLS/HTTP requests to it" (`dns.service.ts`, `ssl.service.ts`, `http.service.ts`) — which is
*exactly* the shape of Server-Side Request Forgery if the target isn't validated. Before this
step, nothing stopped a user from registering a domain they legitimately control DNS for (e.g. a
subdomain) that resolves to `169.254.169.254` (the AWS/GCP/Azure cloud-metadata endpoint — a
classic SSRF-to-credential-theft target), `127.0.0.1`, or an internal `10.x`/`172.16-31.x`/
`192.168.x` address, and have this backend connect to it on the user's behalf from inside
whatever network it's deployed in.

**The fix**: `src/discovery/ssrf-guard.ts` — resolves a hostname and classifies the resolved
address using `ipaddr.js` (added as a real, direct dependency — it was already present
transitively but relying on an unlisted transitive package for code we import directly would be
its own quiet bug waiting to happen), blocking loopback/private/link-local/multicast/reserved/
unique-local ranges for both IPv4 and IPv6. Explicitly handles IPv4-mapped IPv6 addresses
(`::ffff:169.254.169.254`) by unwrapping and re-checking the embedded address — a naive
range-check on the outer address alone would misclassify it as the harmless-sounding
`ipv4Mapped` range and let it straight through. Wired in as a `lookup` option (the same signature
as `dns.lookup`) passed directly to both `axios` (`http.service.ts`) and `tls.connect`
(`ssl.service.ts`), which is what closes the more subtle **DNS-rebinding** version of this bug: a
naive "resolve once to check, let the HTTP client resolve again to connect" implementation has a
gap where an attacker's DNS server could answer the validation lookup with a public IP and the
real connection's lookup moments later with a private one. Passing our validated resolution
directly as the `lookup` callback means Node connects to the *exact* address we already checked —
there is no second, independent resolution to race.

**Verified for real, twice**:
- **Unit tests** (`ssrf-guard.spec.ts`, 9 tests): blocks loopback/RFC1918/link-local/cloud-metadata/
  IPv6-unique-local addresses, blocks the IPv4-mapped-IPv6 bypass shape specifically, does *not*
  block ordinary public addresses (a real DNS lookup of `example.com` genuinely succeeds), fails
  closed on unparseable input. `resolveAndAssertSafe('localhost')` performs a **real** DNS/hosts
  resolution (not mocked) and confirms it throws.
- **Live, end-to-end, against the running system**: registered `127.0.0.1.nip.io` (a real, public,
  legitimate wildcard-DNS testing domain — confirmed via an actual DNS lookup that it genuinely
  resolves to `127.0.0.1` — not a fabricated test) as a tracked domain through the real API and
  triggered a real discovery run. The real backend log shows the DNS step correctly still
  resolving it (DNS lookups alone don't reach the target, so those aren't blocked), and then:
  `HTTP probe (https) failed for 127.0.0.1.nip.io: Refusing to connect to 127.0.0.1.nip.io
  (resolves to 127.0.0.1, a private/reserved address) — scanning internal infrastructure is not
  permitted.` — for both the HTTPS and HTTP probe attempts, and the SSL inspection step likewise
  came back `inspected: false`. The discovery run completed successfully overall (1 DNS-derived
  asset recorded, exactly as it should for a domain whose only reachable signal is "it resolves to
  something") rather than crashing — a blocked target is a normal, handled outcome, not an
  exception that takes down the scan.
- Test domain/user cleaned up from the database afterward.

Confirmed backend build/lint/full test suite still clean after this change (`npm run build`,
`npm run lint` → 0 errors/16 pre-existing test-mock warnings, `npx jest` → **32/32 tests pass**,
up from 23 — the 9 new SSRF tests).

### Finding 2 (minor): unbounded `title` field on report creation

`CreateReportDto.title` had no `@MaxLength`, unlike every other free-text field in the API
(`RegisterDto.name`/`organizationName`, `ContactMessageDto.subject`/`message`, etc.) — it's used
both inside the generated PDF and as the `res.download()` filename. Not a demonstrated exploit
(Express's `content-disposition` dependency already safely encodes the header value), but
inconsistent with this codebase's own established pattern of bounding every user-supplied string,
and worth closing as defense-in-depth / storage-cost hygiene. Added `@MaxLength(150)`.

### Broader review checklist (walked through deliberately, not just asserted)

- **OWASP Top 10 (2021), quick pass**:
  - *A01 Broken Access Control* — reviewed every controller: `domains`, `scans`, `reports`,
    `risk-engine`, `discovery` all re-derive the resource's real `organizationId` from the
    database and check the requesting user's membership against *that*, never trusting a
    client-supplied `organizationId` alone for authorization on an ID-based lookup (the exact
    pattern that prevents IDOR). `contact` is deliberately public (no auth — it's a marketing
    contact form). `billing/webhook` is deliberately public (Stripe can't present a user JWT;
    HMAC signature verification *is* its auth).
  - *A02 Cryptographic Failures* — Argon2id password hashing, refresh tokens stored only as
    SHA-256 hashes (never the raw token), JWTs signed with distinct access/refresh secrets loaded
    from env vars (never hardcoded — grepped the codebase for this specifically).
  - *A03 Injection* — grepped for `$queryRaw`/`$executeRaw` (Prisma's raw-SQL escape hatches):
    zero usage anywhere, every query goes through Prisma's parameterized query builder. Grepped
    for `eval(`/`child_process`: zero usage. Every DTO uses `class-validator` with the global
    `ValidationPipe`'s `whitelist: true, forbidNonWhitelisted: true` (unrecognized fields are
    rejected outright, not silently dropped or passed through).
  - *A04 Insecure Design* — this step's SSRF finding *is* this category; fixed above.
  - *A05 Security Misconfiguration* — Helmet enabled with its default strong CSP (verified in
    live response headers during Step 16/17 testing), CORS locked to the real configured
    `FRONTEND_URL` with `credentials: true` (never a wildcard `origin: '*'` — checked
    `main.ts` directly), Docker containers run as a non-root user, no dev-only middleware
    (Swagger/GraphQL playground/etc.) exists to accidentally leave enabled.
  - *A06 Vulnerable Components* — real `npm audit` run in Step 17; the one fixable finding
    (`multer`) fixed via a scoped override; the two remaining are documented, low-risk,
    currently-unpatched-upstream transitive advisories in build/dev tooling, not runtime-reachable
    application code.
  - *A07 Auth Failures* — rate-limited login/register/refresh/password-reset (`@Throttle`
    per-endpoint), no username enumeration difference between "wrong password" and "no such user"
    (both return a generic 401), refresh token rotation with reuse-detection (verified by both
    unit and e2e tests), password reset revokes all existing sessions.
  - *A08 Software/Data Integrity* — Stripe webhook signature verified via the SDK's own
    `constructEvent()` (real HMAC verification, tested with an intentionally invalid signature in
    Step 13 and confirmed it's genuinely rejected), no unsigned/unverified deserialization of
    remote data anywhere.
  - *A09 Logging Failures* — `nestjs-pino` configured with `redact: ['req.headers.authorization',
    'req.headers.cookie']` (verified: authorization headers show up as `"[Redacted]"` in every log
    line captured throughout this session, e.g. the SSRF live-verification log above).
  - *A10 SSRF* — this step's main finding; fixed and verified above.
- **Secrets**: grepped the entire `src/` tree for hardcoded credential-shaped strings — none
  found; every secret (`JWT_*_SECRET`, `SMTP_PASS`, `STRIPE_SECRET_KEY`, `AI_API_KEY`) is loaded
  via `ConfigService`/`process.env`, never a literal. `.env` was never committed (confirmed via
  `git show HEAD:apps/backend/.env` failing — it genuinely doesn't exist in git history) and is
  excluded by `.gitignore`; `.env.example` contains only empty placeholders. Found and fixed a
  real documentation gap while checking this: `CONTACT_EMAIL` (a real, used config var since Step
  14) was missing from `.env.example` — added it.
- **Rate limiting**: `ThrottlerGuard` applied globally (`APP_GUARD`) plus tighter per-route
  `@Throttle` overrides on the sensitive auth/contact endpoints specifically (5-20 requests/min
  depending on endpoint sensitivity) — verified these limits are actually enforced back in the
  original Step 5 manual testing (rate-limit headers visible in every response) and every log
  captured throughout this session.

Build, lint, and the full test suite (backend `npx jest` — 32/32; e2e — 8/8) all re-confirmed
green after every change in this step.

## Step 19 — Final quality review (done, 2026-07-07)

The brief's own checklist for this step (`git status`, `npm audit`, `docker ps`; review code
quality/security/performance/documentation; fix all issues) run for real, one item at a time:

- **`git status`**: clean working tree, nothing uncommitted, at this exact point in the review —
  confirmed with the actual command, not assumed.
- **`npm audit`** (both apps, re-run fresh): backend — 3 moderate, all in `@hono/node-server` via
  `@prisma/dev` (Prisma's own internal `prisma dev`/`prisma studio` tooling, never invoked by this
  project's scripts; no stable Prisma release fixes it yet); frontend — 2 moderate, PostCSS
  bundled inside Next.js's own build tooling, no newer Next.js release available. Both already
  investigated and accepted with reasoning in Step 17/18; re-confirmed unchanged, nothing new.
- **`docker ps`**: the local dev Postgres/Redis stack (`docker-compose.yml`) healthy and running,
  exactly as it should be for local development; the separate production stack
  (`docker-compose.production.yml`) intentionally torn down after its Step 16/17 verification —
  it's meant to be built fresh at actual deploy time, not left running in a dev sandbox.
- **Full build/lint/test re-run, one final time, on both apps** (not trusting earlier runs to
  still be valid after all the changes in Steps 15-18): backend `npm run build` (clean),
  `npm run lint` (0 errors, 16 pre-existing/accepted test-mock warnings), `npx jest` (**5 suites,
  32 tests, all pass**), `npx jest --config ./test/jest-e2e.json` (**8/8 pass**, against the real
  live stack); frontend `npm run build` (clean), `npm run lint` (0 errors), `npx vitest run`
  (**2 files, 8 tests, all pass**).
- **Dead-code/quality sweep**: grepped the entire `src/` tree of both apps for `TODO`/`FIXME`/`XXX`
  — **zero results**, consistent with the brief's "never leave TODOs" rule having actually been
  followed throughout, not just claimed. Grepped for stray `console.log`/`console.debug` — the one
  hit (`main.ts`'s `console.error` in the bootstrap failure handler) is the correct, standard
  NestJS pattern for that specific spot (Nest's own Pino logger isn't initialized yet if bootstrap
  itself fails), not a leftover debug statement.
- **Documentation, a real gap found and fixed**: the root `README.md` scaffolded back in Step 1
  had been sitting **completely empty** ever since — every step's actual documentation went into
  `docs/PROGRESS.md` instead, and nothing ever circled back to write the project's actual
  front-door README. Written now: what the product does, architecture, the full local-dev setup
  (backend + frontend + Postgres/Redis), how to run tests, how to deploy the production Docker
  stack, how to enable the two credential-gated features (AI, billing), and a pointer to the
  security review finding. `.env.example` was also found (during Step 18) to be missing
  `CONTACT_EMAIL` (a real, used config var since Step 14) — fixed there.
- **Structural honesty check**: the brief's Step 1 asked for top-level `packages/shared/`,
  `scripts/`, and `tests/` directories. All three were scaffolded in Step 1 and have remained
  genuinely empty ever since — no cross-app shared types ended up being needed (both apps'
  domain types are independent), no custom scripts were needed beyond each app's own
  `package.json` scripts, and every real test ended up living inside `apps/backend` and
  `apps/frontend` (the standard, tooling-expected location for Jest/Vitest in each respective
  app) rather than a top-level `tests/`. Documented here rather than either silently deleting
  these placeholder directories or padding them with content that doesn't serve a real purpose
  just to look complete.

### What's genuinely production-ready vs. what a real launch still needs

Being direct about this rather than declaring "done" unqualified:

**Solid and verified**: authentication (including the security-critical refresh-token-rotation
property, tested three separate ways — unit, e2e, and manual curl), authorization/multi-tenancy
(no IDOR found across any controller), discovery/scanning/monitoring/risk-scoring pipeline (real
external verification against `example.com` throughout), PDF reports, the SSRF fix, rate
limiting, input validation, structured logging with secret redaction, Docker production images,
CI pipeline.

**Explicitly not done, by necessity of this environment, not by oversight**: real SMTP/Stripe/AI
credentials (the code is real and verified as far as possible without them — see Steps 11/13);
TLS/HTTPS termination for the production stack; a real deployment target (no actual cloud
account/domain exists here, so `docker-build` is CI's last real job — there's no honest `deploy`
step to add yet); multi-region/HA considerations; per-plan scan-frequency enforcement (flagged
back in Step 9, still open); load/performance testing under realistic traffic (everything here
was verified for *correctness*, not for behavior under production-scale load).

---

# Post-launch enhancements (beyond the original 19-step plan)

The original brief's 19 steps are complete (above). Continuing to build on the product from here,
same discipline: real code, real verification, changes documented honestly as they land.

## Enhancement 1 — Subdomain enumeration (done, 2026-07-07)

**Why**: the discovery module (Step 7) only ever scanned the exact literal hostname a user
entered (e.g. `example.com` itself) — never any subdomains. For an attack-surface-monitoring
product, this is a significant gap: most organizations already know their main site's security
posture; the actual value of a tool like this is surfacing the stuff they *don't* reliably
track — a forgotten `staging.`/`jenkins.`/`old.` subdomain is a disproportionately common source
of real findings in external recon.

**What was built**: `src/discovery/subdomain.service.ts` — a bounded (~96 entries, not a
100k-line brute-force list) curated wordlist of common subdomain prefixes (environments:
staging/dev/qa/uat; admin/internal tooling: admin/portal/cpanel/jenkins/grafana/kibana; legacy:
old/legacy/backup; infra: ns1/ns2/autodiscover/vpn; etc.), resolved in parallel against the
tracked domain with bounded concurrency (10 at a time — enough to be fast without hammering the
resolver with 96 simultaneous queries). Wired into `discovery.service.ts`: every domain scan now
also enumerates subdomains, and up to 25 of the discovered ones (a second, independent safety cap
in case an unusual domain's wildcard DNS record makes an implausible fraction of candidates
resolve) get a real HTTP+technology-detection probe, same as the main hostname — so a scan
doesn't just report "12 subdomains exist" but actually tells you which ones are live, what status
code they return, and what's running on them. Persisted as `SUBDOMAIN`-type `Asset` rows through
the same upsert/change-detection pipeline every other asset type already uses (new subdomain
discovered → real alert, per the existing `ScanProcessor` logic from Step 8 — no changes needed
there, it already treats any new asset uniformly).

**Verified for real, twice**:
- **Unit tests** (`subdomain.service.spec.ts`, 3 tests) — perform genuine DNS resolution against
  real public domains (same testing philosophy as Step 7's `example.com` verification, not
  mocked): confirms `www.google.com` is found among real results for `google.com`, confirms no
  duplicate hostnames, confirms every returned result actually has a real resolved address.
- **Live, end-to-end, against the running system**: registered `google.com` as a tracked domain
  through the real API and triggered a real discovery run. Result: **28 of 96 candidate
  subdomains genuinely resolved** (`smtp.`, `mail.`, `www.`, `api.`, `admin.`, and 23 others),
  each persisted as a real `SUBDOMAIN` asset with its real resolved IP addresses — and critically,
  `api.google.com` came back correctly marked `httpReachable: true, statusCode: 404` (a real,
  distinct HTTP probe result) while the others correctly show `httpReachable: false` (DNS exists,
  nothing answering HTTP) — proving the per-subdomain probe step is doing real, independent work
  per host, not just copying the parent domain's result. Test domain/user cleaned up afterward.

Confirmed backend build/lint/full test suite clean after this change: `npm run build` (clean),
`npm run lint` (0 errors, same 16 pre-existing test-mock warnings), `npx jest` → **35/35 tests
pass** (up from 32 — the 3 new subdomain tests).

## Enhancement 2 — Full English/Hebrew (RTL) UI + visual design pass (done, 2026-07-07)

Prompted directly by user feedback that the deployed frontend looked completely unstyled. **First
found the real cause before touching any design**: a stale `.next` build being served by an old
`next start` process — killing it and rebuilding fresh showed the actual (already-decent) dark
Stripe/Vercel/Linear-style theme from Step 6/14 was intact all along. Verified this with a
before/after screenshot (before: default browser serif font, no colors, no layout — a genuine
CSS-not-loading state, `.next/static/css/*.css` hash mismatch between the running server's
in-memory manifest and what was actually on disk; after: the real intended design). Documenting
this because it's the second time this exact class of bug (stale build/server) has caused
something that looks like a real product regression — see Step 14's note on the same failure
mode.

With the real baseline confirmed, built two things on top of it:

**1. Full bilingual English/Hebrew interface with genuine RTL layout**, not just translated
strings:
- Added `next-intl` (v4, Next 16-compatible) with the standard App Router pattern: `app/[locale]/`
  route segment (moved every existing page under it), `i18n/routing.ts` (locales `en`/`he`,
  `localePrefix: 'always'` so the active language is always unambiguous from the URL),
  `i18n/navigation.ts` (locale-aware `Link`/`useRouter`/`usePathname` wrappers — used everywhere
  instead of the plain `next/link`/`next/navigation` versions specifically so navigation and hard
  redirects can't silently drop back to the default locale), and `proxy.ts` (Next.js 16 renamed
  the `middleware.ts` file convention to `proxy.ts`; used the new name directly rather than the
  deprecated one).
- `messages/en.json` / `messages/he.json` — 177 keys each, verified with a script to have exactly
  matching key sets (a missing Hebrew key would otherwise only surface as a runtime crash on that
  specific page). Every page and shared component (`Sidebar`, `AssetCard`, `AlertCard`,
  `SecurityScoreCard`, `Timeline`, `MarketingNav`/`Footer`) now sources its text from these files —
  zero hardcoded UI strings left in components that render user-facing text.
- **`dir="rtl"`/`dir="ltr"` set on `<html>` per-locale** in the root layout, combined with
  switching every component's physical-direction Tailwind utilities (`pl-*`/`pr-*`, `ml-*`/`mr-*`,
  `left-*`/`right-*`, `border-l`/`border-r`) to their **logical** equivalents (`ps-*`/`pe-*`,
  `ms-*`/`me-*`, `start-*`/`end-*`, `border-s`/`border-e`) — verified Tailwind v4 actually compiles
  these to real `padding-inline-start`/`inset-inline-end`/etc. CSS properties (not assumed) before
  relying on them. This is what makes the Hebrew UI a genuine mirrored RTL layout (sidebar on the
  right, nav/buttons flowing right-to-left, icons on the correct side of their labels) rather than
  just right-aligned English-layout text, **verified visually** — see below.
- **`LanguageSwitcher` component** — a single toggle-to-the-other-language button (not a dropdown,
  since there are only two locales) using `next-intl`'s locale-aware router so switching language
  stays on the exact same page (`/he/domains` → `English` click → `/en/domains`, not back to the
  homepage). Present in both the marketing nav and the dashboard sidebar.
- **Found and fixed two real bugs this surfaced**, not just translation work:
  1. `lib/plans.ts`'s billing-page "is this the user's current plan?" check compared
     `plan.name.toUpperCase() === currentPlan` — this breaks the instant the plan name is
     translated (`"חינם".toUpperCase()` is never `"FREE"`). Fixed by adding a stable,
     locale-independent `key` field (`"FREE" | "STARTER" | ...`, matching the backend's real
     `SubscriptionPlan` enum) to `PlanInfo` and comparing against *that*, never the translated
     display name — `lib/plans.test.ts` rewritten to exercise `getPlans()` against **both** real
     message files (not a fake mock dictionary) and assert this specifically.
  2. `AuthProvider`'s `login`/`register`/`logout` and the axios response interceptor's
     session-expired redirect all used plain `next/navigation`/a raw `window.location.href`
     pointing at bare paths (`/dashboard`, `/login`) — since `localePrefix: 'always'`, a hard
     redirect to a bare path gets intercepted by the proxy and bounced to the *default* locale,
     silently dropping a Hebrew-using session back to English on every login/logout/session-expiry.
     Fixed `AuthProvider` by switching to the locale-aware router; fixed the interceptor (which
     can't use a React hook) by reading the locale segment directly out of
     `window.location.pathname` before constructing the redirect URL.
- Added a reusable `test/render-with-intl.tsx` test helper (wraps a component under test in a real
  `NextIntlClientProvider` using the actual `en.json`) and updated `AlertCard.test.tsx` to use it,
  since `AlertCard` now calls `useTranslations` and would otherwise throw with no provider ancestor.

**2. Visual design polish**, addressing "make it nicer" directly rather than just fixing the stale
build:
- Root layout: a fixed, subtle decorative radial-gradient glow behind the whole app (the same
  "premium SaaS depth" treatment Stripe/Linear/Vercel all use some version of).
- Landing page hero: the second title line now renders as an indigo→violet gradient
  (`bg-clip-text`), larger hero type scale, buttons lift slightly on hover
  (`hover:-translate-y-0.5`) with a colored shadow.
- Feature cards across landing/features pages: hover lift + border/background transition instead
  of static boxes.
- Pricing page: the Professional plan is now visually highlighted (bordered, subtle glow, a
  "Professional" badge) as the recommended tier — a standard, well-tested SaaS pricing pattern,
  applied via a real `plan.key` check rather than a hardcoded index so it can't silently point at
  the wrong plan if the list order ever changes.
- `globals.css`: themed scrollbar (WebKit), text-selection color, `scroll-behavior: smooth`, and a
  Hebrew-capable font-family fallback chain (`next/font`'s Geist only ships a Latin subset, so
  Hebrew text needs to actually fall through to a platform sans-serif that has Hebrew glyphs rather
  than rendering tofu/mismatched fallback boxes).
- Sticky, blurred marketing nav (`backdrop-blur-md`) instead of a static header.

**Found and fixed one more real bug during visual verification**: the browser was requesting
`/he/favicon.ico` (relative to the current locale-prefixed path) instead of the actual
`/favicon.ico`, 404ing on every locale-prefixed page load — confirmed via a live browser network
listener, not assumed. Fixed with an explicit absolute `icons: { icon: "/favicon.ico" }` in the
root layout's `metadata`.

**Verified thoroughly with real headless-browser runs, in both languages**:
- Screenshotted the landing page in English and Hebrew side by side — confirmed genuine RTL
  mirroring (nav/logo/buttons flipped, hero text right-aligned, feature-card grid reading
  right-to-left), not just translated English-layout text.
- Confirmed `document.documentElement.dir === "rtl"` and `lang === "he"` are actually set on the
  live page (not just present in the source).
- **Full real end-to-end flow through the Hebrew UI**: registered a genuine new user
  (name/company in Hebrew) via the `/he/register` form, landed on `/he/dashboard`, added a real
  domain via `/he/domains`, confirmed the `AssetCard` renders correctly mirrored with a
  Hebrew-locale-formatted date — zero browser console errors throughout.
- Verified the language switcher's "stay on the same page" behavior live: clicked it on
  `/he/domains`, landed on `/en/domains` with the same session/data intact.
- Confirmed no regressions: full test suites still pass on both apps after every change
  (**backend**: `npx jest` 35/35, unchanged; **frontend**: `npx vitest run` **15/15**, up from 8 —
  the expanded `plans.test.ts` plus `AlertCard.test.tsx`'s updated provider wrapper), both apps'
  `npm run build`/`npm run lint` clean (0 errors), and all 27 page routes (13 pages × 2 locales +
  `/_not-found`) statically prerendered per `next build`'s own route summary.
- Test user/data cleaned up from the database after verification.

**Known, disclosed scope limit**: RTL correctness was verified thoroughly for every page actually
built (marketing site, auth pages, dashboard shell + all its pages), but wasn't audited utility-
by-utility across 100% of every conceivable physical-direction Tailwind class in the codebase —
the ones that mattered visually (nav, sidebar, timeline, forms, cards) were found and fixed via
real visual inspection in both directions, which is the same rigor applied everywhere else in this
build, but a dedicated line-by-line grep-for-`pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-` audit of every
file wasn't separately performed as a final catch-all pass.

## Enhancement 3 — missing auth pages, sales-focused landing content, legal pages, SEO (done, 2026-07-07)

Continuing to build on the product per direct instruction: fill in real remaining gaps, add
stronger marketing/sales copy, and keep polishing — same "no fake data" discipline applied to the
sales copy specifically (no fabricated customer counts, testimonials, or logos — every claim on
the landing page describes something this codebase actually does, verifiable by reading the
relevant service).

**Filled a real, previously-dead gap**: the login page has always linked to `/forgot-password`,
and the backend's `forgot-password`/`reset-password`/`verify-email` endpoints have existed since
Step 5 — but no frontend pages for any of them ever existed, so that link 404'd. Built all three:
- `/forgot-password` — requests a reset link; shows an identical success state regardless of
  whether the email is actually registered (matches the backend's own no-enumeration behavior —
  checked `auth.service.ts` directly to confirm this before writing the comment asserting it).
- `/reset-password` — reads `?token=` from the URL, submits a new password, shows a clear
  invalid-token state if there's no token at all.
- `/verify-email` — auto-submits the token on load, shows verifying/success/error states.
- **Verified all three for real against the live backend**, not just visually: registered a real
  user, requested a real password reset, pulled the real generated token out of the backend's log
  (no SMTP configured, so it logs instead of sending — the established pattern), completed the
  reset through the actual `/reset-password` UI, and confirmed via direct API calls that the new
  password logs in successfully and **the old password is now rejected** (401) — the real
  underlying security property, not just "a success message appeared."
- Both new `useSearchParams()`-consuming pages needed a `Suspense` boundary or `next build` fails
  outright trying to prerender them — hit this exact build error before fixing it, not guessed at.

**Sales-focused landing page additions** (all real claims about what's actually built, checked
against the relevant service before writing each one — no invented social proof/testimonials/
customer counts, which would violate this project's own "no fake data" rule just as much as fake
data anywhere else in the codebase would):
- **"How it works"** 3-step section (add a domain → we scan what attackers would scan →
  prioritized action list) — gives a skimmable answer to "what do I actually get" before the
  detailed feature grid.
- **"Built the way a security tool should be"** trust section — four honest, verifiable claims:
  read-only reconnaissance (true — grepped the discovery services again to confirm none of them
  ever send anything other than standard read-only DNS/TLS/HTTP requests), transparent scoring
  (true — Step 10's point-deduction model), no lock-in (true — Stripe portal self-service
  cancellation), and guarded against misuse (true — directly references this session's own SSRF
  fix).
- **FAQ section** (new `FaqAccordion` client component, single-open accordion) answering real
  objections a prospective customer would have — including an explicit, honest answer to "can I
  scan a domain I don't own?" that says no, rather than dodging the question a real attack-surface
  tool has to be straight about.

**Legal pages** (`/terms`, `/privacy`) — real, complete (if reasonably concise) content in both
languages, not placeholder Lorem Ipsum: Terms of Service includes an explicit "authorized use
only" clause (important for a domain-scanning product specifically — a user must only add domains
they own or are authorized to test), and Privacy Policy accurately describes the actual data this
codebase collects and the actual third parties it talks to (Stripe, the configured SMTP provider,
Anthropic) — cross-checked against `schema.prisma` and `ai.service.ts` directly rather than
writing generic boilerplate, confirming e.g. that AI finding-analysis really does only send the
finding's own title/description/severity/category, never full account data.

**SEO/sharing basics** — `app/sitemap.ts` and `app/robots.ts` (Next's real file-convention APIs,
`disallow`-ing the authenticated dashboard routes via a `/*/dashboard`-style wildcard since every
route is locale-prefixed), and `generateMetadata` (converted from a static `metadata` export) so
`<title>`/description/Open Graph/Twitter-card tags are genuinely translated per locale rather than
always English regardless of which language a page is being viewed in.

**Custom, on-brand 404 page** — found and fixed a real next-intl gap while verifying this: a
translated `app/[locale]/not-found.tsx` alone does **not** catch a genuinely unmatched path (e.g.
`/he/some-typo`) — confirmed live that it fell through to Next's plain, unstyled, English-only
default 404 instead. Fixed with the standard fix: an `app/[locale]/[...rest]/page.tsx` catch-all
that calls `notFound()`, so any otherwise-unmatched path under a valid locale actually resolves
into the `[locale]` route tree (and therefore hits the nearby styled/translated boundary).
Re-verified live afterward: the custom Hebrew 404 page now renders correctly.

Full re-verification after all of the above: `npm run build` (clean, all 17 pages × 2 locales +
`robots.txt`/`sitemap.xml` statically generated), `npm run lint` (0 errors), `npx vitest run`
(15/15, unchanged), zero browser console errors across every new/changed page in both languages.

## Enhancement 4 — team invitations, an org switcher, and tightened billing authorization (done, 2026-07-08)

The data model has had `Membership.role` (OWNER/ADMIN/MEMBER) since Step 4, but nothing ever let an
organization actually grow past its original owner — no invite flow existed. Built one for real,
backend and frontend, then found and fixed two real bugs it exposed.

**Backend**: new `Invitation` Prisma model (migration `add_invitations`) and `InvitationsModule`:
- `POST /invitations` (OWNER/ADMIN only) creates/re-issues a time-limited (7-day) token and emails
  it via the existing `EmailService` pattern; re-inviting an already-pending email upserts (fresh
  token) rather than erroring on the unique constraint.
- `GET /invitations/:token` is deliberately public (no `JwtAuthGuard`) — someone clicking an email
  link hasn't necessarily signed in yet and needs to see which org/role it's for first.
- `POST /invitations/:token/accept` requires auth and **checks the logged-in user's email against
  the invitation's email** before creating the `Membership` — without this, anyone who obtained a
  token could join as whatever role it carries regardless of who it was actually sent to.
- `GET /invitations/members` lists an org's real roster for the settings page.
- Added `OrganizationsService.assertManagerMembership` (OWNER/ADMIN check) as a single shared
  authorization helper, and **used it to close a real least-privilege gap found while building
  this**: `BillingController`'s checkout/portal-session endpoints previously only checked "is a
  member at all", meaning a plain MEMBER could change what the whole organization is billed for.
  Tightened to OWNER/ADMIN, and refactored `InvitationsService`'s own identical check to reuse the
  same shared helper instead of duplicating the logic.
- **Verified end-to-end against the real live stack** (`test/invitations.e2e-spec.ts`, 9 new
  tests): an OWNER can invite; a non-member is rejected (403); the invitee can accept and a real
  `Membership` row appears; a *different* logged-in user cannot accept someone else's invitation
  (403); re-accepting an already-used token is rejected (404). 16/16 e2e tests pass overall
  (existing 8 + these 9, minus one shared setup step) alongside 35/35 unit tests.

**Frontend**: a full `TeamSection` component on the Settings page (member roster with roles,
pending-invitations list with revoke, an invite form — all conditionally rendered based on the
current user's own role, mirroring the backend's real authorization rather than just hiding UI
optimistically) and a public `/invitations/[token]` accept page handling every real state (invalid/
expired, not-signed-in with Sign-in/Create-account CTAs, signed in as the wrong email, success).
Extended the login/register pages to accept a `?redirect=` param (and register to pre-fill
`?email=`) so clicking an invite link while logged out lands back on that exact invitation after
auth — verified this exact round trip live: registered a brand-new second user starting from the
invite link, landed back on the invite page automatically, accepted it, and confirmed via a direct
API call that both users now show up in the org's real member list.

**Found and fixed a real bug this surfaced**: the moment a user belongs to more than one
organization (their own from registration, plus any they're invited into), every page that read
`organizations?.[0]` silently showed the *wrong* one with no way to switch — reproduced live with a
real invited test account whose dashboard kept showing their unrelated personal org. Fixed with a
new `OrganizationProvider`/`useOrganization()` context (current org derived during render from an
explicit selection → localStorage → first membership, deliberately not synced via a
`useEffect`-based `setState` — the same `react-hooks/set-state-in-effect` fix already applied once
in `auth-context.tsx`) and a switcher dropdown in the sidebar, shown only once a user actually has
more than one organization. All four pages that used to read `organizations?.[0]` directly
(dashboard, domains, settings, billing) now go through this shared context instead.

**Created two real, working accounts on request** (not test throwaways — left in the database):
`admin@sentinelai.dev` (OWNER of "SentinelAI HQ") and `viewer@sentinelai.dev` (invited into the
same org as a plain MEMBER). Added a real domain (`example.com`) and ran a real scan against it so
there's actual security data to look at. **Verified the actual point of this** directly against the
API before handing off credentials: the MEMBER account can read the full findings/score/domains
list (200) but is correctly rejected (403, the exact new `assertManagerMembership` message) from
both inviting new members and starting a billing checkout — confirmed again through the real
browser UI (org switcher, dashboard findings, Settings → Team roster) end-to-end, not just via curl.

Full re-verification: backend `npm run build`/`npm run lint` (0 errors)/`npx jest` (35/35)/e2e
(16/16); frontend `npm run build` (all routes including the new `/invitations/[token]` still
prerender or route correctly)/`npm run lint` (0 errors, after fixing the effect-based-setState
issue for real rather than suppressing it)/`npx vitest run` (15/15, unchanged).

## Enhancement 5 — competitor-inspired additions: a letter grade and a real historical trend chart (done, 2026-07-08)

Researched what actually-shipping attack-surface-management/security-rating products do differently
before adding anything, rather than guessing — specifically UpGuard, Detectify, and
SecurityScorecard. Two ideas were genuinely worth adopting (and buildable without any fabricated
data); the rest either don't fit this product's single-tenant scope (vendor/third-party risk
scoring) or would require fabricating something this build has no real basis for (SecurityScorecard's
"compare against industry peers" needs real peer benchmark data this project doesn't have — not
built, rather than faked).

1. **Letter grade (A+ through F) alongside the existing numeric score** — SecurityScorecard's own
   research/positioning is that a coarse grade reads faster for a non-technical stakeholder
   (executive, auditor) than a bare percentage does. Implemented as a pure display transform of the
   *exact same* score already computed by the real risk engine (`scoreToGrade` in
   `SecurityScoreCard.tsx`) — explicitly not a second, independently-computed rating, which would
   have reintroduced the "opaque black-box number" problem Step 10's whole point-deduction design
   exists to avoid. Added 13 new component tests (`SecurityScoreCard.test.tsx`) covering every
   grade boundary.
2. **A real historical security-score trend chart** — `RiskChart` (the component) existed since
   Step 6 but was never wired to anything. Added `GET /risk/domains/:domainId/history` (backend),
   returning the real score computed from every one of a domain's actually-completed past scans
   (capped at the most recent 30 — a scan *count*, not a calendar-day window, since scan frequency
   is plan-dependent), refactored the score-from-findings math into one shared function so
   `/latest` and `/history` can't silently compute it two different ways. Added an honest empty
   state ("run a few more scans...") for the — very common early on — case of fewer than 2 data
   points, rather than rendering a meaningless single-dot chart.

**Verified against real, live data, not a mock**: logged in as the real `admin@sentinelai.dev`
account created earlier this session, triggered two additional real scans against the already-
tracked `example.com` domain (on top of the one from before), and confirmed the dashboard now
shows a genuine 3-point trend line with a real tooltip ("Jul 8, score: 72") and the score correctly
rendered as both `72/100` and the `C-` grade in the same card — a real screenshot, not assumed.

Full re-verification: backend `npm run build`/`npm run lint` (0 errors)/`npx jest` (35/35,
unchanged)/e2e (16/16, unchanged); frontend `npm run build` (clean)/`npm run lint` (0 errors)/
`npx vitest run` (**31/31**, up from 15 — the new `SecurityScoreCard.test.tsx`), zero browser
console errors.

Sources consulted for this step's research (attack-surface-management/security-rating product
features): [Top 12 Attack Surface Management Software in 2026](https://geekflare.com/cybersecurity/best-attack-surface-monitoring/),
[UpGuard vs SecurityScorecard: Which Rating Wins in 2026?](https://www.shieldrisk.ai/blog/upguard-vs-securityscorecard/),
[Top 10 Attack Surface Management Software Solutions in 2026 — UpGuard](https://www.upguard.com/blog/best-attack-surface-management-software-solutions),
[External Attack Surface Management — SecurityScorecard](https://securityscorecard.com/platform/external-attack-surface-management/).

## Enhancement 6 — finished two features that had real backends but placeholder frontends (done, 2026-07-08)

Went looking specifically for "backend already built, frontend never wired up" gaps — the
Reports page still said "not built yet" even though Step 12 built real PDF generation, and the
Alerts page said the same even though `ScanProcessor` has created real `Alert` rows since Step 8.
Both were pure honesty placeholders that had simply never been circled back to; fixed both for real.

**Reports page**: fully wired to the real, already-existing `POST/GET /reports`,
`GET /reports/:id/download`, `POST /reports/:id/email` endpoints — a "Generate report" button, a
real list with a live pending/ready status (polls while any report has no `fileUrl` yet, the same
pattern as `useDomainRisk`), and working download/email actions. The download button specifically
needed a real fix, not just a link: the endpoint requires a JWT `Authorization` header (reports
can contain real security findings, so it's deliberately not a bare unauthenticated URL), which a
plain `<a href>` can't attach — added `downloadReport()` in `lib/hooks.ts`, fetching the PDF as an
authenticated blob through the same `api` client as everything else, then triggering a normal
client-side file download from the in-memory result.

**Alerts — a genuinely missing backend module, not just a missing page**: there was no
`AlertsController`/`AlertsService` at all; the `Alert` Prisma model (with its `read: Boolean` field,
clearly designed for exactly this) had never been exposed over the API. Built `AlertsModule`:
`GET /alerts` (list, capped at the most recent 100 — a real cap, not true pagination, since nothing
in this UI needs to page further yet), `PATCH /alerts/:id/read`, `PATCH /alerts/read-all` — all
membership-checked the same way every other resource in this codebase is. Frontend Alerts page
reuses the existing `AlertCard` component (built back in Step 6, previously unused by this page)
with a real "Mark all read" action.

**Verified both against real, live data, not mocks**:
- New `test/alerts.e2e-spec.ts` (6 tests): registers a user, adds a real domain, triggers a real
  scan, **polls until the real BullMQ worker actually creates real `Alert` rows** (not asserted
  against fabricated fixture data), then exercises list/mark-read/mark-all-read and confirms an
  outsider is rejected (403) from all three. 22/22 e2e tests pass overall (16 existing + 6 new).
- Live browser verification, logged in as the real `admin@sentinelai.dev` account from earlier
  this session: the Alerts page shows the actual alerts generated by this session's real scans
  (`New subdomain discovered: www.example.com`, real IPs); on Reports, clicked "Generate report",
  watched it show a live "Generating…" status, then flip to "Ready" once the real BullMQ worker
  finished, clicked "Download", and **verified the downloaded file with `file`/`pdftotext`** — a
  genuine PDF containing the real organization name, real score (72/100), all 6 real discovered
  assets, and the same 3 real findings verified earlier in this session — not a placeholder.

Full re-verification: backend `npm run build`/`npm run lint` (0 errors)/`npx jest` (35/35,
unchanged)/e2e (**22/22**, up from 16); frontend `npm run build` (clean, all routes still
prerender)/`npm run lint` (0 errors)/`npx vitest run` (31/31, unchanged), zero browser console
errors across both newly-completed pages.
