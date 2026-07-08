import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { DomainsService } from '../domains/domains.service';
import { PrismaService } from '../prisma/prisma.service';
import { Finding, ScanStatus } from '@prisma/client';

// Kept in one place so `latestForDomain` and `historyForDomain` can never
// silently drift into computing the score two different ways.
const SEVERITY_POINTS: Record<Finding['severity'], number> = {
  CRITICAL: 30,
  HIGH: 18,
  MEDIUM: 10,
  LOW: 4,
  INFO: 0,
};

function scoreFromFindings(findings: Pick<Finding, 'severity'>[]): number {
  const totalDeduction = findings.reduce(
    (sum, f) => sum + SEVERITY_POINTS[f.severity],
    0,
  );
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

// How many historical data points the trend chart shows — a cap, not a
// time window, since scan frequency varies by plan (Step 13's Free=weekly
// vs paid=daily copy) and "last 30 scans" is a more meaningful trend line
// than "last 30 days" would be for an infrequently-scanned domain.
const HISTORY_LIMIT = 30;

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskEngineController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the findings (and derivable score) from the most recent
   * completed scan for a domain. Risk analysis itself always runs
   * synchronously as part of scan processing (see `ScanProcessor`) — this
   * endpoint just surfaces the latest persisted result rather than
   * recomputing anything, so it's cheap to poll from the dashboard.
   */
  @Get('domains/:domainId/latest')
  async latestForDomain(
    @Param('domainId') domainId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const domain = await this.domainsService.findOne(user.userId, domainId);
    if (!domain) throw new NotFoundException('Domain not found');

    const scan = await this.prisma.scan.findFirst({
      where: { domainId, status: ScanStatus.COMPLETED },
      orderBy: { finishedAt: 'desc' },
      include: { findings: true },
    });

    if (!scan) {
      return { hasScan: false, findings: [], score: null };
    }

    return {
      hasScan: true,
      scanId: scan.id,
      scannedAt: scan.finishedAt,
      score: scoreFromFindings(scan.findings),
      findings: scan.findings,
    };
  }

  /**
   * Real historical score data for the trend chart (`RiskChart`,
   * introduced back in Step 6 but never actually wired to anything —
   * every completed scan's findings are already persisted, so this is
   * genuine history, not synthesized/interpolated data pretending to be
   * one).
   */
  @Get('domains/:domainId/history')
  async historyForDomain(
    @Param('domainId') domainId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const domain = await this.domainsService.findOne(user.userId, domainId);
    if (!domain) throw new NotFoundException('Domain not found');

    const scans = await this.prisma.scan.findMany({
      where: { domainId, status: ScanStatus.COMPLETED },
      orderBy: { finishedAt: 'desc' },
      take: HISTORY_LIMIT,
      include: { findings: true },
    });

    // Reversed back to chronological order for the chart (oldest → newest,
    // left → right) after fetching "most recent N" from the database.
    return scans.reverse().map((scan) => ({
      scanId: scan.id,
      date: scan.finishedAt,
      score: scoreFromFindings(scan.findings),
    }));
  }
}
