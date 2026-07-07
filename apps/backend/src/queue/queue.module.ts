import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  SCAN_QUEUE,
  REPORT_QUEUE,
  NOTIFICATION_QUEUE,
} from './queue.constants';

/**
 * Central place that wires BullMQ up to Redis and declares every queue used
 * in the app. Feature modules import this and register their own
 * processors against the queue name they care about — this module doesn't
 * define any processing logic itself, only the connection + queue
 * definitions, so it can be imported without pulling in unrelated worker
 * code.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: SCAN_QUEUE },
      { name: REPORT_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
