import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DnsService } from './dns.service';
import { SslService } from './ssl.service';
import { HttpService } from './http.service';
import { TechnologyService } from './technology.service';
import { AssetService } from './asset.service';
import { SubdomainService } from './subdomain.service';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DnsService,
    SslService,
    HttpService,
    TechnologyService,
    AssetService,
    SubdomainService,
  ],
  exports: [DiscoveryService, AssetService],
})
export class DiscoveryModule {}
