import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DnsModule } from '../discovery/dns.module';

// `DiscoveryModule` also imports `DnsModule` (for scanning) — this is a
// diamond, not a cycle: `DnsModule` has no dependencies of its own and
// doesn't import `DomainsModule` or `DiscoveryModule` back.
@Module({
  imports: [OrganizationsModule, AuditLogsModule, DnsModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
