import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { REPORT_QUEUE, ReportJobData } from '../queue/queue.constants';

/**
 * BullMQ worker for the `reports` queue. Generates a real PDF (via
 * `PdfGeneratorService`) from the organization's most recent completed
 * scan for the given domain — or, if a specific `scanId` was requested,
 * that exact scan — and stores its path on the `Report` row.
 */
@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, organizationId, scanId } = job.data;
    this.logger.log(
      `Generating report ${reportId} for organization ${organizationId}`,
    );

    try {
      const organization = await this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });

      const scan = scanId
        ? await this.prisma.scan.findUnique({
            where: { id: scanId },
            include: { findings: true, domain: true },
          })
        : await this.prisma.scan.findFirst({
            where: { organizationId, status: ScanStatus.COMPLETED },
            orderBy: { finishedAt: 'desc' },
            include: { findings: true, domain: true },
          });

      const assets = scan?.domainId
        ? await this.prisma.asset.findMany({
            where: { domainId: scan.domainId, active: true },
          })
        : [];

      const totalDeduction = (scan?.findings ?? []).reduce((sum, f) => {
        const points = { CRITICAL: 30, HIGH: 18, MEDIUM: 10, LOW: 4, INFO: 0 }[
          f.severity
        ];
        return sum + points;
      }, 0);
      const score = scan
        ? Math.max(0, Math.min(100, 100 - totalDeduction))
        : null;

      const filePath = await this.pdfGenerator.generate(reportId, {
        organization,
        domainName: scan?.domain?.name ?? 'No domain scanned yet',
        score,
        assets,
        findings: scan?.findings ?? [],
        generatedAt: new Date(),
      });

      await this.prisma.report.update({
        where: { id: reportId },
        data: { fileUrl: filePath },
      });

      this.logger.log(`Report ${reportId} generated at ${filePath}`);
    } catch (error) {
      this.logger.error(
        `Report ${reportId} generation failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
