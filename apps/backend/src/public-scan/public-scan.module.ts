import { Module } from '@nestjs/common';
import { PublicScanController } from './public-scan.controller';
import { PublicScanService } from './public-scan.service';
import { DnsModule } from '../discovery/dns.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [DnsModule, DiscoveryModule],
  controllers: [PublicScanController],
  providers: [PublicScanService],
})
export class PublicScanModule {}
