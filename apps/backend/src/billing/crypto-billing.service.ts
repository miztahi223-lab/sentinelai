import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class CryptoBillingNotConfiguredError extends Error {
  constructor() {
    super(
      'Crypto billing is not configured — set COINBASE_COMMERCE_API_KEY to enable it.',
    );
    this.name = 'CryptoBillingNotConfiguredError';
  }
}

// Fixed USD list price for the plans crypto checkout supports — mirrors
// `apps/frontend/lib/plans.ts`. BUSINESS is deliberately excluded: it's
// "Contact sales" / custom pricing in the product, so there's no fixed
// amount to charge without a human sales conversation first, in crypto or
// any other payment method.
const CRYPTO_PLAN_USD_PRICE: Record<'STARTER' | 'PROFESSIONAL', number> = {
  STARTER: 49,
  PROFESSIONAL: 199,
};

interface CoinbaseCharge {
  id: string;
  code: string;
  hosted_url: string;
}

/**
 * Cryptocurrency checkout via Coinbase Commerce, as an *additional* payment
 * method alongside Stripe — deliberately NOT an anonymous payment path.
 *
 * Every charge this service creates is tied to an already-authenticated,
 * already-identified organization (the caller must be an OWNER/ADMIN of a
 * real org — enforced in `BillingController`, same as the Stripe checkout
 * endpoint) and is recorded in the audit log exactly like every other
 * billing action. A genuinely anonymous crypto payment path — one that
 * accepts money without tying it to an identified account — was
 * intentionally not built: for a security-scanning product specifically,
 * removing the link between "who is using this tool" and "who paid for
 * it" would strip the one piece of accountability that discourages using
 * the platform's scanning capability against domains the payer doesn't
 * actually control. Accepting crypto as a *convenience* payment method for
 * a known, logged-in customer carries none of that risk, so that's what
 * this implements.
 *
 * There is no Coinbase Commerce account/API key available in this build
 * environment (same situation as `STRIPE_SECRET_KEY` / `AI_API_KEY`) —
 * every method here throws `CryptoBillingNotConfiguredError` until a real
 * key is set, rather than returning a fabricated checkout URL.
 */
@Injectable()
export class CryptoBillingService {
  private readonly logger = new Logger(CryptoBillingService.name);
  private readonly apiKey?: string;
  private readonly webhookSecret?: string;
  private static readonly API_BASE = 'https://api.commerce.coinbase.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey =
      this.configService.get<string>('COINBASE_COMMERCE_API_KEY') || undefined;
    this.webhookSecret =
      this.configService.get<string>('COINBASE_COMMERCE_WEBHOOK_SECRET') ||
      undefined;

    if (!this.apiKey) {
      this.logger.warn(
        'COINBASE_COMMERCE_API_KEY is not configured — crypto checkout is disabled. ' +
          'Set COINBASE_COMMERCE_API_KEY (and COINBASE_COMMERCE_WEBHOOK_SECRET) to enable it.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private requireApiKey(): string {
    if (!this.apiKey) throw new CryptoBillingNotConfiguredError();
    return this.apiKey;
  }

  async createCheckoutSession(params: {
    organizationId: string;
    organizationName: string;
    plan: 'STARTER' | 'PROFESSIONAL';
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const apiKey = this.requireApiKey();
    const amountUsd = CRYPTO_PLAN_USD_PRICE[params.plan];

    const response = await fetch(`${CryptoBillingService.API_BASE}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify({
        name: `SentinelAI — ${params.plan} plan`,
        description: `Monthly subscription for ${params.organizationName}`,
        pricing_type: 'fixed_price',
        local_price: { amount: amountUsd.toFixed(2), currency: 'USD' },
        // Identifies which org this charge is for — the same real
        // organizationId the paying user is already an OWNER/ADMIN of, not
        // an arbitrary/anonymous reference.
        metadata: { organizationId: params.organizationId, plan: params.plan },
        redirect_url: params.successUrl,
        cancel_url: params.cancelUrl,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Coinbase Commerce charge creation failed (${response.status}): ${body}`,
      );
    }

    const json = (await response.json()) as { data: CoinbaseCharge };
    return json.data.hosted_url;
  }

  /**
   * Verifies and processes a Coinbase Commerce webhook event. Requires the
   * *raw* request body — the `X-CC-Webhook-Signature` HMAC is computed over
   * the raw bytes, same reasoning as the Stripe webhook's raw-body
   * requirement.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.webhookSecret) throw new CryptoBillingNotConfiguredError();

    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(signature || '', 'hex');
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new Error('signature verification failed');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event: {
        type: string;
        data: CoinbaseCharge & { metadata?: Record<string, string> };
      };
    };

    if (event.event.type === 'charge:confirmed') {
      const charge = event.event.data;
      const organizationId = charge.metadata?.organizationId;
      const plan = charge.metadata?.plan as SubscriptionPlan | undefined;
      if (organizationId && plan) {
        // Idempotent: a charge can legitimately fire `charge:confirmed`
        // more than once, and this method only ever changes anything the
        // first time a given charge code is seen.
        const existing = await this.prisma.subscription.findUnique({
          where: { organizationId },
        });
        if (existing?.lastCryptoChargeId === charge.code) {
          this.logger.debug(
            `Coinbase charge ${charge.code} already processed for org ${organizationId} — skipping`,
          );
          return;
        }
        await this.prisma.subscription.update({
          where: { organizationId },
          data: {
            plan,
            status: SubscriptionStatus.ACTIVE,
            lastCryptoChargeId: charge.code,
          },
        });
        this.logger.log(
          `Organization ${organizationId} upgraded to ${plan} via Coinbase Commerce charge ${charge.code}`,
        );
      }
    } else {
      this.logger.debug(
        `Unhandled Coinbase Commerce event: ${event.event.type}`,
      );
    }
  }
}
