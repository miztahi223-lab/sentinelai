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

## Enhancement 7 — fixed a real hardcoded-fake-data bug, added a dashboard domain selector (done, 2026-07-08)

Auditing specifically for the exact anti-pattern this whole build has otherwise avoided — found
one: both the Domains page and the dashboard's "Tracked domains" list hardcoded
`findingsCount={0}` on every single `AssetCard`, regardless of how many findings a domain's
last scan actually had. That's not an honest placeholder (which this codebase uses correctly
elsewhere, e.g. Reports'/Alerts' old "not built yet" states) — it's a real number-shaped UI
element showing a fabricated value, exactly the thing the "never fake data" rule exists to
prevent. Fixed with a new `DomainAssetCard` wrapper that calls the real `useDomainRisk(domain.id)`
for each domain and passes its actual finding count through.

Also closed the dashboard's own long-standing honesty disclaimer ("score shown is for the first
tracked domain only — a multi-domain view isn't built yet"): added a real domain selector
(shown once an org has more than one tracked domain) so the score/findings/trend section can
show *any* tracked domain's real detail, not permanently whichever one happened to be added
first. Not a combined multi-domain aggregate score (there's no obviously correct way to average
several domains' scores into one number, so this wasn't attempted/faked) — an honest, narrower
fix for the actual practical gap. Updated the dashboard's disclaimer copy to describe what's
really true now.

**Verified against real, live data**: added a genuine second domain (`iana.org`) to the real
`admin@sentinelai.dev` account's organization, ran a real scan against it (78/100, 3 real
findings — distinct from `example.com`'s existing 72/100, 3 findings), and confirmed via
screenshots that both the Domains list and the dashboard's "Tracked domains" list now show two
different, correct, real finding counts (previously would have shown "0" for both, silently
wrong) — and that the new domain selector correctly switches the score/findings/trend section
between the two real domains.

Full re-verification: frontend `npm run build` (clean)/`npm run lint` (0 errors)/
`npx vitest run` (31/31, unchanged), zero browser console errors.

## Enhancement 8 — a real audit log, and a real unread-alerts badge (done, 2026-07-08)

**Audit log**: the `AuditLog` Prisma model has existed since Step 4 of the original build and was
never written to or read anywhere — a real, quiet gap for a product whose own landing page
markets itself on "built the way a security tool should be" (real customers in this exact space
routinely expect an audit trail). Built `AuditLogsModule` (`AuditLogsService.record()` — best-
effort, logged-but-non-blocking if it ever fails, deliberately not wrapped in the same transaction
as the action it describes so a logging hiccup can never roll back or block the real operation;
`GET /audit-logs`, restricted to OWNER/ADMIN via the same shared `assertManagerMembership` helper
billing and invitations already use) and wired real logging calls into every security-relevant
action already in this codebase: `user.registered`, `user.login`, `domain.added`,
`invitation.created`, `invitation.accepted`, `billing.checkout_started`. Frontend: a new
`ActivityLog` component (added to Settings) that turns each raw action key + its stored metadata
into an actual human-readable sentence ("Added domain example.com", "Invited x@y.com (Member)")
rather than showing a technical action string — and doesn't independently guess whether the
viewer is allowed to see it; it just reflects the real API's own 200-vs-403, the single source of
truth for that authorization decision.

**Verified end-to-end against real, live data**: new `test/audit-logs.e2e-spec.ts` (6 tests) —
registers a user, logs in again, adds a domain, invites and accepts a teammate, and confirms a
real `AuditLog` row exists for every one of those five actions (with the domain name genuinely
present in the stored metadata), that an OWNER can read them via the API and a plain MEMBER gets a
real 403. 28/28 e2e tests pass overall (22 existing + 6 new). Live browser verification against
the real `admin@sentinelai.dev` account caught something genuinely worth documenting rather than
just "it worked": the account's Activity Log initially showed "No activity recorded yet" even
after a real fresh login — correct, not a bug, because (a) this account's original
registration/domain-add/invite events all happened *before* this audit-logging code existed, so
nothing exists to retroactively show, and (b) `user.login` is deliberately not organization-scoped
(a login isn't inherently "for" any one of a user's orgs), so it correctly never appears in a
per-org activity feed. Confirmed the feature genuinely works by triggering one brand-new
org-scoped action (adding a real domain) and watching it appear immediately, correctly worded, in
the real browser.

**Unread-alerts sidebar badge**: `Sidebar` now shows a real unread count next to "Alerts" (via the
same `useAlerts` hook the Alerts page itself uses — no separate/duplicated counting logic to drift
out of sync). Verified live: showed a real "18" matching the actual number of unread alerts on the
`admin@sentinelai.dev` account.

Full re-verification: backend `npm run build`/`npm run lint` (0 errors)/`npx jest` (35/35,
unchanged)/e2e (**28/28**, up from 22); frontend `npm run build`/`npm run lint` (0 errors)/
`npx vitest run` (31/31, unchanged), zero browser console errors.

## Production-readiness pass — rebuilt and re-verified the full containerized stack (2026-07-08)

Every feature added since Step 16's original Docker verification (subdomain enumeration, SSRF
guard, i18n, team invitations, alerts, reports UI, audit logs) had only ever been tested against
the local dev stack (`docker-compose.yml`, app run via `npm run start`/`start:dev` directly) — not
re-verified against the actual production Docker images since they were first built. Rebuilt both
(`docker compose -f docker-compose.production.yml build`) and ran the **entire** stack fresh,
including a genuinely clean Postgres volume (removed the leftover volume from Step 16 rather than
reusing an already-migrated database, specifically so the migration step itself would be tested
for real, not skipped as a no-op).

**Real, useful finding**: hit the exact "backend could not be resolved" nginx error Step 16's own
fix was built for — except this time triggered by something new: **Podman's embedded DNS
(aardvark-dns) gateway address is not even stable across recreations of the same named network on
this same host** (it was `10.89.1.1` when Step 16 verified this, `10.89.2.1` this time, after
tearing down and recreating the same `sentinelai-prod_internal` network). Confirmed via
`docker network inspect`. This doesn't affect real Docker Engine deployments (its embedded DNS is
always the fixed `127.0.0.11`, which is why that's the compose file's actual default), but it's a
real, reproducible Podman-specific fragility worth knowing about if this stack is ever verified
locally on Podman again — recorded here rather than silently working around it and losing the
lesson. Fixed for this verification run by pointing `NGINX_RESOLVER` at the actual current gateway
and recreating the nginx container (required — editing `.env` alone doesn't retroactively change
an already-created container's environment).

**Verified for real, against the fully fresh, fully rebuilt containerized stack**: both migrations
(`init` and the new `add_invitations`) applied cleanly and in order on a genuinely empty database;
registered a real user through nginx → backend → real Postgres; confirmed the new `audit-logs`,
`invitations`, and `alerts` endpoints all respond correctly (200, with a real `user.registered`
audit entry genuinely present) through the complete containerized path, not just the local dev
servers these features were originally built and tested against. Also confirmed `robots.txt`/
`sitemap.xml` serve correctly and honestly fall back to `http://localhost:3000` in `sitemap.xml`
since `NEXT_PUBLIC_SITE_URL` wasn't set for this quick verification run (expected — flagged in
`.env.example`, not a bug).

**Found and fixed a real documentation gap while doing this**: `NEXT_PUBLIC_SITE_URL` (used by
`sitemap.ts`/`robots.ts`/the root layout's Open Graph metadata since the sales-copy/SEO
enhancement) was never added to `.env.example` — added it.

Torn down cleanly afterward (containers, the fresh test volumes, and the temporary root `.env`
used only for this verification) and confirmed the separate local dev stack
(`docker-compose.yml` + `npm run start:dev`/`npm run dev`) came back up and responded correctly,
since that's what every other verification in this session actually runs against day-to-day.

Also re-ran `npm audit` on both apps as part of this pass: backend unchanged (3 moderate, the same
accepted `@prisma/dev`/`@hono/node-server` dev-tooling transitive finding from Steps 17-18); frontend
now shows the same single underlying bundled-PostCSS finding via one additional dependency path
(`next-intl` → `next`, since `next-intl` was added for this session's i18n work and naturally
depends on `next`) — not a new vulnerability, the identical accepted one from Step 17 with one more
reported route to it. CI's `.github/workflows/ci.yml` needed no changes — it already runs
`npm run test`/`npm run test:e2e` generically, so the new alerts/audit-logs/invitations test suites
are automatically included.

## Enhancement 9: real product screenshot on the landing page + visual polish pass

Researched 2026 SaaS landing-page conversion research before touching anything (same
research-before-building discipline as Enhancement 5): the consistent, sourced finding across
current design write-ups (Unbounce, Framiq, SaaSHero, and others) is that top-converting SaaS
landing pages have moved away from abstract 3D illustrations toward showing the **actual product
UI** early and prominently — "a real product screenshot, even an imperfect one, does more
conversion work than a beautiful illustration." That's directly actionable here without
fabricating anything, since the product is real and already running.

**What was added, concretely:**

- A genuine, unedited screenshot of the live dashboard (`admin@sentinelai.dev`'s real account,
  `iana.org` selected — a real tracked domain with a real completed scan: score 78/100, grade C+,
  3 real findings including "no valid TLS certificate observed" and a missing
  `permissions-policy` header) was captured via Playwright at 2x device scale, then cropped to the
  score/findings region and saved to `apps/frontend/public/marketing/dashboard-preview.png`. No
  pixel of this image was drawn, edited, or faked — it's a direct capture of what the product
  actually shows for a real scanned domain.
- New `components/BrowserFrame.tsx`: a purely decorative macOS-style browser-chrome wrapper
  (traffic-light dots + a fake address bar reading `app.sentinelai.dev/dashboard`) rendering that
  screenshot via `next/image` — confirmed Next's built-in image optimizer actually re-encodes it
  on demand (verified via curl with `Accept: image/webp`: the raw 191 KB PNG is served as a 41 KB
  WebP at the size actually requested by the layout, not the full source resolution).
- Landing hero (`app/[locale]/page.tsx`): added an eyebrow badge ("Attack surface monitoring"),
  a subtle CSS-only ambient background (`bg-hero-grid` dot grid + a radial indigo glow in
  `globals.css`, no image asset, mirrors correctly under `rtl:` for Hebrew), a "no credit card"
  micro-copy line, and a 3-stat strip (5 scored categories / 0-100 transparent score / 24/7
  re-scanning) — all three numbers are real, verifiable product facts, not invented business
  metrics (deliberately did not add a fake customer count, logo wall, or star rating — none of
  that data actually exists).
- New "This is the actual product — not a mockup" section immediately below the hero stats,
  showing the real screenshot inside `BrowserFrame`, with a small green "Live dashboard" badge.
- 17 new i18n keys added to both `messages/en.json` and `messages/he.json` (parity re-verified:
  305 keys each, zero drift) for the eyebrow, stats, and preview section copy — including a real,
  literal Hebrew translation of the alt text describing the exact score/findings shown, not a
  generic placeholder.

**Verified for real**: `tsc --noEmit` clean, `next build` succeeds (both locales prerender),
`eslint` clean, all 31 existing frontend unit tests still pass unchanged. Rebuilt and restarted
the production Next.js server (`npm run start`) since it — not `next dev` — is what's actually
running locally in this session, confirmed the new `/marketing/dashboard-preview.png` asset and
page changes are live (a stale build was initially served with a 404 for the new image until the
rebuild). Took fresh Playwright screenshots at desktop (1400px), Hebrew/RTL (1400px — glow
correctly mirrors to the other side via `rtl:translate-x-1/2`, browser-chrome frame renders
correctly with the address bar staying LTR via `dir="ltr"` since a URL is always LTR content),
and mobile (390px, iPhone-sized) — confirmed no horizontal overflow at any width
(`document.documentElement.scrollWidth > clientWidth` checked programmatically, not just
eyeballed).

**Follow-up in the same enhancement**: added two more real screenshots as an alternating
"feature spotlight" section (real product screenshots for two more concrete, already-shipped
features, not just the dashboard) — the same competitor-research finding applied twice over:
- A real generated PDF report (downloaded via the actual `GET /reports/:id/download` endpoint
  for a genuine report on `example.com`, score 72/100, rendered to PNG with `pdftoppm`) next to
  copy about handing a report to a board/auditor.
- A real `alerts` page screenshot (18 genuine unread alerts for `iana.org` — new subdomains, new
  IPs, discovered by an actual scan) next to copy about real-time change notifications.

Both rows use plain CSS grid order (image first / text second, or reversed) so they mirror
correctly under Hebrew/RTL automatically with zero extra RTL-specific classes — verified by
screenshot (`he-spotlight-crop.png` equivalent): the report row flips to image-left/text-right,
the alerts row flips to image-right/text-left, exactly as expected from natural grid flow under
`dir="rtl"`.

Added 8 more i18n keys (badge/title/desc/alt for each of the two spotlight rows) to both
`en.json`/`he.json` — parity re-verified after this addition too.

**Real bug hit and fixed during this verification pass (environment issue, not a code bug)**:
after `npm run build`, restarting the production server raced with the still-shutting-down old
`next start` process — the new process failed silently to bind (`EADDRINUSE`) while an old
process kept serving a stale build whose HTML referenced CSS/JS chunk filenames that no longer
existed on disk (content-hashed filenames change every build), producing real `500` errors for
every static asset even though the HTML shell still returned `200`. Fixed by explicitly killing
the old PID, confirming with `ss -ltnp` that port 3000 was actually free before starting the new
process, rather than a fixed `sleep` after `kill`. Documented here since it's a realistic
production-adjacent lesson (rolling restarts need a readiness check, not a fixed delay) even
though this specific instance only affected local verification, not a deployed environment.

Also confirmed (and documented as expected, not a bug) that Playwright's `fullPage: true`
screenshot can stitch a composite image where a below-the-fold `next/image` with default lazy
loading hasn't finished loading yet for a region far down the page — scrolling through the page
step-by-step before taking the final screenshot fixed the verification artifact; real users
scrolling at a normal pace never see this since the image has already loaded by the time it
enters the viewport.

## Enhancement 10: crypto payment as an additional method (deliberately not anonymous) + a sourced "why now" section

The request behind this enhancement asked for an "anonymous" crypto payment path. That specific
part was not built, and it's worth recording why, in the same spirit as every other honesty
tradeoff in this build:

**What was declined and why**: a genuinely anonymous payment path — one that accepts money
without tying it to an identified account — was not implemented. For a security-scanning product
specifically (this one performs real DNS/subdomain/TLS/HTTP reconnaissance against domains a
customer adds), removing the link between "who is using this scanning capability" and "who paid
for it" would strip the one piece of accountability that discourages pointing the tool at domains
the payer doesn't actually control. Every payment method in this product — Stripe, and now
Coinbase Commerce — is created only for an already-authenticated user who is an OWNER/ADMIN of a
real, already-registered organization, and every checkout is recorded in the audit log exactly
like every other billing action.

**What was built instead — a legitimate additional payment method**:
- `apps/backend/src/billing/crypto-billing.service.ts` (new): real Coinbase Commerce REST API
  integration (`POST /charges`, fixed-price USD charges for STARTER ($49) and PROFESSIONAL ($199)
  — BUSINESS is excluded since it's custom/contact-sales pricing with no fixed amount). Mirrors
  `BillingService`'s existing honesty discipline exactly: without a real
  `COINBASE_COMMERCE_API_KEY`, every method throws `CryptoBillingNotConfiguredError` rather than
  returning a fabricated checkout URL — verified for real via curl (503, not a fake link).
- Real HMAC-SHA256 webhook signature verification (`timingSafeEqual`, not a plain `===`) for
  `charge:confirmed` events, with idempotency via a new `Subscription.lastCryptoChargeId` column
  (migration `20260708153000_add_crypto_billing`) since Coinbase Commerce can legitimately deliver
  the same webhook more than once.
- `BillingController`: new `POST /billing/crypto-checkout-session` (same
  `assertManagerMembership` authorization as the Stripe endpoint — confirmed a plain MEMBER gets
  403, an unauthenticated request gets 401, exactly like Stripe) and `POST /billing/crypto-webhook`
  (no `JwtAuthGuard`, same reasoning as the Stripe webhook route — Coinbase can't present a user
  JWT, so the HMAC signature is the actual authentication mechanism here).
- New `apps/backend/test/crypto-billing.e2e-spec.ts` (5 tests, all against the real running
  stack): no-token request rejected (401) — confirming there is no anonymous checkout path to
  begin with; MEMBER forbidden (403); BUSINESS plan rejected (400, "custom-priced — contact
  sales"); authorized OWNER passes authorization but gets an honest 503 (never a fake `url` field
  in the response body — asserted explicitly); webhook endpoint honestly reports "not configured"
  without a real webhook secret. Full backend e2e suite: **33/33 passing** (28 previous + 5 new).
- Frontend: `apps/frontend/app/[locale]/(dashboard)/billing/page.tsx` gained a "Pay with crypto
  instead" button under Stripe's "Upgrade" for Starter/Professional (not shown for Business), using
  the same authenticated `api` axios instance and the same `organizationId` as every other request
  — plus an explicit footnote translated into both languages stating plainly that crypto checkout
  is tied to the logged-in account and there is no anonymous/guest option. Verified via curl (401
  without auth, 503 "not configured" with auth) and Playwright screenshots in English and
  Hebrew/RTL.
- 10 new i18n keys (5 billing-page keys, already counted in en/he parity) added and re-verified for
  zero drift.

**The "every business needs this today" part — addressed honestly with real, sourced data,
not an invented claim about SentinelAI's own (small) customer base**: researched real, current
industry data before writing anything (same discipline as Enhancement 5/9). Added a new "Why this
matters right now" section to the landing page (`page.tsx`, between the feature spotlight and the
Trust section) citing IBM's own, well-established Cost of a Data Breach research: breaches
involving "shadow" (unknown/forgotten) assets cost 16% more on average and take roughly 26% longer
to identify — directly relevant to what continuous attack-surface discovery addresses, and cited
with an explicit, checkable source line ("Source: IBM Cost of a Data Breach Report
(ibm.com/reports/data-breach)") rather than presented as an unsourced/anonymous statistic.
Verified rendering in both English and Hebrew/RTL via Playwright screenshots.

**Verified for real**: `tsc --noEmit` clean (both apps), `eslint` clean (both apps), frontend
`next build` succeeds, all 31 frontend unit tests pass unchanged, full backend e2e suite 33/33.
Rebuilt and restarted both dev servers, this time explicitly checking `ss -ltnp` for the target
port being free before starting the replacement process (applying the lesson recorded in
Enhancement 9) rather than a fixed sleep.

## Enhancement 11: real account settings — edit your name and change your password

Found this real gap while re-reading `settings/page.tsx`'s own honest footnote from the original
build ("Editing these fields... aren't built yet"). Two genuinely missing, standard account-
management actions for any real SaaS product:

**Backend**:
- Extracted password hashing/verification out of `AuthService` into a shared
  `apps/backend/src/common/password.util.ts` (`hashPassword`/`verifyPassword`, both still argon2id)
  so the new authenticated change-password flow and registration/login use exactly one
  implementation, not two that could quietly drift apart.
- New `apps/backend/src/users/users.controller.ts`: `PATCH /users/me` (update display name) and
  `POST /users/me/change-password` (requires and verifies the *current* password against the real
  argon2 hash — distinct from the existing unauthenticated forgot-password/reset-password email
  flow, which only requires inbox access). A successful password change revokes every other active
  session via `TokenService.revokeAllForUser` — the same session-invalidation behavior the
  email-based reset flow already had — and both actions write a real audit-log entry.
- `UsersModule` and `AuthModule` needed `forwardRef()` on both sides to resolve the new circular
  dependency (`UsersModule` now needs `AuthModule`'s `TokenService`; `AuthModule` already needed
  `UsersModule`'s `UsersService`) — a standard, well-supported NestJS pattern for this exact
  situation, not a workaround.
- New `apps/backend/test/users.e2e-spec.ts` (4 tests, real stack): rejects anonymous profile
  updates; updates the name for real (reflected in a fresh `GET /auth/me`); rejects a password
  change with the wrong current password; and — the most meaningful assertion — after a real
  password change, the *old* refresh token is confirmed revoked (401), the *old* password is
  confirmed to no longer log in (401), and the *new* password is confirmed to log in (200), proving
  the hash genuinely changed rather than just returning a success response. Full backend e2e suite:
  **37/37 passing** (33 previous + 4 new).

**Frontend**: `settings/page.tsx` gained an inline-editable name field (pencil icon → input with
save/cancel, calls the real endpoint, then `refetchUser()` so the header/sidebar reflect the new
name immediately) and a new `components/ChangePasswordForm.tsx` with client-side confirm-password
matching plus the real server error surfaced honestly on a wrong current password. The old
footnote ("Editing these fields... aren't built yet") was updated to only mention what's still
genuinely missing (API key management). Verified end-to-end through the real running UI with
Playwright — not just curl: registered a disposable test account, changed its password through the
actual form, then confirmed via direct API calls that the old password now fails (401) and the new
one works (200). The persistent `admin@sentinelai.dev` demo account's name was used to verify the
edit-name flow live (screenshotted showing "Name updated.") and then explicitly reverted back to
"Site Admin" afterward so the two intentionally-persistent demo accounts stay in their documented
state. Also verified in Hebrew/RTL.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, 31/31 frontend
unit tests, 37/37 backend e2e tests. Both dev servers restarted (checking `ss -ltnp` for a genuinely
free port before starting the replacement process, per the Enhancement 9 lesson) and confirmed
responding.

## Enhancement 12: launch-readiness pass — found and fixed two real wiring gaps, wrote a deploy runbook

Prompted by being asked how much longer until this is live. Audited `.env.example` against what's
actually wired through the production path and found two genuine gaps that would have caused a
real deployment to silently misbehave:

- `COINBASE_COMMERCE_API_KEY`/`COINBASE_COMMERCE_WEBHOOK_SECRET` (added in Enhancement 10) were
  never added to `docker-compose.production.yml`'s backend `environment:` block — a real deployment
  could have a correct `.env` file with real Coinbase keys and the crypto checkout would still
  report "not configured," because the container never actually received the values. Fixed.
- `NEXT_PUBLIC_SITE_URL` (added earlier for `sitemap.ts`/`robots.ts`/Open Graph metadata) was never
  wired as a Docker build ARG in `apps/frontend/Dockerfile` or passed through
  `docker-compose.production.yml`'s frontend build args — since Next.js inlines `NEXT_PUBLIC_*`
  vars at *build* time, not runtime, this one would have silently baked `localhost` into the
  production bundle's sitemap/OG tags forever, no matter what was set in the real `.env`. Fixed
  (mirrors the existing `NEXT_PUBLIC_API_URL` build-arg pattern exactly).

**Generated real production secrets** — `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
(`openssl rand -base64 48` each) and a random `POSTGRES_PASSWORD` — written to a new
`.env.production` file. Caught a real gitignore gap while doing this: the existing `.gitignore`
only matched `.env`, `.env.local`, and `.env.*.local`, none of which match a file literally named
`.env.production` — meaning this file would NOT have been ignored and could have been accidentally
committed with real secrets in it. Added `.env.production` explicitly to `.gitignore` and verified
with `git check-ignore -v` before writing anything into it.

**Verified the fixes for real, not just by reading the compose file**: built both production Docker
images fresh from a separate compose project (`sentinelai-launchcheck`, so the real local dev stack
was untouched throughout), brought up the full stack (postgres/redis/backend/frontend/nginx) against
a genuinely empty database using the real generated secrets, hit the same Podman aardvark-dns
gateway-address instability documented in Enhancement "Production-readiness pass" again (this time
`10.89.3.1` — a third different value across the three times this has been checked, reinforcing
it's a genuine Podman quirk and not something worth hardcoding around), fixed `NGINX_RESOLVER`
accordingly, and confirmed a real user registration through the full stack (nginx → backend →
Postgres) returns a real JWT pair. Tore the verification stack down completely afterward
(`down -v`) and confirmed the actual local dev stack was unaffected.

**Wrote `docs/DEPLOY.md`** — a concrete, copy-paste runbook for the day a real domain/host exists:
DNS, Docker install, copying the pre-filled `.env.production`, filling in the still-genuinely-blank
SMTP/Stripe/AI values, bringing the stack up, TLS (explicitly not faked — same reasoning as the
compose file's existing TLS comment), pointing the real Stripe webhook at the real domain, and a
smoke-test. Also honestly lists what's still not done even after deployment (no lawyer review of
Terms/Privacy, no error-tracking/monitoring service, no CI deploy step) rather than implying
deployment alone means "fully done."

**The actual bottleneck, confirmed once more by this pass**: every remaining step needs a real
external account (domain registrar, hosting provider, SMTP provider, Stripe, Anthropic) that only
the project owner can create — not more engineering time. This pass closed the gap between "the
code is ready" and "the deployment steps are ready," so that bottleneck is now the only one left.

## Enhancement 13: Matrix-inspired visual redesign + small/medium business positioning

Requested: shift the landing page's concept toward small/medium businesses without a security
background, and redesign the visuals to feel more distinctive — "Matrix style," an animated
sequence, a sense of depth, something that feels special rather than another generic dark SaaS
template.

**New content — built for small/medium businesses, not security teams**: a new landing-page
section ("A solution built for small and medium-sized businesses" / "You don't need to know what
a subdomain is for this to work") with four honest, real-feature-backed reassurance points (no
jargon, nothing to install, tells you what to fix first, priced for a small business) — every
point maps to an already-shipped, real capability, reframed for this audience rather than inventing
new claims. Two new FAQ entries address the same audience directly ("I'm not technical at all — is
this really for me?", "What do I actually do with the results?"). 25 new i18n keys, en/he parity
re-verified after every addition (final count re-checked, zero drift).

**New visual components, all genuinely real/working (no faked assets)**:
- `components/MatrixRain.tsx` — a real, procedurally-generated canvas "digital rain" animation
  (not a video/GIF asset, since none exists to use honestly). Respects
  `prefers-reduced-motion`, cleans up its own `requestAnimationFrame` loop and resize listener on
  unmount, capped at ~20fps (plenty for the effect, cheap on CPU). Deliberately scoped via a
  wrapper `<div>` to *only* the top hero content (headline through the stats row) — explicitly not
  extended behind the real product screenshot section below it, so the animated accent doesn't
  compete with or dilute the "this is a real, live screenshot" claim already on the page.
- `components/ScanSequence.tsx` — a looping, typed-out terminal animation illustrating the scan
  workflow (DNS → subdomains → TLS → a dramatic `⚠ CRITICAL — expired TLS certificate found: this
  site could be exploited` line → headers → score). This is the "image sequence" requested,
  implemented honestly as a procedurally-generated sequence of frames rather than fabricated
  photography/3D renders that don't exist — uses a generic placeholder domain
  (`yourbusiness.com`), never presented as a real scan (the real screenshot further down the page
  is what carries that claim). The critical-severity line dramatizes something the product
  genuinely does (flag high/critical findings — the real dashboard screenshot already shows a real
  HIGH-severity TLS finding) rather than inventing a capability.
- `components/PulseMonitor.tsx` — a continuously scrolling heartbeat/EKG waveform (pure SVG + CSS
  keyframe animation) as a literal visual metaphor for the real "24/7 continuous re-scanning"
  feature/stat already on the page — "your attack surface is watched continuously, the same way a
  heart monitor never stops."
- `components/SonarRings.tsx` — slow-expanding, fading concentric rings as a lightweight CSS-only
  depth/"tunnel" accent behind the pulse monitor. No 3D asset or WebGL scene was attempted — there's
  no 3D modeling/rendering tool in this build environment, and a rushed 3D scene without real
  assets would likely look worse than a well-executed 2D depth cue, so this is the honest
  alternative that still reads as "depth."
- `components/TiltCard.tsx` — a real, interactive 3D-tilt effect on the product screenshot, driven
  by actual `mousemove` events recalculating a CSS `perspective`/`rotateX/Y` transform every frame
  (not a static image or pre-rendered 3D asset). Disabled under `prefers-reduced-motion`.

**Two real RTL bugs found and fixed while verifying in Hebrew** (both follow the same established
pattern as `BrowserFrame`'s forced-LTR URL bar):
- `PulseMonitor`'s scrolling waveform was almost entirely cut off under `dir="rtl"` — the `w-[300%]`
  overflow technique assumes LTR overflow anchoring; fixed with an explicit `dir="ltr"` on the
  waveform's container (the translated label text outside it stays in the page's real direction).
- `ScanSequence`'s terminal content was reading right-to-left (dollar sign on the wrong side, `>`
  prefixes flipped) under Hebrew — real terminal/command output should always read LTR regardless
  of UI language, same reasoning as a code block; fixed with `dir="ltr"` + `text-start` on the
  terminal body.

**A visual bug hunted down and confirmed NOT a bug**: initial screenshots appeared to show the
Matrix rain bleeding past its intended boundary into the real-screenshot section. Debugged with
an injected debug outline (`page.evaluate` adding a colored border to the exact DOM element) rather
than guessing — confirmed the canvas and its wrapper both end exactly where intended, and the
"leakage" seen in earlier low-opacity PNG screenshots was a false read (compression/antialiasing
noise at 0.14 opacity), not an actual rendering bug. Recorded here since chasing this cost real
verification time and the resolution (it was fine all along) is itself useful to have on record.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean (including fixing a genuine
`react-hooks/set-state-in-effect` lint error in `ScanSequence.tsx` by moving the
`prefers-reduced-motion` check into a lazy `useState` initializer instead of calling `setState`
synchronously inside the effect body — the same "derive state during render" pattern already
established in `auth-context.tsx`/`organization-context.tsx`), `next build` succeeds, all 31
frontend unit tests pass unchanged, zero browser console errors (checked via Playwright's
`pageerror`/`console` listeners, not just visual inspection). Screenshotted in English and
Hebrew/RTL after each fix.

**Scope note for future work**: this pass focused the redesign on the marketing/landing page (the
highest-impact "front door" for this request) and deliberately left the authenticated dashboard
app's existing indigo UI untouched — it's already tested and familiar, and a full site-wide
re-theme is a separate, larger decision than what was asked for here.

## Enhancement 14: a real 3D network centerpiece + "alive" motion across the page

Pushed further on the same visual direction: a genuine 3D piece, and continuous (not just
on-hover) motion spread across more of the page rather than confined to one hero section.

**`components/NetworkGlobe.tsx`** — a real, continuously-rotating 3D wireframe network: ~60 nodes
placed on a sphere via a Fibonacci-sphere distribution, edges drawn between nodes closer than a
distance threshold, rendered with hand-written 3D-to-2D perspective projection (rotation matrices,
a focal-length perspective divide, back-to-front depth sorting so nearer nodes draw on top) on a
plain 2D canvas — deliberately not a Three.js/WebGL dependency, which would meaningfully grow the
JS bundle shipped to every marketing-page visitor for one visual. Reacts to real pointer movement
(tilts toward the cursor) and keeps rotating continuously; respects `prefers-reduced-motion` by
freezing the idle rotation (pointer-reactive tilt still works, since that's user-initiated, not
autoplaying). Doubles as an honest metaphor for the real product: nodes are literally what
"assets" means, edges are literally what "how they connect" means — not decoration disconnected
from what the tool does. Placed in a new section ("Your entire attack surface, in one live map")
between the small-business section and "How it works," mirrors correctly under Hebrew/RTL (globe
and text swap sides via `order-*` utilities), no horizontal overflow on mobile (checked
programmatically).

**Continuous "alive" motion, not just hover interactions**: added a new `.animate-gentle-float`
CSS keyframe (globals.css) — a small (6px), slow (6s), staggered-per-card vertical bob — to the
Features grid, the small-business points, and the Trust points, so those sections feel alive
before any interaction rather than only reacting to mouse/hover. Respects
`prefers-reduced-motion` (`motion-reduce:animate-none` on every instance).

**Extended the existing 3D tilt to the other two real screenshots**: the PDF-report and
alerts-feed spotlight images (previously only the dashboard screenshot had `TiltCard`) now tilt
toward the cursor too, for a consistent "everything responds" feel across the whole page rather
than one isolated interactive element.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, all 31 frontend
unit tests pass, zero browser console errors (Playwright `pageerror`/`console` listeners), full
backend e2e suite unaffected (37/37 — this was a frontend-only change). Screenshotted in English,
Hebrew/RTL, and mobile (390px) with explicit `scrollWidth > clientWidth` overflow checks.

## Enhancement 15: extend the visual language across the whole site, not just the landing page

Requested directly: the new matrix/ambient visual treatment shouldn't be confined to one page.

**New `components/AmbientBackground.tsx`** — extracted the landing page hero's matrix-rain +
dot-grid + glow backdrop into a single reusable component (it was inline, one-off markup before)
so every other page gets the identical treatment instead of a copy-pasted variant that could drift.
The landing page itself was refactored to use it too, so there's now exactly one implementation.

**Applied consistently across the rest of the public site**:
- `/features`, `/pricing`, `/contact` — ambient background behind each page's header.
- `/features` — added the same staggered `gentle-float` to its feature-card grid as the landing
  page's Features section (previously only the landing page had it).
- `/pricing` — deliberately left the pricing cards themselves *without* floating/tilt: this page's
  job is stable, scannable side-by-side comparison, and continuous motion would work against
  someone trying to compare four plans — a judgment call worth recording, not an oversight.
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` — all five
  authentication pages now share the same ambient backdrop as the marketing pages, so the "front
  door" before login feels like the same product as the marketing site in front of it.

**Extended into the authenticated dashboard app too, deliberately more conservatively**: added the
same `MatrixRain` to `(dashboard)/layout.tsx`'s main content area, but at roughly a third the
opacity of the marketing pages (0.05 vs 0.12) and just as ambient background texture — this is a
working data tool people use daily to manage real security findings, not a landing page, so the
goal here was "the whole product visually feels like one thing" rather than "make a visual
statement" that could compete with data readability. Found and fixed a real bug while wiring this
up: tried to force the canvas to viewport-`fixed` positioning by appending a `fixed` class on top
of `MatrixRain`'s own `absolute` class — two Tailwind utility classes that set the same CSS
property don't reliably resolve by the order they appear in a `className` string (only by their
order in the generated stylesheet, which isn't controlled here), so this could easily have
silently done nothing. Fixed by wrapping `MatrixRain` in its own dedicated `fixed inset-0`
container instead of trying to override its internal class.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds (all locales/
routes), all 31 frontend unit tests pass, full backend e2e suite unaffected (37/37). Screenshotted
every touched page (features, pricing, contact, login, register, and a real logged-in dashboard
view) with zero browser console errors, plus explicit mobile (390px) overflow checks on all five
public pages — none found.

## Enhancement 16: sweep the remaining pages/components — with reasoned exceptions, not gaps

Went through every remaining page and component systematically rather than stopping at a few more
spots, per direct instruction not to leave the job half-done.

**Added real 3D/motion to**:
- `SecurityScoreCard.tsx` — the circular score gauge now sits in a `TiltCard` (hover-driven 3D tilt).
- The dashboard's `RiskChart` (trend chart) — wrapped in `TiltCard` at its usage site in
  `dashboard/page.tsx`. Confirmed `recharts`' `ResponsiveContainer` still measures/renders
  correctly through a CSS-transform wrapper (transforms don't trigger reflow).
- `/pricing` and the in-app `/billing` plan cards — both gained hover-only `TiltCard` tilt.
  Confirmed real click-through still works after wrapping (clicked "Upgrade" through the tilt
  wrapper and got the real, honest "not configured" error from the actual API call — not a
  cosmetic no-op).
- `/terms`, `/privacy` — added the shared `AmbientBackground` to the title/date header only.

**Deliberately did NOT add continuous motion to** (recorded here so it reads as a judgment call,
not incomplete work):
- `AssetCard`/`DomainAssetCard` and any list built from them (the Domains page's tracked-asset
  list, the dashboard's findings list) — these render as a vertical `space-y-*` stack of repeated
  rows. Continuous idle float/tilt on every row of a list someone is actively scanning for
  information is a real usability regression (visually noisy, harder to track which row is which),
  not "alive" in a good way. Same reasoning already applied to `AssetCard` when it was first built.
- The pricing/billing cards specifically use hover-only tilt (not the idle `gentle-float` used on
  marketing feature grids) for the same reason as before: a plan someone is actively comparing
  shouldn't be moving on its own.
- Legal text body copy on `/terms`/`/privacy` — motion behind dense text people need to actually
  read would hurt the one thing that page needs most (readability), so only the header got the
  ambient treatment.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, all 31 frontend
unit tests pass unchanged (including the existing `SecurityScoreCard.test.tsx` suite, unaffected by
wrapping the gauge in `TiltCard`), full backend e2e suite unaffected (37/37). Screenshotted pricing,
terms, privacy, and a real logged-in dashboard/billing view with zero console errors; explicitly
confirmed via `page.evaluate` that hovering a pricing card produces a real non-identity CSS
`transform` (not just a static screenshot assumption); explicitly re-confirmed the billing page's
"Upgrade" button still fires a real API call through the `TiltCard` wrapper; mobile (390px)
overflow checked on every newly-touched page — none found.

## Enhancement 17: replace the site-wide background with a live global network map

Requested a background that's alive, shows information, and reads as professional/trustworthy —
site-wide, not just one page. Matrix-style code rain (used since Enhancement 13) leans more
"hacker movie" than "enterprise security vendor"; a glowing world map with pulsing data
connections is the established visual language serious B2B security/threat-intelligence products
actually use (the genre convention this request was pointing at).

**New `components/WorldMapBackground.tsx`** — a real, continuously-animating canvas background:
a coarse dot-matrix world map (hand-authored equirectangular point clusters approximating each
continent — deliberately stylized/low-fidelity, not a precise geographic dataset, and not claiming
to be real telemetry data, same honesty standard as every other generated visual on this site) with
several concurrent glowing arcs continuously spawning, drawing in along a gentle bowed flight-path
curve between random points, holding lit briefly, then fading out — never a static image. Respects
`prefers-reduced-motion` (freezes arc animation, still shows the static dot map).

**Wired into the already-centralized places** (from Enhancement 15/16's `AmbientBackground`
extraction, this was a one-file swap that cascaded everywhere): every marketing page, every auth
page, and terms/privacy headers now show the world map instead of matrix rain. The authenticated
dashboard shell (`(dashboard)/layout.tsx`, which references the background directly rather than
through `AmbientBackground` since it needs a different, much fainter opacity) was updated the same
way — 0.18 opacity there vs 0.55 on marketing pages, preserving the same "ambient texture, not a
visual statement" restraint established for the dashboard in Enhancement 15.

`MatrixRain.tsx` itself was left in place (a real, still-working, tested component) rather than
deleted, in case it's wanted again for a specific accent later — it's just no longer referenced
by any page after this swap.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, all 31 frontend
unit tests pass, full backend e2e suite unaffected (37/37), zero browser console errors. Screenshotted
the landing page hero (both a narrow and a 1920px-wide viewport to see more of the map), the
authenticated dashboard (confirming the faint version doesn't compete with real data), and
Hebrew/RTL (the map itself needs no mirroring — it's a symmetric geographic visual, not directional
text/UI). Mobile (390px) overflow checked — none found.

## Enhancement 18: plain-language, honestly-scary findings — and more for small business owners

Requested: make the alerts scarier, drop jargon like "TLS," and make everything comfortable for
someone who understands nothing about security — plus more small-business content.

**New `lib/plainLanguageFindings.ts`** — a pure display transform, `toPlainLanguage(title,
description, locale)`, pattern-matched against the *real* finding titles the risk engine actually
generates (every one of the ~10 real patterns in `risk-engine.service.ts` is covered: missing/
invalid/self-signed/expired/expiring TLS certificates, missing security headers, disclosed server
versions, large IP footprints, recent asset changes). This never invents a different finding — it
only changes the wording, the same "real data, friendlier presentation" pattern already used for
the SecurityScoreCard letter grade. Deliberately "scary but true": dramatizes real consequences
(a real browser warning page, unencrypted form data, a known attack technique) rather than
inventing scarier ones. An unrecognized finding type falls back to the real original text
unchanged rather than guessing at a translation that might not be accurate. 14 unit tests (7→14
after adding locale coverage).

**Found and fixed a real localization gap while verifying in Hebrew**: the first version of this
mapping only had English output, so a Hebrew-UI user got an English "plain language" headline
injected into an otherwise-fully-Hebrew page — worse than doing nothing for exactly the
non-technical audience this feature targets. Fixed by making every mapping locale-aware (real
Hebrew translations for all 10 finding types, not machine-translated placeholders), verified live
in the actual dashboard with a real domain's real finding.

**`AlertCard.tsx`** gained an optional `technicalDetail` prop: the plain-language headline is now
the default, leading view, with the real original technical wording tucked behind a "Show the
technical detail" toggle — nothing is hidden, it's just no longer the first thing someone has to
decode. Urgent findings (CRITICAL/HIGH) also get a pulsing icon and an "ACTION NEEDED" label,
matched to the finding's real severity rather than an independently-invented urgency level. Wired
into the dashboard's real findings list (the only place in the app that renders raw risk-engine
findings — confirmed via a repo-wide search before assuming this was the only spot).

**Marketing copy**: the landing page's `ScanSequence` terminal animation no longer says "TLS" (or
"DNS"/"HTTP" jargon) anywhere — every step rewritten in plain language, and the critical-finding
line now reads "your website is NOT secure: hackers could steal customer data today" instead of
naming a certificate. Added a new "The same real finding, two ways" comparison section to the
landing page showing the *exact* real finding side by side — raw technical wording next to the new
plain-language translation — proving the claim rather than just asserting it. Added FAQ #8
("Will the alerts be full of technical terms I won't understand?") addressing this directly, plus
kept the small-business messaging consistent throughout (18 new i18n keys, en/he parity
re-verified, zero drift).

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, all 45 frontend
unit tests pass (42 previous + new locale-aware coverage), full backend e2e suite unaffected
(37/37). Screenshotted the real dashboard findings list in both English and Hebrew (confirming the
technical-detail toggle reveals the real original English text regardless of UI language, since
that's genuinely what the backend generated), and the new landing-page comparison section. Mobile
(390px) overflow checked — none found.

## Enhancement 19: landing-page audit — a real mobile nav bug, and the last of the jargon

Requested a broad "improve the landing page" pass (typography/spacing/mobile/animation/loading/
business language). Rather than redoing work already covered by Enhancements 13-18 (which already
delivered the animated backgrounds, 3D pieces, plain-language findings, and mobile checks), this
pass started by actually loading the live page at desktop and mobile viewports and reading the
result, to find what was still real and true versus already solved.

**Found and fixed a real mobile bug**: at a 390px viewport, `MarketingNav`'s language switcher
button rendered visible and cramped next to the logo despite being wrapped in `hidden sm:inline-flex`
— the same class of bug already documented in Enhancement 15 (two Tailwind utilities that set the
same CSS property, here `display`, don't reliably resolve by their order in a `className` string,
only by their order in the generated stylesheet). `LanguageSwitcher`'s own root `className` already
hardcodes `inline-flex` in its base classes, so passing `hidden sm:inline-flex` from the caller put
two competing `display` utilities on the same element; `inline-flex` won at 390px, so the button
never actually hid. Fixed the same way Enhancement 15 did: wrap the component in its own dedicated
`<div className="hidden sm:block">` container instead of trying to override its internal class.
`Sidebar.tsx`'s and the four auth pages' usages were unaffected (they only pass non-`display`
utility classes) and were left alone.

**Found and fixed the last "attack surface" jargon**: Enhancement 18 removed technical jargon
(TLS/DNS/HTTP) from findings and the `ScanSequence` terminal, but "attack surface" — a real security
term, not something a plumber or bakery owner uses — was still the hero eyebrow, the hero subtitle,
and eleven more headings/descriptions across the landing page and the Business plan's pricing
description. Rewrote all of them (both `en` and `he`, keeping parity) to plain business language —
"your online footprint," "protect your business online," "everything hackers could find" — without
changing what any of them actually claim. Left the term as-is in `dashboard`/`reports`/`alerts`
i18n keys used only inside the authenticated app (out of scope for a landing-page pass; logged as
follow-up for whichever phase touches those pages next).

**Typography, spacing, animation, and load performance**: checked rather than assumed. Fonts already
load via `next/font/google` (self-hosted, no render-blocking external request) since this file's
Step 3. `next build` already emits `robots.txt` and `sitemap.xml`. The hero image lazy-load warning
seen once during testing (`Image ... detected as Largest Contentful Paint`) turned out to be a
Playwright `scrollIntoViewIfNeeded` artifact (jumping straight to a below-the-fold section before
the image had a chance to paint), not a real bug — confirmed by reloading and waiting normally,
after which the image rendered correctly; left it on Next's default lazy loading, since forcing
`priority` on a section three screens down would genuinely slow the real first paint down, the
opposite of what "faster loading" asked for.

## Enhancement 20: dashboard redesign — real org-wide data, and a mobile bug affecting the whole app

Requested the dashboard show security score, assets, domains, active/resolved alerts, latest scan,
risk timeline, top risks, recent changes, upcoming certificate expiration, and quick actions, all
updating dynamically. Audited what the real dashboard actually rendered (registered a real account,
added a real domain, ran a real scan) rather than assuming from the code, per the same discipline as
Enhancement 19.

**Real gaps found**: the dashboard had a security score, per-domain findings, and a risk trend chart,
but nothing else on the list — no asset/alert counts, no latest-scan status, no ranked top risks, no
certificate-expiry warning, no quick actions, and "recent activity" only ever showed "Domain added,"
never anything a real scan produces.

**New `GET /dashboard/summary` endpoint** (`dashboard/dashboard.service.ts`) — one org-scoped
aggregate query over tables that already exist and are already populated by real scans
(Domain/Asset/Finding/Scan/Alert), not a new data model: total domains/assets, active vs. resolved
alert counts (real `Alert.read` state — `Finding.status` was considered for this instead, but every
finding created anywhere in this codebase defaults to `OPEN` and nothing ever transitions it, so
that enum is currently dead; sourcing "resolved" from an unreachable status would have been exactly
the kind of fabricated-looking number this build has consistently avoided elsewhere), the most
recent completed scan, the top 5 open findings across every domain's own latest scan (ranked by
real severity, not just whichever domain happened to scan most recently), and upcoming certificate
expirations sourced from the real `daysUntilExpiry` already captured by `ssl.service.ts` at
discovery time. Covered by a new `test/dashboard.e2e-spec.ts` (membership authorization + real
counts derived from a real scan + a real read/unread split after marking alerts read), following
this repo's established pattern of e2e (not mocked-Prisma) coverage for this class of org-scoped
query service.

**New frontend**: `StatTile`, `CertificateExpirations`, and `QuickActions` components, plus a
`useDashboardSummary` hook. "Recent activity" now renders the real `Alert.message` feed (e.g. "New
subdomain discovered: beta.iana.org") instead of a client-synthesized "Domain added" event —
`Alert.message` is already real, human-written text generated by `ScanProcessor`, so this is a
strictly better real data source, not new copy to maintain. Verified end-to-end against a live
scan of `iana.org`: 12 real assets discovered, 12 real alerts, a real 78/100 "Fair" score, three
real findings, and a real ranked top-risks list — all before manually refreshing anything (the
existing `refetchInterval` polling pattern already used by `useDomainRisk` picked it up).

**Found and fixed a real, pre-existing mobile bug affecting every authenticated page, not just the
dashboard**: `Sidebar` was a fixed `w-64` column with no responsive fallback at all — on a real
390px viewport it didn't collapse, it just squeezed every dashboard-app page's content into a
sliver next to it (long words wrapping one-per-line). This predates this session's changes and
would have affected Domains/Reports/Alerts/Settings/Billing identically, so it was fixed at the
shared layout level: `Sidebar` is now a proper off-canvas drawer below `lg` (backdrop, close button,
closes on navigation, real unread-count badge on its mobile toggle) and the unchanged permanent
column at `lg` and up. Caught and avoided a subtle repeat of the exact class of bug documented in
Enhancement 15/19 while building this: the open/closed state was briefly implemented as two
competing unprefixed `translate-x-*` utility classes present on the element at the same time
(closed-by-default plus an appended open override) — same "two utilities, same CSS property, order
doesn't resolve reliably by className string position" trap as before. Fixed by making the mobile
open/closed classes fully mutually exclusive per render (never both present at once), and relying
on Tailwind's `lg:` responsive layer — which *is* reliably ordered after the base layer — for the
desktop override instead. Verified in both English (LTR, drawer slides from the left) and Hebrew
(RTL, drawer correctly slides from the right instead).

**Also fixed while touching these pages**: the last two remaining "attack surface" jargon spots
outside the marketing site (`reports.subtitle`, `alerts.subtitle`), for the same reason as
Enhancement 19.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds, all 45 frontend
unit tests pass. Backend: `tsc --noEmit` clean, `eslint` 0 errors (pre-existing warnings only,
unrelated to this change), `nest build` succeeds, all 35 unit tests + all 40 e2e tests pass
(`--runInBand`; jest's default parallel workers each run a real scan-processing BullMQ worker
against the same shared Redis/Postgres, and enough concurrent real DNS/HTTP scans racing each
other in this sandboxed environment occasionally exceeds individual tests' polling budget — a
pre-existing characteristic of this real, non-mocked e2e suite, not a regression from this change;
confirmed by re-running serially). Screenshotted the populated dashboard, the mobile drawer open/
closed/backdrop-click-closed, and Hebrew/RTL, all against a real live scan of a real domain.

**Found, not fixed here — flagged for Phase 4 (security scoring engine)**: `RiskEngineService.
analyzeDomain()` computes its score from each finding's real fractional/capped `points` (e.g. a
partial-header-set deduction scaled by `missingHeaders.length / 6`), logs that real weighted score
at scan time, but never persists it — only the `Finding` rows (severity/title/description) are
saved. `RiskEngineController.scoreFromFindings()` (what the dashboard actually displays) then
recomputes a *different* score from those persisted findings using a flat per-severity point table,
silently ignoring the original fractional weighting and any count-based capping. The two numbers
can disagree, and only one of them is ever shown to a customer — exactly the "two formulas for the
same real number" trust problem this risk engine was designed to avoid. Never surfaced a visibly
broken value in this pass (the displayed score is always a clean integer), so it's a methodology
inconsistency rather than a rendering bug — but it means the score currently shown isn't always the
one the engine actually intended. Left for Phase 4 rather than fixed piecemeal here, since the real
fix (persist each finding's actual deduction so there's exactly one source of truth for the score)
is itself a schema change that phase's own scoring-engine work should own.

**Verified for real**: `tsc --noEmit` clean, `eslint` clean, `next build` succeeds (all locales/
routes, robots.txt/sitemap.xml included), all 45 frontend unit tests pass unchanged. Screenshotted
the hero and nav at 1440px and 390px in both English and Hebrew/RTL before and after the nav fix —
confirmed the language switcher now genuinely disappears below the `sm` breakpoint instead of just
looking like it should. Zero browser console errors across every screenshot.

## Enhancement 21: real domain-ownership verification, and a guided onboarding flow

Requested a 5-step post-registration flow: create organization, verify domain ownership, run first
scan, view dashboard, enable alerts. Organization creation was already bundled into registration
(Step 5) and viewing the dashboard already existed — audited the rest for real before building
anything.

**Found a real, dead feature**: `Domain.verificationToken` has been generated at domain-creation
time since Step 5, but nothing anywhere ever checked it — `Domain.verified` could never become
`true`. "Verify domain ownership" wasn't a partially-built feature, it was a schema field with no
code path at all.

**Built real DNS TXT-record verification** — the industry-standard pattern (the same one Google
Search Console/Stripe/etc. use): `DomainsService.verify()` (new `PATCH /domains/:id/verify`) does a
real DNS TXT lookup via the discovery module's existing `DnsService` (reused, not reimplemented —
extracted into its own `DnsModule` so both `DomainsModule` and `DiscoveryModule` can use it without
a circular import) and only ever flips `verified` to `true` if it actually finds
`sentinelai-verify=<the real token>` in the domain's real DNS. Verification is optional, not a
gate — scanning already works without it, matching how the rest of this product treats "verified"
as a trust signal rather than a hard requirement (nothing else in the schema depends on it either).
Covered by 3 new unit tests (`domains.service.spec.ts`, mocked `DnsService` — deterministic
coverage of the match/no-match/already-verified branches) and 3 new e2e tests
(`domains.e2e-spec.ts` — real membership authorization, and a real DNS lookup against `example.com`
correctly refusing to verify since that real domain genuinely has no such record).

**New frontend**: `DomainVerification` (shows the real TXT record to add, a "Verify now" button,
and the real error message when the record isn't found yet) and `AddDomainForm` (extracted from the
Domains page so both it and the new onboarding flow share one implementation instead of two). The
Domains page itself gained per-domain verification UI — this needed to be durably accessible there,
not just inside the onboarding flow, for anyone who adds a domain after their first one.

**New `OnboardingSteps`** component replaces the dashboard's old bare "add your first domain" panel
with a real 5-step tracker, each step's "done" state driven by actual data (org existence, domain
count, scan completion) rather than hardcoded: step 5 ("enable alerts") doesn't invent a fake toggle
— alerts are already unconditionally on for HIGH/CRITICAL findings (Step 8's `ScanProcessor`), so
this step honestly says so and links to the real Alerts page instead of pretending there's a switch
to flip. The whole tracker disappears once a real scan completes, handing off to the full Phase-2
dashboard.

**Caught and fixed a real bug in my own draft of this component**: the vertical connecting line
between steps used `last:hidden` on each step's own two-child wrapper, which is `:last-child`
*within that wrapper* — true for every step's connector, not just the actual last step, so every
connector would have incorrectly hidden itself. Fixed with an explicit `isLast` prop instead of
relying on CSS structural selectors across elements that aren't real array-mapped siblings.

**Verified for real**: registered a brand-new account end-to-end through the actual UI (not just
the API) — organization auto-created, added `iana.org`, saw the real TXT-record instructions,
clicked "Verify now" and got the real "not found yet" error (since this environment doesn't control
that domain's DNS), ran the first scan, watched the wizard hand off to the full dashboard once the
real scan completed. `tsc --noEmit` clean on both apps, `eslint` clean (0 errors) on both, `nest
build`/`next build` succeed, backend 38 unit + 43 e2e tests pass (`--runInBand`, same pre-existing
parallel-worker note as Enhancement 20), frontend 45 unit tests pass.

## Enhancement 22: single-source-of-truth scoring, a real DNS category, and a serious re-scan bug

Requested an "enterprise-grade" scoring engine: 0-100, categories (SSL, DNS, headers, exposure,
certificates, configuration), historical trend, and every score explaining WHY. The trend already
existed (Enhancement 20 wired `RiskChart` up for real). The rest had two real, pre-existing gaps
this pass found by reading the actual code rather than assuming from the category list.

**Fixed the two-different-scoring-formulas bug flagged (but deliberately not fixed) in Enhancement
20**: `RiskEngineService.analyzeDomain()` computed a real, weighted score at scan time (including a
fractional deduction for partial-header-set findings) and logged it, but never persisted it —
`RiskEngineController.scoreFromFindings()` then silently recomputed a *different*, cruder score
from the same findings using a flat per-severity table. Fixed at the root: `Finding` gained a real
`points` column (migration `add_dns_asset_type_and_finding_points`) that persists the exact,
rounded-to-a-whole-number deduction the engine actually decided for that finding — `Math.round`
applied once, centrally, to every deduction, rather than leaving the one fractional source (missing-
header count scaled by `/6`) to leak a non-integer score. The controller now sums `finding.points`
directly instead of re-deriving an approximation, so the score can never again disagree with the
number the engine that produced it actually computed. Pre-migration findings default to `points: 0`
(an honest limitation, not silently patched over — a domain's very next real scan after this change
produces trustworthy numbers; scores read from scans older than this migration will look
artificially high until then).

**Added a real DNS category** — `FindingCategory.DNS` existed in the schema since Step 4 but nothing
ever produced a DNS-category finding. Added real SPF and DMARC TXT-record checks: `DiscoveryService`
now does a second real DNS lookup at `_dmarc.<hostname>` (DMARC lives at a fixed subdomain, not the
domain's own records) alongside the lookup it already performed, and persists a new `AssetType.DNS`
asset recording whether each record is genuinely present — reusing the discovery module's existing
`DnsService` rather than having the risk engine perform its own network I/O (extracted into a
dedicated `DnsModule`, shared with `DomainsModule`'s Enhancement 21 verification work, avoiding a
circular import between the two). `RiskEngineService.evaluateDns()` reads that real asset and flags
a missing SPF and/or missing DMARC record as separate MEDIUM findings — the same real email-spoofing
risk a dedicated email-security scanner checks, not an invented signal. Verified live against
`iana.org`: correctly found *no* DNS finding, since that real domain genuinely has both records —
confirming the check reads real DNS, not a canned result.

**Exposed the real "why"**: `/risk/domains/:id/latest` now also returns a `categories` breakdown —
grouping the same persisted findings the score is summed from by category, so it can never disagree
with the number beside it. New frontend `ScoreBreakdown` component renders it directly under the
score circle (plain-language category names, not raw enum values).

**Found and fixed a serious, unrelated pre-existing bug while verifying this end-to-end**: clicking
"Scan now" on a domain that already had one completed scan silently did nothing visible, forever.
`useDomainRisk`'s polling (`refetchInterval`) stops for good the first time `hasScan` becomes `true`
and never resumes; `useTriggerScan`'s `onSuccess` only invalidated the query once, immediately after
the `POST /scans` call resolved — moments before the real scan (asynchronous, ~25-30s of real DNS/
HTTP/TLS work) had actually finished. The score, findings, and breakdown a user saw after clicking
"Scan now" a second time were simply the *previous* scan's results, indefinitely, until a manual
page reload. Fixed by having `useTriggerScan` poll (bounded, 20 attempts × 3s) until the query's
real `scanId` actually changes from what it was before the click, confirmed live: triggered a real
second scan against `iana.org` and watched the score, findings, breakdown, and trend chart all
update in place with the new real scan's data (100 → 76, a new "Fair"/C grade) with no reload.

**Verified for real**: added a DNS asset with real SPF/DMARC metadata to unit-test fixtures (2 new
tests) and a persisted-`points`-is-always-an-integer test (1 new test) to `risk-engine.service.spec.ts`
— backend now 41 unit + 43 e2e tests, all passing. `tsc --noEmit` clean, `eslint` clean (0 errors)
on both apps, `nest build`/`next build` succeed, frontend 45 unit tests pass. Screenshotted the live
dashboard in English and Hebrew/RTL against two real, sequential scans of `iana.org`, confirming the
score/breakdown/trend genuinely update between them.

## Enhancement 23: an AI Security Advisor a user can actually see and click

Requested every finding show a business explanation, technical explanation, recommended fix,
estimated difficulty, estimated business impact, priority, and an executive summary, in plain
English first. The backend half of this (`AiService`/`AiController`, Step 11) has existed since
2026-07-07, honestly inert without a real `AI_API_KEY` this build environment doesn't have — but a
repo-wide search turned up **zero** references to it anywhere in the frontend. The entire feature
had no UI: no button to request an analysis, nowhere to see `aiExplanation`/`aiBusinessImpact`/
`aiRemediation` even if they existed. "Technical explanation" and "business explanation" were
already covered (a finding's own real `title`/`description` *is* the technical explanation; the
existing `aiExplanation` is the plain-language one) — difficulty and priority were genuinely
missing from both the schema and the AI prompt itself.

**Extended the real schema and prompt** — `Finding` gained `aiDifficulty`/`aiPriority` columns
(migration `add_ai_difficulty_and_priority`). `AiService.analyzeFinding()`'s prompt now asks for
five labeled sections instead of three; a difficulty independent of severity (a CRITICAL finding
can be a five-minute config fix; a LOW one can need a real migration) and a priority that factors in
both severity and how easy the fix is. The model's raw word is normalized against the small fixed
set it was asked for, with a safe, honest middle-value fallback (`MODERATE`/`MEDIUM`, never silently
picked as "easy"/"low" in a way that could understate real urgency) if it returns something
unparseable — covered by 8 new unit tests in `ai.service.spec.ts` exercising the parsing logic
directly (well-formed output, case-insensitivity, missing sections, unrecognized words) plus the
honest not-configured failure path, none of which require a real API key.

**Found and fixed a third instance of the same recurring bug** (Enhancement 20 and 22 already fixed
two): `AiController`'s executive-summary endpoint recomputed its own score from `Finding.severity`
via a flat table, a third independent formula alongside the two already unified onto `finding.points`
— fixed to sum the same real persisted `points` as everywhere else.

**New frontend**: `AlertCard` (the one finding-rendering component used by both the dashboard's own-
domain findings list and its org-wide top-risks list) gained a "Get AI analysis" action per finding,
and — once analyzed — a labeled panel (business impact, recommended fix, a priority badge, a
difficulty badge) styled distinctly from the plain-language headline above it, matching "plain
English first" without hiding the extra detail. Both call sites (`dashboard/page.tsx`'s findings-
for-primary-domain grid and its top-risks list) wired the real `Finding.id` and existing AI fields
through — the dashboard-summary endpoint's `topRisks` mapping (Enhancement 20) had to be extended to
actually include them, since it was only selecting a handful of fields from each finding.

**No real Anthropic key exists in this build environment**, so — same honest discipline as every
other credential-gated feature here — this could not be verified against real generated text.
Verified instead exactly what's real and checkable: clicked "Get AI analysis" against the live app
and confirmed the real `503` surfaces as a clear, correctly-worded inline message ("AI analysis is
not configured — set AI_API_KEY...") rather than a crash or a silent no-op. The feature activates
for real the moment a real key is set, with no further code changes.

**Verified for real**: backend now 49 unit + 48 e2e tests (a new `ai.e2e-spec.ts` covers real
membership authorization plus the real, live 503/403 paths against a real scan's real finding).
`tsc --noEmit` clean, `eslint` clean (0 errors) on both apps, `nest build`/`next build` succeed.
Frontend 45 unit tests pass — required extending the shared `renderWithIntl` test helper with a
real `QueryClientProvider` (the first component test to exercise a component that calls a React
Query hook internally), a reusable fix for any future component test in the same situation, not a
one-off workaround.

## Enhancement 24: real charts, branding, and an executive summary in the PDF report

Requested company logo, security score, charts, executive summary, findings, recommendations,
branding, and professional design in the generated PDF. The real PDF generator (Step 12) already
covered score/assets/findings/recommendations in plain text — genuinely missing were charts, an
executive summary, and any real visual branding (it was pure black-on-white text).

**Found a fourth instance of the same recurring score-formula bug** (Enhancements 20, 22, and 23
already fixed three): `report.processor.ts` computed its own score from `Finding.severity` via yet
another flat table. With four independent copies of the same logic having drifted or risked
drifting, this was the point to stop patching each one and fix the actual root cause: extracted
`scoreFromFindings`/`categoryBreakdown` into a shared `risk-engine/scoring.util.ts` and made all
four call sites (`RiskEngineController`, `AiController`, and now `ReportProcessor`) import the one
real implementation. A report's score can no longer disagree with the dashboard's for the same
scan — structurally, not by convention.

**Real charts, not decoration**: a proportional horizontal score bar (filled to the real score's
exact percentage, colored by the same bands the dashboard uses) and a category-breakdown bar chart
(one real bar per category with `points > 0`, length proportional to its real deduction, generated
from the exact same `categoryBreakdown()` the dashboard's "Why this score?" panel reads).

**Real executive summary, no fabrication**: uses the real Anthropic-generated summary when
`AI_API_KEY` is configured (there is none in this build environment); otherwise falls back to a
real, deterministic paragraph computed directly from the scan's own numbers (score, finding count,
top-deducting category, count of high-severity-or-above findings) — never invented-sounding prose
standing in for an inactive feature.

**Real branding, honestly**: checked `apps/frontend/public` before claiming this — there is no
logo image file anywhere in this codebase. Rather than fabricate a graphic, the report's header
renders the exact same real wordmark ("Sentinel" + indigo "AI") every other surface of this product
uses, plus a brand-colored stripe across the top of the page. Added real page numbers via
`bufferPages`/`bufferedPageRange`.

**Found and fixed a real rendering bug while verifying the new chart**: the category-breakdown
chart draws each row at explicit absolute x/y coordinates (needed for the bar itself), which left
pdfkit's internal text cursor sitting at the rightmost label's position — verified via
`pdftotext -layout` that every section after it (Assets, Findings, Recommendations) was wrapping
into an unreadable single-word-per-line column pinned to the right edge of the page. Fixed by
explicitly resetting the cursor's x-position back to the page margin after the chart. (A red
herring during debugging: the fix appeared not to work at first — actually a stale Jest transform
cache serving pre-fix compiled output, not a logic error; `jest --clearCache` resolved it.)

**Verified for real**: a new `test/reports.e2e-spec.ts` generates a real report end-to-end via the
real BullMQ worker and confirms a real, well-formed PDF (`%PDF-` magic header, non-trivial size,
correct authorization). Beyond automated assertions, manually inspected the actual rendered output
both ways a PDF can honestly be checked in this environment: `pdftotext -layout` (confirmed the
real layout, no wrapping regressions) and rendering an actual page to a PNG via `pdftoppm` (visually
confirmed the score bar, category chart, and branding render correctly) against a real report
generated through the live UI for a real scan of `iana.org`. Backend now 51 e2e tests (10 suites) +
49 unit tests, `tsc --noEmit`/`eslint` clean on both apps, `nest build`/`next build` succeed,
frontend 45 unit tests pass.

## Enhancement 25: Slack/webhook delivery, digests — and a real, pre-existing SSRF gap found and closed

Requested: Email (already real, Step 5/9), Slack, Webhook, Daily Summary, Weekly Summary, Critical
Alerts (already real — HIGH/CRITICAL findings already email OWNER/ADMIN in real time, Step 9).
Slack/webhook/digests were genuinely missing: no schema, no delivery, no settings UI.

**New `NotificationSettings`** (1:1 per organization, migration `add_notification_settings`):
`webhookUrl`/`slackWebhookUrl` (both real HTTPS URLs an org's OWNER/ADMIN configures for
themselves — view is open to any member, changing it is manager-only via the same
`assertManagerMembership` check invitations/billing already use), and `dailyDigestEnabled`/
`weeklyDigestEnabled` (both default off — nobody gets a summary they didn't ask for).

**Real delivery, not stubs**: `WebhookService.sendWebhook()` (generic JSON POST) and
`sendSlackMessage()` (Slack's actual "Incoming Webhook" format, `{"text": "..."}` — the entire
integration surface Slack needs; no app install/OAuth required for a workspace to receive these).
Wired into `NotificationProcessor` alongside the existing email delivery, so every channel an org
configures fires from the exact same real HIGH/CRITICAL alert, not a separately invented trigger.
`DigestService` adds two real `@Cron` jobs (daily 8am, weekly) that query real `Alert` rows created
since the last window and email them via a new `EmailService.sendDigestEmail()`.

**Found and closed a real, pre-existing SSRF gap while building the webhook feature** — discovered
because a real local-HTTP-server unit test for the new `WebhookService` unexpectedly succeeded
against `127.0.0.1` despite the exact same `safeLookup` guard `http.service.ts`/`ssl.service.ts`
already used for real domain scans (Step 7/18's security review). Root cause: Node's `net`/`http`/
`tls` modules only invoke a custom `lookup` callback when the connection target needs real DNS
resolution — when the target is *already a literal IP address*, Node connects directly and never
calls `lookup` at all, so `safeLookup` silently never ran for that case. Since this app's own
domain-name validation (`HOSTNAME_REGEX`) happens to accept all-numeric labels, a user could
register a "domain" of literal `169.254.169.254` (the cloud-metadata SSRF target the guard's own
docstring names) or `127.0.0.1` and this backend's real scanner would connect to it directly,
completely unguarded — a real vulnerability in an already-shipped, previously-reviewed feature, not
something new this session introduced. Fixed at the root: added
`assertHostnameNotLiteralBlockedIp()` to `ssrf-guard.ts` (a synchronous pre-connection check that
covers exactly the case the `lookup` callback structurally cannot) and now call it at all three real
call sites — `http.service.ts`, `ssl.service.ts`, and the new `webhook.service.ts` — before ever
issuing the request. `WebhookService`'s guard is dependency-injected (defaulting to the real one) so
unit tests can verify actual HTTP/JSON delivery mechanics against a real local server without that
server's own loopback address being (correctly) rejected, while a separate test proves the real
default still blocks both a literal loopback IP and a hostname that resolves to one.

**New frontend**: a "Notification channels" section on Settings (webhook/Slack URL inputs, digest
checkboxes) — verified live: saved a real webhook URL and daily-digest toggle, reloaded the page,
confirmed both persisted for real.

**Verified for real**: backend now 57 unit tests (new `webhook.service.spec.ts` against a real local
HTTP server, 5 new `ssrf-guard.spec.ts` cases for the literal-IP fix) + 56 e2e tests (12 suites,
including new `notification-settings.e2e-spec.ts` covering real membership authorization and real
persistence). `tsc --noEmit`/`eslint` clean on both apps, `nest build`/`next build` succeed,
frontend 45 unit tests pass.

## Enhancement 26: the remaining trust pages — Security, Status, Roadmap, About

Requested: Security page, Privacy Policy, Terms, Status page, FAQ, Roadmap, Contact, About.
Privacy/Terms/Contact/FAQ already existed (Steps 5/14). Security, Status, Roadmap, and About did
not exist at all.

**Extracted `LegalPageLayout`** from the identical ~30-line JSX shell `terms/page.tsx` and
`privacy/page.tsx` had each copy-pasted — about to become a 5th and 6th copy for the new pages, so
this was the moment to share it instead. Both existing pages refactored onto it with no visual
change (verified).

**Security page**: every claim on it describes something actually implemented in this codebase,
checked against the real source rather than written aspirationally — read-only discovery (Step 18's
review), the SSRF guard including this session's literal-IP fix (Enhancement 25), Argon2id +
rotating refresh tokens (Step 5), per-IP rate limiting and the real CSP/HSTS headers this app's own
responses already carry.

**Status page — a real live check, not a fabricated uptime record**: this build has no real
monitoring pipeline generating historical uptime data, so a typical status-page "99.98% over 90
days" chart would be invented. Instead added a real, honest `GET /health` endpoint (new
`HealthModule`, unauthenticated, genuinely runs `SELECT 1` against the real database rather than
returning a hardcoded response) and a client page that polls it live every 15s. The page only ever
claims to know the current state, which is the one thing it can honestly check — covered by a real
e2e test hitting the real endpoint.

**Roadmap page**: every item is a real, currently-true gap checked against the actual codebase (not
an invented feature list) — plan-based scan frequency (still one daily sweep for every plan despite
the pricing page promising weekly/daily/real-time), historical trend charts in PDF reports (the
dashboard has this, reports don't yet), custom report branding, two-factor authentication, and a
public API. No delivery dates are given, since none are real yet.

**About page**: factual product description (the problem, what the product does, who it's for) —
deliberately no invented founding story or team bios, since neither is real for this build.

**Also fixed while touching routes**: `app/sitemap.ts`'s hardcoded public-path list was missing
`/security`/`/about`/`/roadmap`/`/status` (would have silently excluded them from search engines
indefinitely) — added all four.

**Verified for real**: backend gained a new `health.e2e-spec.ts` (57 e2e tests now, 12 suites);
`tsc --noEmit`/`eslint` clean on both apps, `nest build`/`next build` succeed (all 4 new
routes × 2 locales confirmed in the build output), frontend 45 unit tests pass. Screenshotted all
four new pages plus the refactored terms/privacy pages in English and Hebrew/RTL — the Status
page's live check confirmed working end-to-end (real "Operational" state, real timestamp) against
the actual backend, not a placeholder.

## Enhancement 27: pricing page overhaul — Enterprise tier, monthly/yearly billing

Requested: a real annual-billing option and a genuine top tier above Business for the pricing page,
not just a cosmetic redesign of the existing four cards.

**Added a fifth, contact-sales tier — Enterprise.** It's explicitly *not* a real value of the
backend's `SubscriptionPlan` enum (documented inline in `lib/plans.ts`): real SaaS enterprise tiers
are almost always manually-provisioned and never appear as an org's actual `subscription.plan`, so
this tier is UI-only — a `isCustomQuote` flag drives a "Contact sales" link instead of a checkout
button everywhere it's rendered (public pricing grid, landing-page pricing preview, in-app billing
grid all filter it out of the self-serve checkout flow).

**Real monthly/yearly toggle**, not a static "billing period" label. `PlanInfo` gained
`priceMonthly`/`priceYearly`; yearly prices are a real pricing decision (10x monthly — two months
free, standard SaaS annual-discount convention) that whoever configures live Stripe Price objects
needs to match. Backend: `CreateCheckoutSessionDto` gained an optional `interval` field
(`@IsIn(['monthly','yearly'])`), `BillingService.createCheckoutSession` selects between two
parallel env-var maps (`STRIPE_PRICE_*` vs `STRIPE_PRICE_*_YEARLY`) based on it, and — same "real but
honestly inert without real API keys" pattern as the rest of billing/AI/SMTP — requesting a yearly
checkout for a plan whose yearly Stripe price isn't configured throws a clear
`BillingNotConfiguredError` rather than silently charging the monthly price. The toggle exists on
both the public `/pricing` page (`PricingGrid.tsx`, a new client component the page delegates
interactive rendering to) and the in-app `/billing` page, sharing the same `PlanInfo` source of
truth from `lib/plans.ts` so the two pages can't drift.

**Bug found and fixed during live verification**: clicking "Upgrade" initially failed with `property
interval should not exist` — NestJS's whitelist validation rejecting a field that very much existed
on the DTO. Root cause wasn't the code: an orphaned `node dist/src/main` process (PID from an
earlier session) was still bound to port 3001, serving a stale pre-`interval` build, while a second,
newer `nest start --watch` process had started alongside it without ever taking over the port. Same
class of stale-dev-server issue as prior phases — killed both processes and restarted clean, then
re-verified: the request now reaches the current code and correctly returns the honest "Billing is
not configured" error instead of a validation rejection.

**Verified for real**: frontend `tsc --noEmit`/`eslint`/`next build`/`vitest` all clean (47 tests,
`plans.test.ts` split into a self-serve-plans-have-a-Stripe-key test and a
custom-quote-plans-have-no-Stripe-key test). Backend `tsc --noEmit` clean; one real `prettier` error
in `billing.service.ts` caught by lint and fixed; `nest build` succeeds; 57 unit tests pass. Live
Playwright verification in English and Hebrew/RTL: registered a real test account, toggled
monthly/yearly on both the public pricing page and the in-app billing page (prices update
correctly, Enterprise never shows a checkout button), and clicked "Upgrade" to confirm the interval
actually reaches the backend end-to-end.

## Enhancement 28: customer acquisition — a real, unauthenticated free-scan lead-gen widget

Requested: turn the landing page into an actual acquisition tool, not just a pitch — let a visitor
run a real check on their own domain before ever creating an account.

**New public, unauthenticated endpoint** (`POST /public-scan`, `PublicScanModule`) — the one
deliberate anonymous surface in this API. Runs real DNS/TLS/HTTP probes (`DnsService`/`SslService`/
`HttpService`, the same SSRF-guarded services the authenticated product uses) but is a *lighter*
check than the real pipeline: no subdomain enumeration (the actual paid-tier value proposition) and
nothing persisted — no `Domain`/`Scan`/`Asset`/`Finding` row is ever created for an anonymous
visitor, since there's no organization to own that data. Throttled to 5 requests/minute per IP
(`@Throttle`, same pattern as the public `/contact` endpoint) — tighter than the global 100/min
default, since this is the one route where an anonymous caller can make the backend originate
outbound network connections to a hostname of their choosing.

**Refactored scoring into a shared, DB-independent formula** (`scoring.util.ts`): extracted
`evaluateSslSignal`/`evaluateHeaderSignal`/`evaluateDnsSignal`/`scoreFromDeductions`/
`scoreToRiskLevel` as pure functions operating on plain signal objects, and rewired
`RiskEngineService` to derive those signals from persisted `Asset` metadata and delegate to them
instead of keeping its own copy of the point-deduction logic. This was the deliberate alternative to
writing a second, independent scoring approximation for the new anonymous endpoint — exactly the
kind of drift this session already found and fixed once (Enhancement duplicated-scoring-formula
bug, Steps 2/4/5/6) — so `PublicScanService` now calls the *exact same* formula
`RiskEngineService` does, just fed from a live probe instead of a DB read. Verified the refactor
changed no behavior: all 8 pre-existing `risk-engine.service.spec.ts` tests still pass unchanged.

**Extracted `HOSTNAME_REGEX`** out of `create-domain.dto.ts` into a shared `common/hostname.util.ts`
so the new `PublicScanDto` validates against the identical rule rather than a second copy that could
drift.

**Frontend**: new `FreeScanWidget.tsx` on the landing page (placed right after the hero's CTA
buttons, before the illustrative animated scan sequence, so the first interactive thing a visitor
can do is try the real product) — a domain input, a real live result (score, letter grade, and risk
label reusing the exact same `scoreColor`/`scoreToGrade`/`scoreLabelKey` helpers the dashboard's
`SecurityScoreCard` uses, now exported for reuse), one real finding run through the existing
`toPlainLanguage()` translator (same plain-English treatment as dashboard alerts), a locked
"+N more issues found" count, and a "Sign up free" CTA to `/register`. Handles the 400 (invalid
hostname) and 429 (rate-limited) cases with distinct, friendly messages rather than a generic error.

**Bug found and fixed during e2e testing**: the new `public-scan.e2e-spec.ts` initially failed two
validation tests — malformed input was getting a 200 instead of a 400. Root cause wasn't the DTO;
every other e2e spec in this codebase manually re-applies the same `ValidationPipe({ whitelist,
forbidNonWhitelisted, transform })` main.ts configures for the real app, since Nest's
`Test.createTestingModule` doesn't inherit `main.ts`'s bootstrap config — my first draft of the new
e2e spec had simply forgotten that step. Fixed by adding the same pipe setup every other spec
already uses.

**Verified for real**: backend gained 6 new unit tests (`public-scan.service.spec.ts`, mocking the
DNS/SSL/HTTP/technology services the same way `risk-engine.service.spec.ts` mocks Prisma) and 3 new
e2e tests (`public-scan.e2e-spec.ts`) — one runs a real scan against `example.com` and asserts a
genuine 200 with a valid score/riskLevel, two assert real validation rejections. Backend:
`tsc --noEmit`/`eslint` clean, `nest build` succeeds, 63 unit tests pass, all 13 e2e suites (60
tests) pass. Frontend: `tsc --noEmit`/`eslint`/`next build`/`vitest` all clean (47 tests). Live
Playwright verification in English and Hebrew/RTL: ran a real scan against `example.com` from the
actual landing page and got back a real 72/100 (C-) score with a real "no TLS certificate" finding;
triggered the validation-error path with a garbage domain and saw the correct friendly message; the
Hebrew/RTL layout, plain-language finding translation, and CTA all rendered correctly.

## Enhancement 29: SEO — real per-page metadata, a hreflang bug fix, and structured data

Requested: make the public marketing site actually discoverable, not just well-copywritten.

**Found**: every public page (`/features`, `/pricing`, `/security`, `/about`, `/roadmap`, `/status`,
`/terms`, `/privacy`, `/contact`) shared the exact same `<title>`/meta description — whatever the
root layout's `generateMetadata` set for the homepage, since none of these pages defined their own.
A real, user-visible consequence: every one of those pages showed "SentinelAI — Know what attackers
can see before they do" as its browser-tab title and search-result snippet, regardless of what the
page actually was.

**A second, more subtle real bug**: the root layout's `alternates.languages` (the hreflang tags
telling search engines which URL is the Hebrew/English equivalent of the current page) pointed at
the *locale root* for every page — `/en/pricing`'s Hebrew alternate was `/he`, not `/he/pricing`. A
search engine following that hreflang link would have sent a Hebrew searcher looking at the pricing
page to the Hebrew homepage instead.

**Fixed both with one shared helper**: new `lib/seo.ts` exports `buildMetadata({ locale, path,
title, description })`, building the full `title`/`description`/`alternates` (canonical +
per-language hreflang, now correctly pointing at the same page in each locale)/`openGraph`/
`twitter` block from a single call. Wired into `generateMetadata` on every public page — the four
pages backed by a hardcoded per-locale `CONTENT` object (`security`/`about`/`roadmap`, plus
`terms`/`privacy` which needed a short hand-written description since they only had a `title`) reuse
their own existing real copy rather than a second, separately-maintained SEO description that could
drift from the visible page. `contact/page.tsx` is a client component ("use client", for form
state) and can't export `generateMetadata` itself, so a new `contact/layout.tsx` (a plain server
component that renders `{children}`) carries it instead — the standard Next.js pattern for this
exact situation.

**Real structured data on the homepage**: an `Organization` JSON-LD block (name/url/description; no
`logo` field — there's no real brand logo asset in this build, and a placeholder image would be
worse than omitting the field) and a `FAQPage` JSON-LD block built from the *exact same* `faqItems`
array the visible `FaqAccordion` component already renders, not a separately-maintained copy that
could drift from the real, visible FAQ content — genuinely eligible for a rich-snippet FAQ listing
in search results, not fabricated markup.

**Verified for real**: `tsc --noEmit`/`eslint` clean, `next build` succeeds (all 10 public routes ×
2 locales), 47 frontend unit tests pass. Live-checked every public page's actual rendered
`<title>` in both locales via the running dev server — confirmed all 10 are now distinct and
correct (e.g. `/en/security` → "Security — SentinelAI", `/he/pricing` → "תמחור פשוט ושקוף —
SentinelAI"), confirmed `/en/pricing`'s hreflang now correctly points to `/he/pricing` (not `/he`),
and confirmed both JSON-LD blocks on the homepage parse as valid, well-formed structured data.
Caught and fixed one real regression in `about/page.tsx` during this check (title rendered as the
redundant "About SentinelAI — SentinelAI") and one `.next` build-cache corruption from running
`next build` concurrently with the already-running `next dev` server — resolved by clearing `.next`
and restarting the dev server cleanly, not a code defect.

## Enhancement 30: production review

Requested: a genuine production-readiness pass across the whole app, not new features — matching
the master plan's own "continue only after everything is production ready" rule for the final step.

**Full test suite, run together, one last time**: backend 63 unit + 60 e2e tests (13 suites) pass;
frontend 47 unit tests pass; `tsc --noEmit`/`eslint` clean on both apps; both `nest build` and
`next build` succeed. No skipped/`.only`'d tests found anywhere in either suite.

**Found and fixed a real gap between what the `/security` page claims and what was actually true**:
that page states "Real HTTPS in production, HSTS, a strict Content-Security-Policy, and standard
hardening headers... are applied to every response" — true for the backend API (helmet, confirmed
in `main.ts`), but the frontend's own HTML responses carried zero security headers of any kind
(verified with a real `curl -sI` against the running dev server before touching anything). Added a
real `headers()` block to `next.config.ts` — CSP, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, and HSTS — matching the same hardening level helmet already gives the API.
`connect-src` is built from the real `NEXT_PUBLIC_API_URL` origin rather than hardcoded, so it stays
correct in any deployment. `'unsafe-inline'` is needed on `script-src` (the homepage's real JSON-LD
structured data from Enhancement 29 is inline) and `style-src` (`TiltCard`'s real inline `style`
attribute for its 3D transform) — the same tradeoff helmet's own backend default already makes for
`style-src`. Verified live: the free-scan widget's real API call to the backend, the FAQ accordion,
and every interactive element on the homepage still worked correctly under the new CSP; a dev-mode-
only `eval()` console warning (React's own debugging tooling, which the browser's own message
states "will never use eval() in production mode") confirmed gone entirely once tested against a
real production build.

**Found and fixed a second real gap while testing that production build**: `next start` printed
`"next start" does not work with "output: standalone" configuration` — a genuine, easy-to-miss
Next.js gotcha. `output: "standalone"` (already configured, for a smaller Docker image) requires
copying `public/` and `.next/static` into `.next/standalone/` and running
`.next/standalone/server.js` directly; the previous `"start": "next start"` script silently didn't
do any of that. Confirmed the gap was real by inspecting the actual standalone build output —
`.next/standalone/public` and `.next/standalone/.next/static` were both genuinely missing after a
plain `next build`, which would have meant every CSS/JS/image asset 404ing the moment someone
deployed this with the obvious `npm run build && npm start`. Fixed the `start` script to copy both
directories first, then verified for real: fresh build, ran the corrected script, confirmed a 200 on
the homepage, confirmed a real static CSS chunk actually resolved (200, not 404), and did a live
Playwright pass against that exact production server — zero console errors, full visual parity with
dev mode.

**Dependency audit**: `npm audit --omit=dev` on both apps surfaces only transitively-bundled,
moderate-severity issues inside each framework's own internal build tooling (`prisma`'s bundled
`@prisma/dev` → `@hono/node-server`; `next`'s own vendored `postcss` copy) — neither is reachable
through this app's actual request-handling path, and npm's suggested fix for each would force a
major downgrade (`prisma` back several majors, `next` all the way to v9). Left as-is and documented
here rather than taking a destructive, unvetted dependency action; worth re-checking whenever these
frameworks next release a version that resolves it upstream.

**Also confirmed clean**: `.env.example` documents every environment variable actually referenced
in the backend source (cross-checked by grep against `configService.get`/`process.env` call sites);
no `.env`/`.env.local` files are git-tracked (properly gitignored, `.env.example` correctly
excluded from that ignore); no hardcoded API keys/secrets/private-key material anywhere in source;
`prisma migrate status` reports the schema up to date against 6 real migrations with no drift.

All 12 phases of the master plan are now complete, verified end-to-end, and documented here.

## Enhancement 31: two-factor authentication (TOTP)

Requested: real MFA, prioritized over the much larger (and, for a pre-revenue product with no
real users yet, premature) RAG/local-LLM/observability-stack/public-API/marketplace/white-label
scope from a second master-planning document — a genuine, scoped security feature over
speculative infrastructure.

**Schema**: `User` gained `mfaEnabled` (bool), `mfaSecret` (AES-256-GCM encrypted, nullable), and
`mfaBackupCodeHashes` (argon2 hashes, one per unused backup code). Setup is a real two-step
commitment: starting setup stores an encrypted secret but leaves `mfaEnabled` false; only
successfully submitting a real generated code flips it — a secret nobody has ever proven they can
use isn't actually protecting the account yet.

**New `POST /auth/mfa/setup|enable|disable` and `POST /auth/mfa/verify`** (`MfaService`,
`auth.module.ts`). `login()` now checks `user.mfaEnabled` after the password check: if enabled, it
returns a short-lived challenge token instead of real session tokens, signed with a *separate*
secret (`MFA_CHALLENGE_SECRET`, not `JWT_ACCESS_SECRET`) — `JwtStrategy.validate()` only ever reads
`sub`/`email` and would happily accept any correctly-signed token as a full session, so using a
different signing key entirely (verified directly in `TokenService`, never through
`JwtAuthGuard`) is what actually prevents the challenge token from being replayed as a real one.
`POST /auth/mfa/verify` exchanges that challenge token + a real TOTP/backup code for real tokens.

**Real bug found and fixed mid-implementation**: `otplib` v13's plugin architecture pulls in
`@scure/base`, a pure-ESM package with no CommonJS build at all — the real running app (built via
`nest build`/`nest start --watch`) handled this fine, but the moment `MfaService` was imported,
every single e2e test (not just the new MFA one — all 13 existing suites) started failing with a
`ts-jest` "Unexpected token 'export'" error, since Jest's default `transformIgnorePatterns` doesn't
transform `node_modules`. Rather than patch Jest config to transform a third-party ESM dependency
chain (fragile, likely to resurface with follow-on transitive-dependency issues), replaced `otplib`
entirely with a small, self-contained RFC 6238 TOTP implementation
(`common/totp.util.ts`) built only on Node's own `crypto.createHmac` — a precisely-specified, small
algorithm on an audited primitive, not "rolling your own crypto" in the risky sense, and the same
trade-off this codebase already makes for refresh-token rotation. `qrcode` (unaffected by the ESM
issue) is still used for real QR code generation.

**Second real bug found and fixed during live browser testing**: after enabling MFA, entering an
already-used backup code at login silently reset the entire login page back to the empty
credentials form instead of showing an error. Root cause: the global axios response interceptor
(`api.ts`) treats *any* 401 as "your session expired" and hard-redirects to `/login` — correct for
an authenticated request, wrong for `/auth/login`/`/auth/mfa/verify`, which legitimately return 401
for an expected, recoverable reason (wrong password, wrong/expired code) as part of a normal
unauthenticated flow. Fixed by excluding those specific public auth endpoints from the
refresh-and-redirect branch (`isPublicAuthRequest`), confirmed against a matching regression test
and reverified live afterward.

**Frontend**: `MfaSection.tsx` on the Settings page (start setup → real QR code + manual-entry
secret → confirm with a real generated code → one-time backup-code reveal; or, if already enabled,
a password-confirmed disable flow). The login page now handles the two-step flow: a normal
email/password submit that, for an MFA-enabled account, switches to a second step asking for a
TOTP or backup code, submitted against the challenge token from step one.

**Verified for real**: backend gained 15 new unit tests (`totp.util.spec.ts`, real HMAC-based
TOTP round-trips; `mfa.service.spec.ts`, real argon2/AES round-trips against an in-memory fake) and
9 new e2e tests (`mfa.e2e-spec.ts`) computing genuine TOTP codes against the real secret the server
returns and driving the entire setup → enable → login-requires-challenge → verify → backup-code
(single-use, confirmed via reuse rejection) → disable lifecycle against real Postgres. Backend:
`tsc --noEmit`/`eslint` clean, `nest build` succeeds, 78 unit tests pass, all 14 e2e suites (69
tests) pass. Frontend gained 7 new unit tests (`api.test.ts`, the interceptor-exclusion regression
test) — `tsc --noEmit`/`eslint`/`next build`/`vitest` all clean (54 tests). Live Playwright
verification end-to-end: registered a real account, enabled MFA (real QR code, real secret, real
generated code), signed out, confirmed login now demands a second factor, completed login with a
real backup code, confirmed that same backup code is rejected on reuse (and, after the interceptor
fix, shows a proper inline error instead of resetting the page), completed login again with a
fresh real TOTP code, and disabled MFA with password confirmation — all screenshotted in English,
with the Settings section also confirmed correctly laid out in Hebrew/RTL.

## Enhancement 32: real WCAG 2.0 AA accessibility remediation (Israeli Standard 5568)

Requested: check what Israeli regulation actually requires for a website, and add real accessibility
support (Israeli law — Accessibility of Services Regulations — requires conformance with Israeli
Standard 5568, itself based on WCAG 2.0 Level AA; non-conformance carries real lawsuit exposure,
including statutory damages without proof of harm). This was scoped as genuine engineering
remediation, not a decorative "accessibility widget" — a background audit agent was used first to
find concrete, real violations before touching any code.

**Found and fixed a systemic color-contrast failure**: `text-gray-500` (used **101 times** across
the app) measures 4.16:1 against the dark background — below the 4.5:1 WCAG AA requirement for
normal text. `text-gray-600` (22 uses) measured 2.66:1, failing even the 3:1 large-text threshold.
Computed real WCAG relative-luminance contrast ratios (not estimated) for the actual Tailwind gray
scale before touching anything. Fixed by collapsing both failing shades to `text-gray-400`
(7.93:1 — a comfortable AA pass) across every `.tsx` file in `app/`/`components/`, verified zero
remaining occurrences afterward.

**Found and fixed a total absence of "skip to main content"**: grepped for `skip`/`sr-only`/
`#main-content` across the whole codebase and found nothing — every page forced keyboard users to
tab through the full nav/sidebar before reaching content (a real WCAG 2.4.1 failure). Added a new
`SkipLink` component (invisible until keyboard-focused, first element in the root layout) and
`id="main-content"` on all 7 real `<main>` elements across the app (landing, pricing, contact,
features, status, the shared `LegalPageLayout`, and the dashboard layout). Verified live: first
`Tab` press on any page now reveals a real, visible "Skip to main content" link.

**Found and fixed a systemic missing label-association bug**: `grep -rn "htmlFor"` across the
entire codebase returned **zero matches** — no `<label>` anywhere was programmatically associated
with its input via `htmlFor`/`id`, meaning every "labeled" field read correctly to sighted users
but a screen reader announced nothing when focus landed in the input (WCAG 1.3.1/4.1.2). Added
real `htmlFor`/`id` pairs across contact, register, login (including the new MFA code step),
forgot-password, reset-password, `NotificationChannelsSection`, and `MfaSection`. Separately fixed
inputs relying on `placeholder` alone with no label at all (a distinct, real WCAG failure —
placeholder text isn't a reliable accessible name) in `FreeScanWidget`, `AddDomainForm`,
`TeamSection`'s invite-email field (plus its unlabeled role `<select>`), `ChangePasswordForm` (3
fields), `MfaSection`'s disable-password field, and the Settings page's inline name-edit input —
using visible labels where the existing design already had room, `sr-only` labels where the compact
UI was deliberately built without visible ones. Verified live: Playwright's own accessibility
snapshot now reports real accessible names (`textbox "Name"`, `textbox "Email"`, etc.) where it
previously would have reported nothing.

**Found and fixed a heading-hierarchy violation**: the dashboard page's real content nested `<h1>`
→ `<h3>` (skipping `<h2>` entirely) for the Security Score/Findings section headers, then later
used `<h2>` for Top Risks/Certificate Expirations — an inconsistent, illogical DOM heading order.
Normalized the skipped-level headers to `<h2>`, matching the rest of the page.

**Found and fixed a keyboard-inaccessible modal dismissal**: the mobile sidebar drawer's backdrop
was a bare `<div onClick>` with no `role`, no `tabIndex`, and no keyboard handler at all — a
keyboard-only or screen-reader user had no way to dismiss the open drawer via that element.
Replaced it with a real `<button aria-label="Close menu">` (natively focusable and
Enter/Space-activatable). Verified live at a real 375px mobile viewport: opened the drawer, tabbed
to the backdrop (now announced as a real, labeled button), pressed Enter, and confirmed it closed.

**Also fixed while auditing**: several inputs and one `<select>` used `focus:border-indigo-500`
alone with no ring — a much subtler focus cue than the `focus:ring-1` pattern used everywhere else
in the app, and a likely WCAG 1.4.11 (non-text contrast) risk for low-vision keyboard users.
Standardized all of them onto the same ring-based focus style already used consistently elsewhere.

**New `/accessibility` page** — a real accessibility statement (added to the sitemap and every
page's footer), following the same honest pattern as the Security/Roadmap pages: it does **not**
claim full certified Israeli Standard 5568 compliance (a specific legal designation this build
has not been professionally audited against — claiming it falsely would itself be a liability),
it states plainly what's actually been implemented, what a professional audit hasn't yet covered,
and how to report a real barrier.

**Verified for real**: `tsc --noEmit`/`eslint` clean, `next build` succeeds (`/accessibility` now
a real prerendered route in both locales), 54 frontend unit tests pass (no regressions from the
bulk color/label changes). Live Playwright verification: skip link revealed on first `Tab` on a
real page, form accessible names now correctly reported for contact/register forms, the new
`/accessibility` page rendered correctly in both English and Hebrew/RTL, and the mobile drawer's
backdrop confirmed keyboard-dismissible at a real 375px viewport.

**Not done, and said so on the new page rather than pretending otherwise**: this is real
engineering remediation, not a certified third-party accessibility audit — an accredited Israeli
Standard 5568 auditor has not reviewed this build. Recommended (per the standing legal caveat
given alongside this work) before relying on this for actual regulatory compliance.

## Enhancement 33: real error tracking/monitoring (Sentry)

Requested as the next scoped step after the 12-phase plan, MFA, and accessibility remediation
were all done and the repo was clean — `docs/DEPLOY.md` itself flagged this as one of three
genuinely remaining gaps (alongside a CI deploy step and a lawyer review of Terms/Privacy).

**Backend (`@sentry/nestjs`)**: `apps/backend/src/instrument.ts` calls `Sentry.init()` and must be
the very first import in `main.ts` (before `@nestjs/core`, `pg`, etc.) so Sentry's
auto-instrumentation can hook into those modules before they're required. `SENTRY_DSN` is the same
"inert until a real credential exists" pattern as `STRIPE_SECRET_KEY`/`AI_API_KEY` — `enabled`
stays `false` (and `tracesSampleRate` `0`) until a real DSN is configured, rather than silently
trying to send events nowhere. `resolveSentryOptions()` is a small pure function so this gating
logic is unit-tested directly rather than only exercised indirectly.

`app.module.ts` registers `SentryModule.forRoot()` and wires `SentryGlobalFilter` as the global
`APP_FILTER` (confirmed from the SDK's own source that it only reports real 5xx/unhandled
exceptions to Sentry — expected 4xx `HttpException`s are filtered out via `isExpectedError` before
`super.catch()` still returns Nest's normal response shape, so no client-visible behavior changes).

**Frontend (`@sentry/nextjs`)**: this Next.js 16 app uses the newer `instrumentation-client.ts` /
`instrumentation.ts` file conventions (not the older `sentry.client.config.ts` wizard output) —
confirmed against this exact Next version's own bundled docs
(`node_modules/next/dist/docs/.../instrumentation-client.md`) before writing anything, since
`AGENTS.md` warns this Next version has breaking changes from training data. `sentry.server.config.ts`/
`sentry.edge.config.ts`/`instrumentation-client.ts` all share the same `resolveSentryOptions()`
helper (`lib/sentry-options.ts`) keyed off `NEXT_PUBLIC_SENTRY_DSN` — one gating function instead of
three copies that could silently drift, the same reasoning as the free-scan/authenticated-scan
scoring util from Enhancement 10. Added `app/global-error.tsx` (a plain, hardcoded dark-theme
fallback — deliberately outside `[locale]/layout.tsx` since Next requires global-error at the true
app root, where no locale/theme provider can be trusted to still be working) that reports React
render errors via `Sentry.captureException`. `next.config.ts` wraps the config with
`withSentryConfig`, using `tunnelRoute: "/monitoring"` so Sentry's own requests go through this
app's same origin — the existing strict `connect-src 'self' ...` CSP never needs loosening for it,
and ad-blockers that block `sentry.io` directly don't silently drop reports either. Source-map
upload (`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) is optional and silently skipped without
a real auth token, same inert-until-configured pattern.

**A real bug found while verifying, not a hypothetical one**: the first version of the backend e2e
test that exercised `SentryGlobalFilter` called `Sentry.init()` with full default integrations
(including OpenTelemetry's `http.Server` auto-instrumentation) inside a Jest e2e spec. Running the
full e2e suite in parallel workers afterward, **14 of 15 suites** started failing on
`afterAll → app.close()` timeouts. Bisected via `git stash` to confirm this wasn't pre-existing
sandbox flakiness (a clean `git stash` re-run at the same parallelism still showed a similar failure
count, and a serial `--runInBand` run on baseline was 15/15 clean) — the actual fix was
`defaultIntegrations: false, integrations: []` in the test's own `Sentry.init()` call, since a bare
client is all `SentryGlobalFilter` needs (it only ever calls `captureException` directly). After the
fix, two consecutive full serial e2e runs were 15/15 suites and 70/70 tests clean.

**Verified for real**: backend gained `instrument.spec.ts` (the DSN-gating logic) and
`test/sentry.e2e-spec.ts` — a genuine unhandled exception thrown through a real Nest HTTP pipeline
with the exact filter registered in `app.module.ts`, asserting it reaches a real outgoing Sentry
envelope (via a fake DSN + custom in-memory transport, since spying on `@sentry/core`'s frozen
exports isn't possible in Jest) and that the client still gets the same 500 response shape. Backend:
`tsc --noEmit`/`eslint` clean, `nest build` succeeds, 79 unit tests pass (78 + the new
`instrument.spec.ts`), all 15 e2e suites (70 tests) pass serially. Frontend gained
`lib/sentry-options.test.ts` — `tsc --noEmit`/`eslint`/`next build`/`vitest` all clean (57 tests, up
from 54). Live-verified in a real browser (Playwright): homepage and dashboard load with the exact
same two pre-existing, unrelated console messages as an unmodified `git stash` baseline (a dev-mode
React `eval()` CSP notice and an expected 401 from the unauthenticated `/api/auth/me` check) — no
new errors introduced. Both production Docker images (backend and frontend, including the new
`NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` build args) were built
fresh from a separate compose project (`sentinelai-sentrycheck`, real dev stack untouched) and
confirmed to build cleanly, then torn down.

**Explicitly not done, by necessity of this environment, not by oversight**: no real Sentry
project/DSN exists here, so nothing has actually been sent to Sentry's servers — everything above
is verified up to the point a real DSN would take over, the same boundary as Stripe/AI/SMTP.
`docs/DEPLOY.md` updated accordingly (removed from the "not done" list, replaced with an honest
"wired in but inert without a real DSN" note, and the two remaining real gaps — CI deploy step,
lawyer review — are unchanged).

**CI workflow verified end-to-end after the fact**: re-ran every step of `.github/workflows/ci.yml`
locally against fresh service containers with the exact same env vars/commands (backend:
`prisma generate` → `migrate deploy` → lint → build → unit → e2e; frontend: lint → test → build with
`NEXT_PUBLIC_API_URL=/api`; `docker-build`: plain `docker build` on both Dockerfiles, no compose,
matching CI exactly) rather than assume the earlier local verification covered it. Found the same
`--maxWorkers`-driven e2e flakiness this time too, at the default worker count on a 14-core sandbox
(3 suites failing on `afterAll`/`app.close()` timeouts); confirmed clean 15/15 at `--maxWorkers=2`
(a realistic small-CI-runner concurrency) twice. Since a many-core CI runner could hit the same
contention `ci.yml` was never actually protected against, added `--maxWorkers=2` to the "End-to-end
tests" step — a genuine latent fragility this check surfaced, not a Sentry-caused regression. All
other steps (lint/build/unit tests/frontend build/both Docker image builds) passed unmodified.

## Enhancement 34: rebrand — SentinelAI → DomeCortex AI

Requested: rename the product, plus lean the positioning into an "Iron Dome for small business
websites" angle (Israel's missile-defense system as a metaphor for continuous, always-on
protection) — explicitly scoped as name + positioning, not a full local-market pivot (no
Hebrew-specific pricing/case-studies rewrite).

**Note on this doc and `docs/SESSION_2026-07-11.md`**: past entries above still say "SentinelAI"
throughout — deliberately left as-is. Those are chronological build logs describing what was
actually built and discussed *at the time*; retroactively editing them to say "DomeCortex AI"
would misrepresent history. Every current-state doc (README, DEPLOY.md, this entry onward) uses
the new name.

**Scope**: a systematic rename across 59 files — every backend brand string (MFA TOTP issuer,
email templates/from-address, PDF report header, Coinbase charge name, discovery User-Agent,
domain-verification TXT record prefix), every frontend surface (nav/sidebar wordmark, landing
page copy, all 11 marketing/legal pages in both locales, `messages/en.json`/`he.json`, SEO
metadata, localStorage key names), Docker resource names (container/volume/network names, the
`sentinel` Postgres username placeholder), and `.env.example`/`.env.production`/local `.env`
files. Package names (`backend`/`frontend`) were never brand-tied, so left alone; the actual
GitHub repo/directory name was deliberately **not** touched — a repo rename is a much bigger,
external action nobody asked for here.

**Two spots needed hand-fixing, not caught by the mechanical find/replace**: the site-wide
two-tone wordmark treatment (`Sentinel` in white + `AI` in indigo, split across a `<span>` so a
plain substring match never saw it as one contiguous string) — updated to `DomeCortex` + a
literal space + indigo `AI` across `Sidebar.tsx`/`MarketingNav.tsx`/`register`/`login`/etc., and
the identical split rendered again in the PDF header via three chained PDFKit `.text()` calls.
Also manually cleaned up the discovery module's `User-Agent` header, which the mechanical rename
left as `DomeCortex AI-DiscoveryBot/1.0` (an awkward raw space before the hyphen) — changed to the
concatenated `DomeCortexAI-DiscoveryBot/1.0`, matching the original slug convention.

**A real test failure caught during verification, not a false start**: `totp.util.spec.ts`
asserted the literal substring `issuer=DomeCortex AI` in a generated `otpauth://` URL. `SentinelAI`
had no space, so the old assertion happened to work by coincidence; `DomeCortex AI` does have one,
and `URLSearchParams` encodes it as `+` (confirmed directly in `node`), not left as a raw space —
fixed the assertion to `issuer=DomeCortex+AI` rather than loosen the test.

**Positioning**: updated the two highest-visibility copy slots rather than scattering the Iron
Dome metaphor everywhere — the hero eyebrow ("An Iron Dome for small business websites" /
"כיפת ברזל דיגיטלית לעסקים קטנים") and the meta description used for SEO/social previews, in both
locales. Left the rest of the landing page's copy (features, FAQ, pricing) untouched since it
already reads well and doesn't need the metaphor repeated.

**Verified for real**: backend — `tsc --noEmit`/`eslint` clean, `nest build` succeeds, 81 unit
tests pass (after the `totp.util.spec.ts` fix above), all 15 e2e suites (70 tests) pass serially
against a freshly renamed local Postgres/Redis (`domecortex`/`domecortex` — brought up fresh,
migrations re-applied clean). Frontend — `tsc --noEmit`/`eslint`/`next build`/`vitest` all clean
(57 tests, no regressions). Live-verified in a real browser in both English and Hebrew/RTL: nav
wordmark renders correctly (two-tone split intact), hero eyebrow shows the new positioning line,
page `<title>` reflects the new brand, footer copyright updated, and the free-scan widget's CLI
mock command line (`$ domecortex scan yourbusiness.com`) renders correctly — no new console errors
beyond the same pre-existing dev-mode `eval()` notice present on an unmodified `git stash` baseline.
