import { Module } from '@nestjs/common';
import { DnsService } from './dns.service';

// A dedicated module for `DnsService` (which has no dependencies of its
// own) so both `DiscoveryModule` and `DomainsModule` can use real DNS
// lookups without creating a circular import between them — `DomainsModule`
// needs it for ownership verification (a real TXT record check), and
// `DiscoveryModule` (which already depends on `DomainsModule`) needs it for
// scanning.
@Module({
  providers: [DnsService],
  exports: [DnsService],
})
export class DnsModule {}
