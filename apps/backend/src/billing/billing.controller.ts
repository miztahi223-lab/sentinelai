import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { BillingNotConfiguredError, BillingService } from './billing.service';
import {
  CryptoBillingNotConfiguredError,
  CryptoBillingService,
} from './crypto-billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly cryptoBillingService: CryptoBillingService,
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post('checkout-session')
  @UseGuards(JwtAuthGuard)
  async checkoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Restricted to OWNER/ADMIN — changing what the organization is billed
    // for is not something a regular MEMBER should be able to trigger.
    await this.organizationsService.assertManagerMembership(
      user.userId,
      dto.organizationId,
    );
    const requester = await this.usersService.findById(user.userId);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const url = await this.billingService.createCheckoutSession({
        organizationId: dto.organizationId,
        plan: dto.plan,
        successUrl: `${frontendUrl}/billing?checkout=success`,
        cancelUrl: `${frontendUrl}/billing?checkout=cancelled`,
        customerEmail: requester!.email,
      });
      await this.auditLogsService.record({
        organizationId: dto.organizationId,
        userId: user.userId,
        action: 'billing.checkout_started',
        metadata: { plan: dto.plan },
      });
      return { url };
    } catch (error) {
      if (error instanceof BillingNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }

  /**
   * Crypto checkout — an *additional* payment method, not an anonymous one.
   * Same authorization as `checkout-session` (OWNER/ADMIN of a real,
   * already-authenticated organization) and the same audit logging.
   * BUSINESS isn't offered here because it's custom/contact-sales pricing
   * with no fixed amount to charge.
   */
  @Post('crypto-checkout-session')
  @UseGuards(JwtAuthGuard)
  async cryptoCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.organizationsService.assertManagerMembership(
      user.userId,
      dto.organizationId,
    );
    if (dto.plan === 'BUSINESS') {
      throw new BadRequestException(
        'The Business plan is custom-priced — contact sales instead of using crypto checkout.',
      );
    }
    const organization = await this.organizationsService.findById(
      dto.organizationId,
    );
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const url = await this.cryptoBillingService.createCheckoutSession({
        organizationId: dto.organizationId,
        organizationName: organization?.name ?? dto.organizationId,
        plan: dto.plan,
        successUrl: `${frontendUrl}/billing?checkout=success`,
        cancelUrl: `${frontendUrl}/billing?checkout=cancelled`,
      });
      await this.auditLogsService.record({
        organizationId: dto.organizationId,
        userId: user.userId,
        action: 'billing.crypto_checkout_started',
        metadata: { plan: dto.plan },
      });
      return { url };
    } catch (error) {
      if (error instanceof CryptoBillingNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }

  /**
   * No `JwtAuthGuard` — Coinbase Commerce calls this directly and can't
   * present a user JWT. Authenticity is verified via the HMAC signature
   * header inside `CryptoBillingService.handleWebhook`.
   */
  @Post('crypto-webhook')
  @HttpCode(HttpStatus.OK)
  async cryptoWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-cc-webhook-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new Error(
        'Raw request body not available — check that rawBody is enabled in main.ts for this route.',
      );
    }
    try {
      await this.cryptoBillingService.handleWebhook(req.rawBody, signature);
      return { received: true };
    } catch (error) {
      if (error instanceof CryptoBillingNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof Error && error.message.includes('signature')) {
        throw new BadRequestException(
          `Webhook signature verification failed: ${error.message}`,
        );
      }
      throw error;
    }
  }

  @Post('portal-session')
  @UseGuards(JwtAuthGuard)
  async portalSession(
    @Body('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.organizationsService.assertManagerMembership(
      user.userId,
      organizationId,
    );
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const url = await this.billingService.createPortalSession(
        organizationId,
        `${frontendUrl}/billing`,
      );
      return { url };
    } catch (error) {
      if (error instanceof BillingNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }

  /**
   * No `JwtAuthGuard` here — Stripe calls this endpoint directly, it can't
   * present a user JWT. Authenticity is instead verified via the Stripe
   * signature header inside `BillingService.handleWebhook`, which is the
   * correct authentication mechanism for a webhook (not user auth at all).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new Error(
        'Raw request body not available — check that rawBody is enabled in main.ts for this route.',
      );
    }
    try {
      await this.billingService.handleWebhook(req.rawBody, signature);
      return { received: true };
    } catch (error) {
      if (error instanceof BillingNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      // Stripe's SDK throws a plain Error (StripeSignatureVerificationError)
      // for an invalid/missing signature — that's a malformed/untrusted
      // request, i.e. a client error (400), not a server fault (500).
      // Distinguishing this matters for Stripe's own webhook retry/alerting
      // behavior, which treats 4xx and 5xx differently.
      if (error instanceof Error && error.message.includes('signature')) {
        throw new BadRequestException(
          `Webhook signature verification failed: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
