import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { REPORT_QUEUE, ReportJobData } from '../queue/queue.constants';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    @InjectQueue(REPORT_QUEUE)
    private readonly reportQueue: Queue<ReportJobData>,
  ) {}

  async createAndEnqueue(
    userId: string,
    organizationId: string,
    scanId: string | undefined,
    title: string | undefined,
  ) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        organizationId,
        scanId,
        title:
          title ?? `Security report — ${new Date().toISOString().slice(0, 10)}`,
      },
    });

    await this.reportQueue.add('generate-report', {
      reportId: report.id,
      organizationId,
      scanId,
    });

    return report;
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
    return this.prisma.report.findMany({
      where: { organizationId },
      orderBy: { generatedAt: 'desc' },
    });
  }
}
