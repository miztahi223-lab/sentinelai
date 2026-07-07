import { Module } from '@nestjs/common';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { ScanProcessor } from './scan.processor';
import { QueueModule } from '../queue/queue.module';
import { DomainsModule } from '../domains/domains.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';

@Module({
  imports: [
    QueueModule,
    DomainsModule,
    OrganizationsModule,
    DiscoveryModule,
    RiskEngineModule,
  ],
  controllers: [ScansController],
  providers: [ScansService, ScanProcessor],
  exports: [ScansService],
})
export class ScansModule {}
