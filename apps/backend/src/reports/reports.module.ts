import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './report.processor';
import { QueueModule } from '../queue/queue.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [QueueModule, OrganizationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
