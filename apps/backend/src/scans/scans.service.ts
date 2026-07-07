import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScanStatus, ScanType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { SCAN_QUEUE, ScanJobData } from '../queue/queue.constants';

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainsService: DomainsService,
    private readonly organizationsService: OrganizationsService,
    @InjectQueue(SCAN_QUEUE) private readonly scanQueue: Queue<ScanJobData>,
  ) {}

  /**
   * Creates a `Scan` row in PENDING state and enqueues a BullMQ job to
   * actually run it. Returns immediately — the caller gets a scan ID to
   * poll/subscribe to rather than waiting for the (potentially slow)
   * DNS/TLS/HTTP probes to complete inline, which is the whole point of
   * moving this to a background worker (Step 8) instead of the
   * synchronous `POST /discovery/domains/:id/run` from Step 7.
   */
  async createAndEnqueue(userId: string, domainId: string) {
    const domain = await this.domainsService.findOne(userId, domainId);
    if (!domain) throw new NotFoundException('Domain not found');

    const scan = await this.prisma.scan.create({
      data: {
        organizationId: domain.organizationId,
        domainId: domain.id,
        type: ScanType.MANUAL,
        status: ScanStatus.PENDING,
        triggeredBy: userId,
      },
    });

    await this.scanQueue.add(
      'run-scan',
      { scanId: scan.id, domainId: domain.id, hostname: domain.name },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );

    return scan;
  }

  async findOne(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { findings: true },
    });
    if (!scan) return null;

    const membership = await this.organizationsService.getMembership(
      userId,
      scan.organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this scan');
    }
    return scan;
  }

  async findAllForOrganization(userId: string, organizationId: string) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    return this.prisma.scan.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
