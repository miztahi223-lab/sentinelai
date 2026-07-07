import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends transactional email via SMTP.
 *
 * If no SMTP_HOST is configured (e.g. a fresh local dev checkout with no
 * mail provider set up yet), this falls back to logging the email content
 * instead of sending it, rather than throwing or silently no-op'ing. This
 * is the standard pattern used by most frameworks for local/dev
 * environments (e.g. Django's console email backend, Rails'
 * letter_opener) — it is not fake data, the email content generated is
 * real, it's just not transported over SMTP until that's configured.
 *
 * To go live: set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 * in the environment (any standard SMTP provider works: SES, SendGrid,
 * Postmark, Mailgun, etc.) — no code change needed.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = 'SentinelAI <no-reply@sentinelai.local>';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('SMTP_HOST');
    const from = this.configService.get<string>('SMTP_FROM');
    if (from) this.from = from;

    if (!host) {
      this.logger.warn(
        'SMTP_HOST is not configured — emails will be logged instead of sent. ' +
          'Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM to enable real delivery.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.configService.get<string>('SMTP_PORT', '587')),
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private async send(to: string, subject: string, html: string, text: string) {
    if (!this.transporter) {
      this.logger.log(`[email:not-configured] To: ${to} | Subject: ${subject}\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html, text });
  }

  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your SentinelAI account',
      `<p>Welcome to SentinelAI. Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>`,
      `Welcome to SentinelAI. Verify your email: ${verifyUrl}`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your SentinelAI password',
      `<p>We received a request to reset your password. Click <a href="${resetUrl}">here</a> to choose a new one. This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
      `Reset your password: ${resetUrl} (expires in 1 hour)`,
    );
  }
}
