import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Real daily/weekly summary emails — an organization opts in per digest
 * (`NotificationSettings.dailyDigestEnabled`/`weeklyDigestEnabled`, off by
 * default so nobody gets a summary they didn't ask for), sent to the same
 * OWNER/ADMIN recipients real-time alert emails already go to
 * (`NotificationProcessor`), built from the exact same real `Alert` rows —
 * not a separately-invented rollup.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyDigests(): Promise<void> {
    await this.sendDigests('daily', DAY_MS);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklyDigests(): Promise<void> {
    await this.sendDigests('weekly', 7 * DAY_MS);
  }

  private async sendDigests(
    period: 'daily' | 'weekly',
    windowMs: number,
  ): Promise<void> {
    const flagField =
      period === 'daily' ? 'dailyDigestEnabled' : 'weeklyDigestEnabled';

    const settingsList = await this.prisma.notificationSettings.findMany({
      where: { [flagField]: true },
      include: { organization: true },
    });

    this.logger.log(
      `Sending ${period} digests to ${settingsList.length} organization(s)`,
    );

    const since = new Date(Date.now() - windowMs);

    for (const settings of settingsList) {
      const alerts = await this.prisma.alert.findMany({
        where: {
          organizationId: settings.organizationId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      });

      const recipients = await this.prisma.membership.findMany({
        where: {
          organizationId: settings.organizationId,
          role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
        },
        include: { user: true },
      });

      for (const membership of recipients) {
        await this.emailService.sendDigestEmail(
          membership.user.email,
          settings.organization.name,
          period,
          alerts,
        );
      }
    }
  }

  /** Exposed so a digest can be triggered on demand (e.g. from a test)
   * without waiting for the real cron schedule. */
  async triggerNow(period: 'daily' | 'weekly'): Promise<void> {
    await this.sendDigests(period, period === 'daily' ? DAY_MS : 7 * DAY_MS);
  }
}
