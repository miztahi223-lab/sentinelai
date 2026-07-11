import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './report.processor';
import { PdfGeneratorService } from './pdf-generator.service';
import { QueueModule } from '../queue/queue.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    QueueModule,
    OrganizationsModule,
    EmailModule,
    UsersModule,
    AiModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportProcessor, PdfGeneratorService],
  exports: [ReportsService],
})
export class ReportsModule {}
