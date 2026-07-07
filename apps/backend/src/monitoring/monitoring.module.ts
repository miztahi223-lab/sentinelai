import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringService } from './monitoring.service';
import { ScansModule } from '../scans/scans.module';

@Module({
  imports: [ScheduleModule.forRoot(), ScansModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
