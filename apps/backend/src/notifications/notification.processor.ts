import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  NOTIFICATION_QUEUE,
  NotificationJobData,
} from '../queue/queue.constants';

/**
 * BullMQ worker for the `notifications` queue. Consumes a single alert ID
 * and emails every OWNER/ADMIN member of the alert's organization —
 * deliberately not every member, so routine "member" accounts aren't
 * spammed for infrastructure alerts they likely can't act on anyway.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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

    for (const membership of recipients) {
      await this.emailService.sendAlertEmail(
        membership.user.email,
        `${alert.severity} — ${alert.type.replace(/_/g, ' ').toLowerCase()}`,
        alert.message,
      );
    }

    this.logger.log(
      `Notified ${recipients.length} recipient(s) for alert ${alertId} (${alert.type})`,
    );
  }
}
