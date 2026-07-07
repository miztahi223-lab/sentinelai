import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_QUEUE, ReportJobData } from '../queue/queue.constants';

/**
 * BullMQ worker for the `reports` queue.
 *
 * The actual PDF generation service is Step 12 of the build and is not
 * implemented yet. Rather than fabricate a fake PDF/URL here to make this
 * look more finished than it is, this worker honestly marks the report
 * row as failed with a clear reason — the queue plumbing (enqueue, worker
 * picks it up, updates the DB row) is real and already end-to-end wired,
 * so Step 12 only has to add the actual rendering logic in place of the
 * `NotImplementedError` below, not build any of this infrastructure.
 */
@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId } = job.data;
    this.logger.warn(
      `Report ${reportId} requested but PDF generation (Step 12) isn't implemented yet`,
    );

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        fileUrl: null,
      },
    });

    throw new Error(
      'Report generation is not implemented yet (Step 12 of the build) — ' +
        'the report row was created and this job ran, but no PDF was produced.',
    );
  }
}
