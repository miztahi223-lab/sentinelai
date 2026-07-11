import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Finding, ScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { REPORT_QUEUE, ReportJobData } from '../queue/queue.constants';
import {
  categoryBreakdown,
  scoreFromFindings,
} from '../risk-engine/scoring.util';
import { AiService } from '../ai/ai.service';

const CATEGORY_LABEL: Record<string, string> = {
  SSL: 'website encryption (SSL/TLS)',
  HEADERS: 'security headers',
  EXPOSURE: 'online exposure',
  CONFIGURATION: 'server configuration',
  DNS: 'email & DNS security',
  ASSET_CHANGE: 'recent changes',
  TECHNOLOGY: 'technology disclosure',
};

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
    private readonly aiService: AiService,
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

      const findings = scan?.findings ?? [];
      const score = scan ? scoreFromFindings(findings) : null;
      const categories = categoryBreakdown(findings);
      const domainName = scan?.domain?.name ?? 'No domain scanned yet';

      const executiveSummary = await this.buildExecutiveSummary({
        domainName,
        score,
        findings,
        categories,
      });

      const filePath = await this.pdfGenerator.generate(reportId, {
        organization,
        domainName,
        score,
        categories,
        executiveSummary,
        assets,
        findings,
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

  /**
   * Uses the real AI-generated executive summary when a real `AI_API_KEY`
   * is configured. When it isn't (this build environment has none — see
   * `ai.service.ts`), falls back to a real, deterministic paragraph
   * computed directly from this exact scan's real numbers — never
   * fabricated-sounding prose standing in for a feature that isn't
   * actually configured.
   */
  private async buildExecutiveSummary(params: {
    domainName: string;
    score: number | null;
    findings: Finding[];
    categories: ReturnType<typeof categoryBreakdown>;
  }): Promise<string> {
    const { domainName, score, findings, categories } = params;

    if (score === null) {
      return `No completed scan is available yet for ${domainName}. Run a scan to generate a real executive summary.`;
    }

    if (this.aiService.isConfigured()) {
      try {
        return await this.aiService.generateExecutiveSummary({
          domainName,
          score,
          findingCount: findings.length,
          topFindings: [...findings]
            .sort((a, b) => b.points - a.points)
            .slice(0, 5)
            .map((f) => ({ severity: f.severity, title: f.title })),
        });
      } catch (error) {
        this.logger.warn(
          `AI executive summary failed, falling back to a computed summary: ${(error as Error).message}`,
        );
      }
    }

    const topCategoryEntry = Object.entries(categories)
      .filter(([, v]) => v.deduction > 0)
      .sort((a, b) => b[1].deduction - a[1].deduction)[0];
    const urgentCount = findings.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    ).length;

    const sentences = [
      `This report covers a security scan of ${domainName}, with an overall security score of ${score}/100.`,
    ];
    if (findings.length === 0) {
      sentences.push('No issues were found in this scan.');
    } else if (topCategoryEntry) {
      const [category, { deduction, findings: count }] = topCategoryEntry;
      sentences.push(
        `${findings.length} finding(s) were identified across this scan, with ${CATEGORY_LABEL[category] ?? category} contributing the most (${count} finding(s), ${deduction} point(s)).`,
      );
    }
    sentences.push(
      urgentCount > 0
        ? `${urgentCount} finding(s) are high-severity or above and should be addressed first.`
        : 'No high-severity or critical findings were identified in this scan.',
    );
    return sentences.join(' ');
  }
}
