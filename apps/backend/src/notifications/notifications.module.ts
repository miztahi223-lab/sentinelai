import { Module } from '@nestjs/common';
import { NotificationProcessor } from './notification.processor';
import { QueueModule } from '../queue/queue.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [QueueModule, EmailModule],
  providers: [NotificationProcessor],
})
export class NotificationsModule {}
