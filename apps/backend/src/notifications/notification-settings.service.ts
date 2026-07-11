import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

export interface UpdateNotificationSettingsInput {
  webhookUrl?: string | null;
  slackWebhookUrl?: string | null;
  dailyDigestEnabled?: boolean;
  weeklyDigestEnabled?: boolean;
}

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Any real member can see whether channels are configured (so they
   * understand why/how they're being notified) — returns real defaults
   * (nothing configured) rather than 404 for an org that's never touched
   * this settings page.
   */
  async get(userId: string, organizationId: string) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const existing = await this.prisma.notificationSettings.findUnique({
      where: { organizationId },
    });
    return (
      existing ?? {
        organizationId,
        webhookUrl: null,
        slackWebhookUrl: null,
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
      }
    );
  }

  /** Changing where/whether alerts get delivered is an OWNER/ADMIN action. */
  async update(
    userId: string,
    organizationId: string,
    input: UpdateNotificationSettingsInput,
  ) {
    await this.organizationsService.assertManagerMembership(
      userId,
      organizationId,
    );

    return this.prisma.notificationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
    });
  }
}
