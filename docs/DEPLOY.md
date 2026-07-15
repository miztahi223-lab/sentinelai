# Deploying DomeCortex AI for real

This is the copy-paste runbook for the day you have a real domain and a host.
Everything in the product itself is already built, tested, and containerized
(see `docs/PROGRESS.md`) — what's left is entirely about real-world
accounts/credentials, not code. This doc exists so that moment takes minutes,
not a fresh investigation.

## What you need before starting

1. **A domain** you control (any registrar). You'll point its DNS `A` record
   at your server's IP once you have one.
2. **A host** — any of these work with zero changes to this repo, since it's
   a plain Docker Compose stack:
   - A single VPS (DigitalOcean, Hetzner, Linode, AWS Lightsail, etc.) —
     simplest option, just needs Docker + Docker Compose installed.
   - Any container platform that accepts a `docker-compose.yml`
     (Render, Railway, Fly.io — some require translating the compose file
     to their own format, since they don't all run raw Compose directly).
3. **A real SMTP provider** (Postmark, SendGrid, AWS SES, etc.) — a free
   tier is enough to start (a few hundred emails/month covers early
   signups/verification/reports).
4. **A real Stripe account** (business details + bank account for payouts —
   this is usually the slowest step, 1-3 business days for Stripe's own
   verification). Create three recurring Prices for Starter ($49/mo),
   Professional ($199/mo), Business (your real custom amount).
5. **A real Anthropic API key** (console.anthropic.com) — enables the
   AI-generated remediation guidance and executive summaries.
6. *(Optional)* A real Coinbase Commerce account, if you want the crypto
   payment option live too.
7. *(Optional)* A real Sentry project (sentry.io, free tier is enough to
   start) — without it, errors are still logged to container logs via pino as
   before, just not aggregated/alerted on anywhere.

## Steps

### 1. Point DNS at your server

Create an `A` record: `yourdomain.com` → your server's IP. (If using a
platform like Render/Fly.io instead of a raw VPS, follow their own
custom-domain instructions instead — you'll get a CNAME target, not a
plain IP.)

### 2. Install Docker + Docker Compose on the server

```bash
curl -fsSL https://get.docker.com | sh
```

### 3. Copy the repo and the pre-filled secrets to the server

```bash
git clone <your-repo-url> domecortex
cd domecortex
# Copy the .env.production file this build already generated for you
# (JWT secrets and a Postgres password are already real, random values —
# never regenerate these once real users exist, or every session breaks).
scp .env.production youruser@yourserver:~/domecortex/.env.production
```

### 4. Fill in the remaining real values in `.env.production`

Open it and fill in the sections still blank:

```bash
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
HTTP_PORT=80

SMTP_HOST=...          # from your SMTP provider
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="DomeCortex AI <noreply@yourdomain.com>"
CONTACT_EMAIL=you@yourdomain.com

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_BUSINESS=price_...

AI_API_KEY=sk-ant-...

# Optional — leave blank to skip error tracking entirely
SENTRY_DSN=https://...@o0.ingest.sentry.io/...          # backend project
NEXT_PUBLIC_SENTRY_DSN=https://...@o0.ingest.sentry.io/...  # frontend project (can be a separate Sentry project)
SENTRY_ORG=...            # only needed for readable source maps on the frontend
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
```

### 5. Bring the stack up

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

This builds the backend/frontend images fresh, runs Postgres/Redis, applies
every Prisma migration automatically on backend startup, and serves
everything through nginx on port 80.

### 6. Put TLS in front of it

`nginx.conf.template` in this repo deliberately does **not** terminate TLS
(see the comment in `docker-compose.production.yml` explaining why — faking
a cert would be worse than leaving this explicit). Easiest real options:
- Put the server behind Cloudflare (free, proxied DNS — TLS handled for you).
- Or run `certbot` on the host in front of this stack.

### 7. Point the Stripe webhook at your real domain

In the Stripe dashboard, add a webhook endpoint:
`https://yourdomain.com/api/billing/webhook`, subscribed to at least
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Put the signing secret it gives you into
`STRIPE_WEBHOOK_SECRET` and restart the backend container.

### 8. Smoke-test for real

```bash
curl -s https://yourdomain.com/api/
curl -s -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@yourdomain.com","password":"...","name":"You","organizationName":"Your Org"}'
```

Then register through the real UI, add a real domain you own, and confirm a
scan actually runs.

## What's genuinely NOT done and worth knowing before charging real customers

- **Terms of Service / Privacy Policy** (`app/[locale]/terms`,
  `app/[locale]/privacy`) have real, substantive written content — not
  placeholder text — but were not reviewed by an actual lawyer. Worth a
  real legal review before processing real payments.
- **Error tracking (Sentry) is wired in but inert without a real DSN.** Both
  apps call `Sentry.init` already (backend: `SENTRY_DSN`; frontend:
  `NEXT_PUBLIC_SENTRY_DSN`) and the backend reports every unhandled 5xx via a
  global exception filter — but with no DSN configured, this is a genuine
  no-op (same pattern as Stripe/AI before a real key exists), so production
  errors are still only visible in container logs until you set one.
- **No CI deploy step** — `.github/workflows/ci.yml` runs tests/build on
  every push but doesn't deploy anywhere; deployment above is manual until
  you tell me which host you picked, at which point I can add a real
  deploy step to the workflow.
