import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationProcessor } from './notification.processor';
import { QueueModule } from '../queue/queue.module';
import { EmailModule } from '../email/email.module';
import { WebhookService } from './webhook.service';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DigestService } from './digest.service';

@Module({
  imports: [
    QueueModule,
    EmailModule,
    OrganizationsModule,
    // Safe to import alongside `MonitoringModule`'s own `ScheduleModule.forRoot()`
    // — Nest's `@Cron` discovery scans every provider app-wide regardless of
    // which module registered the schedule module.
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationSettingsController],
  providers: [
    NotificationProcessor,
    WebhookService,
    NotificationSettingsService,
    DigestService,
  ],
  exports: [NotificationSettingsService],
})
export class NotificationsModule {}
