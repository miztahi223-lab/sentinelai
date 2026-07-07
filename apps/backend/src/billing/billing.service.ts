import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured — set STRIPE_SECRET_KEY to enable it.');
    this.name = 'BillingNotConfiguredError';
  }
}

const PLAN_PRICE_ENV_VAR: Record<Exclude<SubscriptionPlan, 'FREE'>, string> = {
  STARTER: 'STRIPE_PRICE_STARTER',
  PROFESSIONAL: 'STRIPE_PRICE_PROFESSIONAL',
  BUSINESS: 'STRIPE_PRICE_BUSINESS',
};

/**
 * Real Stripe integration (the actual `stripe` SDK, real API calls) for
 * subscription checkout, the billing portal, and webhook-driven plan sync.
 *
 * There is no Stripe account/API key available in this build environment
 * (`STRIPE_SECRET_KEY` is unset, same situation as `AI_API_KEY` in Step 11).
 * Every method here throws `BillingNotConfiguredError` until a real key is
 * set, rather than returning a fabricated checkout URL or silently
 * pretending a subscription changed — a fake payment link would be far
 * worse than a fake AI explanation, so this is not a step to fake under
 * any circumstance.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || undefined;

    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured — billing/checkout/webhooks are disabled. ' +
          'Set STRIPE_SECRET_KEY (and STRIPE_PRICE_* / STRIPE_WEBHOOK_SECRET) to enable them.',
      );
      return;
    }
    this.stripe = new Stripe(secretKey);
  }

  isConfigured(): boolean {
    return !!this.stripe;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new BillingNotConfiguredError();
    return this.stripe;
  }

  async createCheckoutSession(params: {
    organizationId: string;
    plan: Exclude<SubscriptionPlan, 'FREE'>;
    successUrl: string;
    cancelUrl: string;
    customerEmail: string;
  }): Promise<string> {
    const stripe = this.requireStripe();

    const priceId = this.configService.get<string>(
      PLAN_PRICE_ENV_VAR[params.plan],
    );
    if (!priceId) {
      throw new BillingNotConfiguredError();
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: params.organizationId },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: subscription?.stripeCustomerId ?? undefined,
      customer_email: subscription?.stripeCustomerId
        ? undefined
        : params.customerEmail,
      client_reference_id: params.organizationId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { organizationId: params.organizationId, plan: params.plan },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }
    return session.url;
  }

  async createPortalSession(
    organizationId: string,
    returnUrl: string,
  ): Promise<string> {
    const stripe = this.requireStripe();

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription?.stripeCustomerId) {
      throw new Error(
        'This organization has no Stripe customer yet — nothing to manage.',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  /**
   * Verifies and processes an incoming Stripe webhook event. Requires the
   * *raw* request body (see `main.ts`'s `rawBody` wiring for
   * `/api/billing/webhook`) — Stripe's signature is computed over the raw
   * bytes, so a JSON-parsed-and-re-serialized body would fail verification
   * even for a genuine event.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.requireStripe();
    if (!this.webhookSecret) {
      throw new BillingNotConfiguredError();
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const organizationId = session.client_reference_id;
        const plan = session.metadata?.plan as SubscriptionPlan | undefined;
        if (organizationId && plan && typeof session.customer === 'string') {
          await this.prisma.subscription.update({
            where: { organizationId },
            data: {
              plan,
              status: SubscriptionStatus.ACTIVE,
              stripeCustomerId: session.customer,
              stripeSubscriptionId:
                typeof session.subscription === 'string'
                  ? session.subscription
                  : undefined,
            },
          });
          this.logger.log(
            `Organization ${organizationId} upgraded to ${plan} via Stripe checkout`,
          );
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const existing = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (existing) {
          await this.prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: this.mapStripeStatus(sub.status),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });
        }
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private mapStripeStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
      case 'unpaid':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.INCOMPLETE;
    }
  }
}
