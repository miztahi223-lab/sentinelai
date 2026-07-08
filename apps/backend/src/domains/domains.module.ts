import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [OrganizationsModule, AuditLogsModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
