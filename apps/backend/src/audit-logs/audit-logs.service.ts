import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

const LIST_LIMIT = 100;

export interface RecordAuditLogParams {
  organizationId?: string;
  userId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * The `AuditLog` model has existed since Step 4 of the original build but
 * was never actually written to anywhere — a real, if quiet, gap for a
 * product that explicitly markets itself on the landing page as "built
 * the way a security tool should be". Real customers in this space
 * (security-conscious orgs, the exact audience this product targets)
 * routinely expect an audit trail of who did what — this closes that.
 *
 * Deliberately "best effort, after the real action already succeeded"
 * rather than wrapped in the same DB transaction as the action being
 * logged: an audit-log write failing should never be able to roll back
 * (or block) the actual operation it's describing, and a swallowed
 * logging error is a fair trade for that guarantee — it's logged via the
 * app's own logger if it happens, not silently eaten.
 */
@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async record(params: RecordAuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          userId: params.userId,
          action: params.action,
          metadata: params.metadata ?? Prisma.JsonNull,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record audit log entry for action "${params.action}": ${(error as Error).message}`,
      );
    }
  }

  /**
   * Restricted to OWNER/ADMIN (same `assertManagerMembership` boundary as
   * billing and team-invitation management) — an audit trail of the whole
   * organization's activity is itself sensitive, not something every
   * regular MEMBER should be able to browse.
   */
  async findForOrganization(userId: string, organizationId: string) {
    await this.organizationsService.assertManagerMembership(
      userId,
      organizationId,
    );
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
