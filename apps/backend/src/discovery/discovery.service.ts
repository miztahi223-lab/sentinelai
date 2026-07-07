import { Injectable, Logger } from '@nestjs/common';
import { AssetType, Prisma } from '@prisma/client';
import { DnsService } from './dns.service';
import { SslService } from './ssl.service';
import { HttpService } from './http.service';
import { TechnologyService } from './technology.service';
import { AssetService } from './asset.service';

export interface DiscoveryRunSummary {
  domainId: string;
  hostname: string;
  assetsObserved: number;
  assetsMarkedInactive: number;
  dns: {
    aRecords: number;
    aaaaRecords: number;
    mxRecords: number;
  };
  ssl: { inspected: boolean; valid?: boolean; daysUntilExpiry?: number };
  http: { reachable: boolean; statusCode?: number };
  technologies: string[];
  startedAt: Date;
  finishedAt: Date;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly dnsService: DnsService,
    private readonly sslService: SslService,
    private readonly httpService: HttpService,
    private readonly technologyService: TechnologyService,
    private readonly assetService: AssetService,
  ) {}

  async runForDomain(
    domainId: string,
    hostname: string,
  ): Promise<DiscoveryRunSummary> {
    const startedAt = new Date();
    this.logger.log(`Starting discovery for ${hostname}`);
    const observedAssetIds: string[] = [];

    const [dnsResult, sslResult, httpResult] = await Promise.all([
      this.dnsService.lookup(hostname),
      this.sslService.inspect(hostname),
      this.httpService.probe(hostname),
    ]);

    // --- Persist IP assets from A/AAAA records ---
    for (const ip of [...dnsResult.a, ...dnsResult.aaaa]) {
      const asset = await this.assetService.upsertObservedAsset({
        domainId,
        type: AssetType.IP,
        value: ip,
        metadata: {
          source: 'dns',
          resolvedAt: dnsResult.resolvedAt.toISOString(),
        },
      });
      observedAssetIds.push(asset.id);
    }

    // --- Persist CNAME targets as subdomain-type assets (they're hostnames,
    // not the domain itself) ---
    for (const target of dnsResult.cname) {
      const asset = await this.assetService.upsertObservedAsset({
        domainId,
        type: AssetType.SUBDOMAIN,
        value: target,
        metadata: { source: 'dns-cname' },
      });
      observedAssetIds.push(asset.id);
    }

    // --- Persist certificate asset ---
    let technologies: string[] = [];
    if (sslResult.subject || sslResult.fingerprint256) {
      const asset = await this.assetService.upsertObservedAsset({
        domainId,
        type: AssetType.CERTIFICATE,
        value: sslResult.fingerprint256 ?? `${hostname}:443`,
        metadata: {
          ...sslResult,
          validFrom: sslResult.validFrom?.toISOString(),
          validTo: sslResult.validTo?.toISOString(),
        },
      });
      observedAssetIds.push(asset.id);
    }

    // --- Persist HTTP service asset + run technology detection ---
    if (httpResult.reachable) {
      const matches = this.technologyService.detect(
        httpResult.headers ?? {},
        httpResult.bodySnippet,
      );
      const missingHeaders = this.technologyService.missingSecurityHeaders(
        httpResult.headers ?? {},
      );
      technologies = matches.map((m) => m.name);

      const asset = await this.assetService.upsertObservedAsset({
        domainId,
        type: AssetType.URL,
        value: httpResult.finalUrl ?? `https://${hostname}/`,
        // Round-tripped through JSON to guarantee this is actually
        // plain-JSON-serializable (not just structurally close enough for
        // TypeScript) before Prisma's InputJsonValue type is asserted.
        metadata: JSON.parse(
          JSON.stringify({
            statusCode: httpResult.statusCode,
            scheme: httpResult.scheme,
            responseTimeMs: httpResult.responseTimeMs,
            headers: httpResult.headers,
            technologies: matches,
            missingSecurityHeaders: missingHeaders,
          }),
        ) as Prisma.InputJsonValue,
      });
      observedAssetIds.push(asset.id);
    }

    const assetsMarkedInactive =
      await this.assetService.markStaleAssetsInactive(
        domainId,
        observedAssetIds,
      );

    const finishedAt = new Date();
    this.logger.log(
      `Discovery for ${hostname} finished in ${finishedAt.getTime() - startedAt.getTime()}ms — ${observedAssetIds.length} assets observed`,
    );

    return {
      domainId,
      hostname,
      assetsObserved: observedAssetIds.length,
      assetsMarkedInactive,
      dns: {
        aRecords: dnsResult.a.length,
        aaaaRecords: dnsResult.aaaa.length,
        mxRecords: dnsResult.mx.length,
      },
      ssl: {
        inspected: !!(sslResult.subject || sslResult.fingerprint256),
        valid: sslResult.valid,
        daysUntilExpiry: sslResult.daysUntilExpiry,
      },
      http: {
        reachable: httpResult.reachable,
        statusCode: httpResult.statusCode,
      },
      technologies,
      startedAt,
      finishedAt,
    };
  }
}
