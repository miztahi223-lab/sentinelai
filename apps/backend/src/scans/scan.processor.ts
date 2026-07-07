import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AlertType, FindingSeverity, ScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';
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

    try {
      const result = await this.discoveryService.runForDomain(
        domainId,
        hostname,
      );
      const scan = await this.prisma.scan.findUniqueOrThrow({
        where: { id: scanId },
      });

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

      await this.prisma.scan.update({
        where: { id: scanId },
        data: { status: ScanStatus.COMPLETED, finishedAt: new Date() },
      });

      this.logger.log(
        `Scan ${scanId} completed: ${result.assetsObserved} assets observed, ` +
          `${result.newAssets.length} new, ${result.removedAssets.length} removed`,
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
