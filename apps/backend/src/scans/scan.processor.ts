import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AlertType, FindingSeverity, ScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import {
  NOTIFICATION_QUEUE,
  NotificationJobData,
  SCAN_QUEUE,
  ScanJobData,
} from '../queue/queue.constants';

const NOTIFY_SEVERITIES: FindingSeverity[] = [
  FindingSeverity.CRITICAL,
  FindingSeverity.HIGH,
];

/**
 * BullMQ worker for the `scans` queue. This is what actually runs a scan —
 * `ScansService.createAndEnqueue` only creates the DB row and hands the job
 * off; all the real work (and all the failure handling) happens here, off
 * the request/response cycle.
 */
@Processor(SCAN_QUEUE)
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: DiscoveryService,
    private readonly riskEngineService: RiskEngineService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobData>,
  ) {
    super();
  }

  /**
   * Creates an Alert row and — only for HIGH/CRITICAL severity — enqueues a
   * notification job to actually email someone about it. Routine INFO/LOW
   * alerts (a new subdomain showing up, one asset no longer resolving) are
   * still recorded and visible in the dashboard, just not emailed; that
   * would be noisy enough that real alerts get ignored.
   */
  private async createAlert(data: {
    organizationId: string;
    type: AlertType;
    severity: FindingSeverity;
    message: string;
  }) {
    const alert = await this.prisma.alert.create({ data });
    if (NOTIFY_SEVERITIES.includes(alert.severity)) {
      await this.notificationQueue.add('notify', { alertId: alert.id });
    }
    return alert;
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const { scanId, domainId, hostname } = job.data;
    this.logger.log(
      `Processing scan ${scanId} for ${hostname} (attempt ${job.attemptsMade + 1})`,
    );

    await this.prisma.scan.update({
      where: { id: scanId },
      data: { status: ScanStatus.RUNNING, startedAt: new Date() },
    });

    // Throttled to at most one write per 5%, not per callback — the probe
    // loop this ultimately tracks can fire many times a second, and there
    // is no value in hitting Postgres that often for a number a client is
    // polling every few seconds at most. Fire-and-forget (not awaited): a
    // progress update is a nice-to-have, not something worth blocking or
    // failing the actual scan over if one write is slow/errors.
    let lastReportedBucket = -1;
    const reportProgress = (fraction: number) => {
      const bucket = Math.floor((fraction * 100) / 5);
      if (bucket === lastReportedBucket) return;
      lastReportedBucket = bucket;
      this.prisma.scan
        .update({
          where: { id: scanId },
          data: { progress: Math.round(fraction * 100) },
        })
        .catch((error: Error) =>
          this.logger.warn(
            `Scan ${scanId}: failed to persist progress: ${error.message}`,
          ),
        );
    };

    try {
      // Discovery's own duration is already logged by
      // `DiscoveryService.runForDomain` itself — no need for a second,
      // redundant timer around the same call here.
      const result = await this.discoveryService.runForDomain(
        domainId,
        hostname,
        reportProgress,
      );
      const scan = await this.prisma.scan.findUniqueOrThrow({
        where: { id: scanId },
      });

      const alertsStart = Date.now();
      for (const asset of result.newAssets) {
        await this.createAlert({
          organizationId: scan.organizationId,
          type: AlertType.NEW_ASSET,
          severity: FindingSeverity.INFO,
          message: `New ${asset.type.toLowerCase()} discovered: ${asset.value}`,
        });
      }

      for (const asset of result.removedAssets) {
        await this.createAlert({
          organizationId: scan.organizationId,
          type: AlertType.REMOVED_ASSET,
          severity: FindingSeverity.LOW,
          message: `${asset.type} no longer observed: ${asset.value}`,
        });
      }

      // A certificate close to expiry is worth its own explicit alert,
      // independent of whether the certificate asset row itself is "new".
      if (result.ssl.inspected && (result.ssl.daysUntilExpiry ?? 999) <= 30) {
        await this.createAlert({
          organizationId: scan.organizationId,
          type: AlertType.CERTIFICATE_CHANGE,
          severity:
            (result.ssl.daysUntilExpiry ?? 0) <= 7
              ? FindingSeverity.HIGH
              : FindingSeverity.MEDIUM,
          message: `TLS certificate for ${hostname} expires in ${result.ssl.daysUntilExpiry} day(s)`,
        });
      }

      this.logger.debug(
        `Scan ${scanId}: alerts phase took ${Date.now() - alertsStart}ms (${result.newAssets.length} new, ${result.removedAssets.length} removed)`,
      );

      // Risk analysis (Step 10) runs as the last step of every scan, over
      // the asset snapshot discovery just persisted — this is what
      // produces the `Finding` rows and score the dashboard reads.
      const riskStart = Date.now();
      const risk = await this.riskEngineService.analyzeDomain(scanId, domainId);
      this.logger.debug(
        `Scan ${scanId}: risk-engine phase took ${Date.now() - riskStart}ms`,
      );

      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.COMPLETED,
          finishedAt: new Date(),
          progress: 100,
        },
      });

      this.logger.log(
        `Scan ${scanId} completed: ${result.assetsObserved} assets observed, ` +
          `${result.newAssets.length} new, ${result.removedAssets.length} removed, ` +
          `risk score ${risk.score}/100 (${risk.riskLevel}), ${risk.findings.length} finding(s)`,
      );
    } catch (error) {
      this.logger.error(`Scan ${scanId} failed: ${(error as Error).message}`);
      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      throw error; // let BullMQ's retry/backoff (configured at enqueue time) take over
    }
  }
}
