import {
  BadGatewayException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AiNotConfiguredError, AiProviderError, AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Translates the AI service's typed errors into the right HTTP status:
   * 503 when there's no key configured at all (a deployment/config issue),
   * 502 when a key is configured but the provider itself rejected/failed
   * the request (an upstream issue, distinct from "not configured" — e.g.
   * an invalid/revoked key, rate limiting, or a provider outage).
   */
  private async runAiCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AiNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof AiProviderError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }

  @Post('findings/:findingId/analyze')
  async analyzeFinding(
    @Param('findingId') findingId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scan: true },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    const membership = await this.organizationsService.getMembership(
      user.userId,
      finding.scan.organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this finding');
    }

    return this.runAiCall(async () => {
      const analysis = await this.aiService.analyzeFinding(finding);
      return this.prisma.finding.update({
        where: { id: findingId },
        data: {
          aiExplanation: analysis.explanation,
          aiBusinessImpact: analysis.businessImpact,
          aiRemediation: analysis.remediation,
        },
      });
    });
  }

  @Post('scans/:scanId/executive-summary')
  async executiveSummary(
    @Param('scanId') scanId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { findings: true, domain: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');

    const membership = await this.organizationsService.getMembership(
      user.userId,
      scan.organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this scan');
    }

    const totalDeduction = scan.findings.reduce((sum, f) => {
      const points = { CRITICAL: 30, HIGH: 18, MEDIUM: 10, LOW: 4, INFO: 0 }[
        f.severity
      ];
      return sum + points;
    }, 0);
    const score = Math.max(0, Math.min(100, 100 - totalDeduction));

    return this.runAiCall(async () => {
      const summary = await this.aiService.generateExecutiveSummary({
        domainName: scan.domain?.name ?? 'unknown domain',
        score,
        findingCount: scan.findings.length,
        topFindings: scan.findings
          .sort((a, b) => (a.severity > b.severity ? -1 : 1))
          .slice(0, 5)
          .map((f) => ({ severity: f.severity, title: f.title })),
      });
      // Not persisted: `Report` doesn't have a summary-text column yet
      // (Step 12 will decide whether executive summaries belong on Report
      // or should stay computed-on-demand like this) — returned directly
      // rather than adding a schema migration speculatively.
      return { summary };
    });
  }
}
