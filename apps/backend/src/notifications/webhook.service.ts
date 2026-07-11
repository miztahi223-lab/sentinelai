import { Injectable, Logger, Optional } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import {
  assertHostnameNotLiteralBlockedIp,
  safeLookup,
} from '../discovery/ssrf-guard';

export interface OutboundGuard {
  /** Synchronous, pre-connection check — must cover the literal-IP case
   * `lookup` below structurally cannot (see `ssrf-guard.ts`). */
  assertHostnameAllowed(hostname: string): void;
  lookup: AxiosRequestConfig['lookup'];
}

const REAL_GUARD: OutboundGuard = {
  assertHostnameAllowed: assertHostnameNotLiteralBlockedIp,
  lookup: safeLookup,
};

/**
 * Real outbound HTTP delivery for the two notification channels an
 * organization can configure for itself (`NotificationSettings.webhookUrl`/
 * `slackWebhookUrl`) — a generic JSON POST, and Slack's real "Incoming
 * Webhook" format (`{"text": "..."}`), which is the entire Slack
 * integration surface: no app install/OAuth is needed for a workspace to
 * receive messages this way, so this is a real, complete integration, not
 * a stub.
 *
 * Uses the same SSRF guard the discovery scanner uses (`ssrf-guard.ts`,
 * both its DNS-resolution `lookup` callback and the separate literal-IP
 * check it can't cover) — a webhook URL is configured by whoever
 * administers this organization, not scanned from arbitrary internet
 * input, but a compromised account (or an org owner accidentally pointing
 * it at an internal service) is still a real SSRF vector worth closing
 * with an already-proven guard rather than trusting the URL blindly.
 *
 * The guard is injected (defaulting to `REAL_GUARD`) rather than hardcoded
 * so unit tests can verify the actual HTTP/JSON delivery mechanics against
 * a real local server without that server's own loopback address being
 * (correctly) rejected — production code always gets the real default via
 * Nest's DI, only tests ever pass something else.
 */
const TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly guard: OutboundGuard;

  constructor(@Optional() guard: OutboundGuard = REAL_GUARD) {
    this.guard = guard;
  }

  async sendWebhook(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      this.guard.assertHostnameAllowed(new URL(url).hostname);
      await axios.post(url, payload, {
        timeout: TIMEOUT_MS,
        headers: { 'content-type': 'application/json' },
        lookup: this.guard.lookup,
      });
    } catch (error) {
      this.logger.warn(
        `Webhook delivery to ${url} failed: ${(error as Error).message}`,
      );
    }
  }

  async sendSlackMessage(url: string, text: string): Promise<void> {
    try {
      this.guard.assertHostnameAllowed(new URL(url).hostname);
      await axios.post(
        url,
        { text },
        {
          timeout: TIMEOUT_MS,
          headers: { 'content-type': 'application/json' },
          lookup: this.guard.lookup,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Slack webhook delivery to ${url} failed: ${(error as Error).message}`,
      );
    }
  }
}
