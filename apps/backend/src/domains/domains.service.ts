import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DnsService } from '../discovery/dns.service';

// The exact TXT record value a real owner has to publish to prove control
// of the domain — same real DNS TXT lookup the discovery module already
// uses (`DnsService`), not a new verification mechanism invented just for
// this. Matches the industry-standard pattern (Google Search Console,
// Stripe, etc. all use a `<vendor>-verification=<token>` TXT record).
export function verificationTxtValue(token: string): string {
  return `domecortex-verify=${token}`;
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly dnsService: DnsService,
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

  /**
   * Checks the domain's real DNS for the TXT record the owner was asked to
   * publish, and marks it verified the moment it's genuinely there — never
   * flips `verified` to `true` without actually finding it, since this flag
   * is what "this organization really controls this domain" means
   * elsewhere in the product.
   */
  async verify(userId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain) throw new NotFoundException('Domain not found');
    await this.assertMembership(userId, domain.organizationId);

    if (domain.verified) return domain;

    const { txt } = await this.dnsService.lookup(domain.name);
    const expected = verificationTxtValue(domain.verificationToken ?? '');
    const found = txt.some((record) => record.join('').trim() === expected);

    if (!found) {
      throw new BadRequestException(
        `Verification TXT record not found yet for ${domain.name}. DNS changes can take a few minutes to propagate — try again shortly.`,
      );
    }

    const verified = await this.prisma.domain.update({
      where: { id: domainId },
      data: { verified: true },
    });

    await this.auditLogsService.record({
      organizationId: domain.organizationId,
      userId,
      action: 'domain.verified',
      metadata: { name: domain.name },
    });

    return verified;
  }
}
