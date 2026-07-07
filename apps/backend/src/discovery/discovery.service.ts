import { Injectable, Logger } from '@nestjs/common';
import { Asset, AssetType, Prisma } from '@prisma/client';
import { DnsService } from './dns.service';
import { SslService } from './ssl.service';
import { HttpService } from './http.service';
import { TechnologyService } from './technology.service';
import { AssetService } from './asset.service';
import { SubdomainService } from './subdomain.service';

export interface DiscoveryRunSummary {
  domainId: string;
  hostname: string;
  assetsObserved: number;
  newAssets: Asset[];
  removedAssets: Asset[];
  dns: {
    aRecords: number;
    aaaaRecords: number;
    mxRecords: number;
  };
  ssl: { inspected: boolean; valid?: boolean; daysUntilExpiry?: number };
  http: { reachable: boolean; statusCode?: number };
  technologies: string[];
  subdomainsFound: number;
  startedAt: Date;
  finishedAt: Date;
}

// Bounds how many *discovered* subdomains get a full HTTP+technology probe
// on top of the plain DNS enumeration — the wordlist itself is bounded, but
// this is a second, independent safety cap in case an unusual domain (e.g.
// a wildcard DNS record matching every candidate) makes an implausibly
// large fraction of candidates resolve, so one scan can't balloon into
// dozens of extra outbound HTTP probes.
const MAX_SUBDOMAINS_TO_PROBE = 25;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly dnsService: DnsService,
    private readonly sslService: SslService,
    private readonly httpService: HttpService,
    private readonly technologyService: TechnologyService,
    private readonly assetService: AssetService,
    private readonly subdomainService: SubdomainService,
  ) {}

  async runForDomain(
    domainId: string,
    hostname: string,
  ): Promise<DiscoveryRunSummary> {
    const startedAt = new Date();
    this.logger.log(`Starting discovery for ${hostname}`);
    const observedAssetIds: string[] = [];
    const newAssets: Asset[] = [];

    const [dnsResult, sslResult, httpResult, discoveredSubdomains] =
      await Promise.all([
        this.dnsService.lookup(hostname),
        this.sslService.inspect(hostname),
        this.httpService.probe(hostname),
        this.subdomainService.enumerate(hostname),
      ]);

    const track = (result: { asset: Asset; isNew: boolean }) => {
      observedAssetIds.push(result.asset.id);
      if (result.isNew) newAssets.push(result.asset);
    };

    // --- Persist IP assets from A/AAAA records ---
    for (const ip of [...dnsResult.a, ...dnsResult.aaaa]) {
      track(
        await this.assetService.upsertObservedAsset({
          domainId,
          type: AssetType.IP,
          value: ip,
          metadata: {
            source: 'dns',
            resolvedAt: dnsResult.resolvedAt.toISOString(),
          },
        }),
      );
    }

    // --- Persist CNAME targets as subdomain-type assets (they're hostnames,
    // not the domain itself) ---
    for (const target of dnsResult.cname) {
      track(
        await this.assetService.upsertObservedAsset({
          domainId,
          type: AssetType.SUBDOMAIN,
          value: target,
          metadata: { source: 'dns-cname' },
        }),
      );
    }

    // --- Persist certificate asset ---
    let technologies: string[] = [];
    if (sslResult.subject || sslResult.fingerprint256) {
      track(
        await this.assetService.upsertObservedAsset({
          domainId,
          type: AssetType.CERTIFICATE,
          value: sslResult.fingerprint256 ?? `${hostname}:443`,
          metadata: JSON.parse(
            JSON.stringify({
              ...sslResult,
              validFrom: sslResult.validFrom?.toISOString(),
              validTo: sslResult.validTo?.toISOString(),
            }),
          ) as Prisma.InputJsonValue,
        }),
      );
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

      track(
        await this.assetService.upsertObservedAsset({
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
        }),
      );
    }

    // --- Persist discovered subdomains, and probe the most interesting
    // ones for real HTTP reachability/technology — this is the actual core
    // value proposition of an attack-surface-monitoring product: most
    // organizations already know about their main site, they don't
    // reliably know about every `staging.`/`jenkins.`/`old.` subdomain
    // they've ever stood up, and a forgotten one is very often where the
    // real exposure is. ---
    const toProbe = discoveredSubdomains.slice(0, MAX_SUBDOMAINS_TO_PROBE);
    const probeResults = await Promise.all(
      toProbe.map(async (sub) => {
        const probe = await this.httpService.probe(sub.hostname);
        return { sub, probe };
      }),
    );

    for (const { sub, probe } of probeResults) {
      const matches = probe.reachable
        ? this.technologyService.detect(probe.headers ?? {}, probe.bodySnippet)
        : [];
      track(
        await this.assetService.upsertObservedAsset({
          domainId,
          type: AssetType.SUBDOMAIN,
          value: sub.hostname,
          metadata: JSON.parse(
            JSON.stringify({
              source: 'subdomain-enumeration',
              addresses: sub.addresses,
              httpReachable: probe.reachable,
              statusCode: probe.statusCode,
              scheme: probe.scheme,
              technologies: matches,
            }),
          ) as Prisma.InputJsonValue,
        }),
      );
    }

    // Any enumerated candidates beyond the probe cap still get recorded as
    // assets (we know they exist — DNS said so) even though we didn't spend
    // an extra HTTP round-trip confirming what's running on them.
    for (const sub of discoveredSubdomains.slice(MAX_SUBDOMAINS_TO_PROBE)) {
      track(
        await this.assetService.upsertObservedAsset({
          domainId,
          type: AssetType.SUBDOMAIN,
          value: sub.hostname,
          metadata: {
            source: 'subdomain-enumeration',
            addresses: sub.addresses,
            httpReachable: null,
          },
        }),
      );
    }

    const removedAssets = await this.assetService.markStaleAssetsInactive(
      domainId,
      observedAssetIds,
    );

    const finishedAt = new Date();
    this.logger.log(
      `Discovery for ${hostname} finished in ${finishedAt.getTime() - startedAt.getTime()}ms — ` +
        `${observedAssetIds.length} assets observed (${discoveredSubdomains.length} subdomains found), ${newAssets.length} new, ${removedAssets.length} removed`,
    );

    return {
      domainId,
      hostname,
      assetsObserved: observedAssetIds.length,
      newAssets,
      removedAssets,
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
      subdomainsFound: discoveredSubdomains.length,
      startedAt,
      finishedAt,
    };
  }
}
