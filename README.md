# SentinelAI

**Know what attackers can see before they do.**

SentinelAI is an external attack-surface monitoring SaaS: point it at your organization's
domains and it continuously discovers your internet-facing assets (DNS records, TLS
certificates, HTTP endpoints, detected technologies), scores your security posture, raises
alerts on meaningful changes, and produces shareable PDF reports — the kind of reconnaissance
an attacker would do against you, done first, on your side, on a schedule.

## Status

Actively built, step by step, with every feature verified end-to-end against a real running
stack (not just "it compiles") before being marked done. See **[docs/PROGRESS.md](docs/PROGRESS.md)**
for the full, honest build log — what's implemented, what's deliberately deferred, every real
bug found during verification and how it was fixed, and exactly what's needed to flip on the
two features that require third-party credentials this build environment didn't have
(billing and AI analysis).

## Architecture

```
apps/
  backend/    NestJS 11 API — auth, discovery, scanning, risk scoring, billing, reports, AI
  frontend/   Next.js 16 (App Router) — dashboard + marketing site
packages/
  shared/     (reserved for cross-app shared types, currently unused)
infra/
  nginx/      Reverse proxy config for the production stack
docs/
  PROGRESS.md Full build log — read this first for anything beyond a quick start
```

**Backend stack**: NestJS · PostgreSQL 16 (via Prisma 7, `@prisma/adapter-pg`) · Redis 7 +
BullMQ (background workers) · Argon2id password hashing · JWT access tokens + rotating opaque
refresh tokens · Stripe (billing) · Anthropic API (AI finding analysis) · pdfkit (reports) ·
nodemailer (email) · Pino (structured logging).

**Frontend stack**: Next.js · React 19 · Tailwind CSS v4 · TanStack Query · Recharts.

**Core domain modules** (`apps/backend/src/`):

| Module | Responsibility |
|---|---|
| `auth/` | Register/login/logout/refresh/verify-email/password-reset |
| `organizations/`, `domains/` | Multi-tenant orgs, membership, tracked domains |
| `discovery/` | DNS/TLS/HTTP/technology probing of a domain, with SSRF protection |
| `scans/`, `queue/` | BullMQ-backed scan orchestration (manual + scheduled) |
| `monitoring/` | Daily scheduled re-scan sweep across every tracked domain |
| `risk-engine/` | Turns scan findings into a 0-100 auditable security score |
| `ai/` | AI-generated finding explanations / executive summaries (Anthropic) |
| `reports/` | PDF report generation, download, email delivery |
| `billing/` | Stripe checkout/portal/webhook subscription management |
| `contact/` | Public marketing-site contact form |

## Local development

### Prerequisites

- Node.js 22+
- Docker or Podman (with `docker-compose`/`podman-compose` support)

### 1. Start Postgres + Redis

```bash
docker compose up -d
```

### 2. Backend

```bash
cd apps/backend
cp ../../.env.example .env   # then fill in DATABASE_URL/JWT secrets at minimum
npm install
npx prisma migrate dev
npm run start:dev
```

The API listens on `http://localhost:3001/api`. `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are
the only variables required for the core product to run; SMTP/Stripe/AI keys are optional —
without them, those specific features log what they *would* have sent/done and return a clear
"not configured" error instead of fabricating a result. See `.env.example` for the full list.

### 3. Frontend

```bash
cd apps/frontend
cp ../../.env.example .env.local   # NEXT_PUBLIC_API_URL is the only var needed
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

## Testing

```bash
# Backend — unit tests (mocked dependencies) + e2e tests (real Postgres/Redis, run docker compose up -d first)
cd apps/backend && npm run test && npm run test:e2e

# Frontend — component/unit tests
cd apps/frontend && npm run test
```

Both apps also run `npm run lint` and `npm run build` cleanly (0 errors) — both are part of
the CI pipeline (`.github/workflows/ci.yml`) and were re-verified before every step in
`docs/PROGRESS.md` was marked done.

## Production deployment

```bash
cp .env.example .env   # fill in real production secrets — see comments in docker-compose.production.yml
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

This builds and runs the full stack (Postgres, Redis, backend, frontend, nginx reverse proxy)
from the production Dockerfiles. Database migrations run automatically on backend container
start (`apps/backend/docker-entrypoint.sh`). See `docs/PROGRESS.md`'s Step 16 section for real
bugs this exact setup surfaced and how they were fixed (migration timing, Next.js standalone
server binding, nginx DNS caching across container restarts).

**Not included**: TLS/HTTPS termination — there's no real domain/certificate to configure
honestly in this build environment. Terminate TLS at a cloud load balancer in front of this
stack, or add certbot to the nginx layer, before exposing this publicly.

## Enabling optional features

Two features are fully built and wired end-to-end but require real third-party credentials
this build environment didn't have — both were verified as far as possible without one (see
`docs/PROGRESS.md` Steps 11 and 13 for exactly how), and need no code changes to activate:

- **AI-generated finding analysis / executive summaries**: set `AI_API_KEY` to a real
  Anthropic API key.
- **Billing / subscriptions**: create a Stripe account, set `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PROFESSIONAL`/
  `STRIPE_PRICE_BUSINESS`, and register the webhook endpoint in the Stripe dashboard pointing
  at `/api/billing/webhook`.

## Security

A dedicated security review (`docs/PROGRESS.md`, Step 18) found and fixed a real SSRF
vulnerability in the discovery module (a user-supplied domain resolving to an internal/
cloud-metadata address could otherwise have made this backend connect to it) — see that
section for the finding, the fix (`src/discovery/ssrf-guard.ts`), and how it was verified
against the live running system, not just reasoned about on paper.
