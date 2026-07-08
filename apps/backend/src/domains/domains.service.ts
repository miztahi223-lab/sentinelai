import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /** Throws if the user isn't a member of the organization. */
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

  async create(userId: string, organizationId: string, name: string) {
    await this.assertMembership(userId, organizationId);

    const existing = await this.prisma.domain.findUnique({
      where: { organizationId_name: { organizationId, name } },
    });
    if (existing) {
      throw new ConflictException(
        'This domain is already tracked for this organization',
      );
    }

    const domain = await this.prisma.domain.create({
      data: {
        organizationId,
        name,
        verificationToken: randomBytes(16).toString('hex'),
      },
    });

    await this.auditLogsService.record({
      organizationId,
      userId,
      action: 'domain.added',
      metadata: { name },
    });

    return domain;
  }

  async findAllForOrganization(userId: string, organizationId: string) {
    await this.assertMembership(userId, organizationId);

    return this.prisma.domain.findMany({
      where: { organizationId },
      include: { _count: { select: { assets: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
      include: { assets: true },
    });
    if (!domain) return null;
    await this.assertMembership(userId, domain.organizationId);
    return domain;
  }
}
