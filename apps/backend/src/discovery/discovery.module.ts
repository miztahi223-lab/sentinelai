import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DnsModule } from './dns.module';
import { SslService } from './ssl.service';
import { HttpService } from './http.service';
import { TechnologyService } from './technology.service';
import { AssetService } from './asset.service';
import { SubdomainService } from './subdomain.service';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule, DnsModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    SslService,
    HttpService,
    TechnologyService,
    AssetService,
    SubdomainService,
  ],
  exports: [
    DiscoveryService,
    AssetService,
    SslService,
    HttpService,
    TechnologyService,
  ],
})
export class DiscoveryModule {}
