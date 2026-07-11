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

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
    attachments?: { filename: string; path: string }[],
  ) {
    if (!this.transporter) {
      this.logger.log(
        `[email:not-configured] To: ${to} | Subject: ${subject}\n${text}` +
          (attachments?.length
            ? ` (with attachment(s): ${attachments.map((a) => a.filename).join(', ')})`
            : ''),
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
      attachments,
    });
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

  async sendAlertEmail(to: string, subject: string, message: string) {
    const dashboardUrl = `${this.configService.get<string>('FRONTEND_URL')}/alerts`;
    await this.send(
      to,
      `SentinelAI alert: ${subject}`,
      `<p>${message}</p><p><a href="${dashboardUrl}">View all alerts</a></p>`,
      `${message}\n\nView all alerts: ${dashboardUrl}`,
    );
  }

  async sendContactMessage(params: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const recipient = this.configService.get<string>('CONTACT_EMAIL');
    if (!recipient) {
      this.logger.warn(
        'CONTACT_EMAIL is not configured — logging this contact form submission instead of routing it to anyone. ' +
          'Set CONTACT_EMAIL to receive these.',
      );
    }
    await this.send(
      recipient ?? 'unconfigured-contact-recipient@sentinelai.local',
      `[Contact form] ${params.subject}`,
      `<p><strong>From:</strong> ${params.name} &lt;${params.email}&gt;</p><p>${params.message}</p>`,
      `From: ${params.name} <${params.email}>\n\n${params.message}`,
    );
  }

  async sendInvitationEmail(
    to: string,
    organizationName: string,
    inviterName: string,
    token: string,
  ) {
    const acceptUrl = `${this.configService.get<string>('FRONTEND_URL')}/invitations/${token}`;
    await this.send(
      to,
      `${inviterName} invited you to join ${organizationName} on SentinelAI`,
      `<p>${inviterName} has invited you to join <strong>${organizationName}</strong> on SentinelAI. ` +
        `Click <a href="${acceptUrl}">here</a> to accept. This invitation expires in 7 days.</p>`,
      `${inviterName} has invited you to join ${organizationName} on SentinelAI: ${acceptUrl} (expires in 7 days)`,
    );
  }

  async sendDigestEmail(
    to: string,
    organizationName: string,
    period: 'daily' | 'weekly',
    alerts: { severity: string; message: string }[],
  ) {
    const dashboardUrl = `${this.configService.get<string>('FRONTEND_URL')}/alerts`;
    const periodLabel = period === 'daily' ? 'day' : 'week';
    const subject =
      alerts.length > 0
        ? `Your ${period} SentinelAI summary for ${organizationName}: ${alerts.length} alert(s)`
        : `Your ${period} SentinelAI summary for ${organizationName}: all clear`;

    const listHtml = alerts
      .map((a) => `<li>[${a.severity}] ${a.message}</li>`)
      .join('');
    const listText = alerts
      .map((a) => `- [${a.severity}] ${a.message}`)
      .join('\n');

    await this.send(
      to,
      subject,
      `<p>Here's what happened with ${organizationName} over the last ${periodLabel}.</p>` +
        (alerts.length > 0
          ? `<ul>${listHtml}</ul>`
          : `<p>No new alerts — nothing needs your attention.</p>`) +
        `<p><a href="${dashboardUrl}">View all alerts</a></p>`,
      `Here's what happened with ${organizationName} over the last ${periodLabel}.\n\n` +
        (alerts.length > 0
          ? listText
          : 'No new alerts — nothing needs your attention.') +
        `\n\nView all alerts: ${dashboardUrl}`,
    );
  }

  async sendReportEmail(to: string, reportTitle: string, pdfPath: string) {
    await this.send(
      to,
      `SentinelAI report: ${reportTitle}`,
      `<p>Your requested security report "${reportTitle}" is attached.</p>`,
      `Your requested security report "${reportTitle}" is attached.`,
      [
        {
          filename: `${reportTitle.replace(/[^a-z0-9-_ ]/gi, '')}.pdf`,
          path: pdfPath,
        },
      ],
    );
  }
}
