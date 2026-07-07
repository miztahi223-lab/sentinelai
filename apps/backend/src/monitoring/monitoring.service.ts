import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ScansService } from '../scans/scans.service';

/**
 * The "monitoring engine": periodically re-scans every tracked domain
 * without any user action, so drift (new subdomains, expiring certs,
 * disappeared assets) is caught between manual visits to the dashboard.
 *
 * Deliberately simple for now — one fixed daily schedule for every domain,
 * not yet a configurable per-organization/per-plan frequency (Free/Starter/
 * Professional/Business are meant to differ on scan frequency per Step 13's
 * plan table, but that requires a scan-frequency field/plan-gating decision
 * that hasn't been made yet — noted as a follow-up, not silently ignored).
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scansService: ScansService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailySweep(): Promise<void> {
    const domains = await this.prisma.domain.findMany({
      select: { id: true, name: true, organizationId: true },
    });

    this.logger.log(
      `Daily monitoring sweep: scheduling scans for ${domains.length} domain(s)`,
    );

    for (const domain of domains) {
      try {
        await this.scansService.createSystemScan(
          domain.id,
          domain.organizationId,
          domain.name,
        );
      } catch (error) {
        // One domain failing to enqueue shouldn't stop the rest of the
        // sweep from being scheduled.
        this.logger.error(
          `Failed to schedule monitoring scan for domain ${domain.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Exposed so this can be triggered on demand (e.g. from a test, or a
   * future "run monitoring sweep now" admin action) without waiting for
   * midnight.
   */
  async triggerSweepNow(): Promise<number> {
    await this.runDailySweep();
    return this.prisma.domain.count();
  }
}
