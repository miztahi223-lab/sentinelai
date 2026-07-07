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
import { ScanStatus } from '@prisma/client';

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

    const totalDeduction = scan.findings.reduce((sum, f) => {
      const points = { CRITICAL: 30, HIGH: 18, MEDIUM: 10, LOW: 4, INFO: 0 }[
        f.severity
      ];
      return sum + points;
    }, 0);
    const score = Math.max(0, Math.min(100, 100 - totalDeduction));

    return {
      hasScan: true,
      scanId: scan.id,
      scannedAt: scan.finishedAt,
      score,
      findings: scan.findings,
    };
  }
}
