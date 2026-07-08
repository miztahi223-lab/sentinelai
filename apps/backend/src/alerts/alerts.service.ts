import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

// Alerts accumulate forever otherwise (every scan can add several) — a
// dashboard notification list showing hundreds of months-old rows isn't
// useful to anyone, so this is a hard cap on a single listing call, not a
// true pagination scheme (nothing in this build's UI needs to page past
// "the most recent N" yet).
const LIST_LIMIT = 100;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private async assertMembership(userId: string, organizationId: string) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
  }

  async findAllForOrganization(userId: string, organizationId: string) {
    await this.assertMembership(userId, organizationId);
    return this.prisma.alert.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { finding: { select: { title: true, category: true } } },
    });
  }

  async markRead(userId: string, alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.assertMembership(userId, alert.organizationId);
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string, organizationId: string) {
    await this.assertMembership(userId, organizationId);
    const result = await this.prisma.alert.updateMany({
      where: { organizationId, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }
}
