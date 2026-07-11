import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WebhookService } from './webhook.service';
import {
  NOTIFICATION_QUEUE,
  NotificationJobData,
} from '../queue/queue.constants';

/**
 * BullMQ worker for the `notifications` queue. Consumes a single alert ID
 * and emails every OWNER/ADMIN member of the alert's organization —
 * deliberately not every member, so routine "member" accounts aren't
 * spammed for infrastructure alerts they likely can't act on anyway — then
 * also delivers to this organization's real configured webhook/Slack
 * channels, if any (`NotificationSettings`). Only ever reached for
 * HIGH/CRITICAL alerts in the first place (see `scan.processor.ts`'s
 * `NOTIFY_SEVERITIES`), so every channel here is already scoped to the
 * same "critical alerts" policy without needing its own severity filter.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly webhookService: WebhookService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { alertId } = job.data;

    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      this.logger.warn(`Alert ${alertId} not found — skipping notification`);
      return;
    }

    const recipients = await this.prisma.membership.findMany({
      where: {
        organizationId: alert.organizationId,
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      },
      include: { user: true },
    });

    const subject = `${alert.severity} — ${alert.type.replace(/_/g, ' ').toLowerCase()}`;

    for (const membership of recipients) {
      await this.emailService.sendAlertEmail(
        membership.user.email,
        subject,
        alert.message,
      );
    }

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { organizationId: alert.organizationId },
    });
    if (settings?.webhookUrl) {
      await this.webhookService.sendWebhook(settings.webhookUrl, {
        alertId: alert.id,
        severity: alert.severity,
        type: alert.type,
        message: alert.message,
        createdAt: alert.createdAt,
      });
    }
    if (settings?.slackWebhookUrl) {
      await this.webhookService.sendSlackMessage(
        settings.slackWebhookUrl,
        `*${subject}*\n${alert.message}`,
      );
    }

    this.logger.log(
      `Notified ${recipients.length} recipient(s) for alert ${alertId} (${alert.type})` +
        `${settings?.webhookUrl ? ', webhook' : ''}${settings?.slackWebhookUrl ? ', Slack' : ''}`,
    );
  }
}
