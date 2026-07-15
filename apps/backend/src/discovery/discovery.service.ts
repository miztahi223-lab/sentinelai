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
    // Optional: called with a 0-1 fraction as the scan actually
    // progresses, so a caller (`ScanProcessor`) can persist a real
    // percentage rather than just pending/running/done. Weighted toward
    // the subdomain HTTP-probe loop below since that's the dominant real
    // cost of a scan (confirmed by timing an actual production run —
    // DNS/SSL/root-HTTP/subdomain-enumeration together take well under a
    // second; probing each discovered subdomain is where real wall-clock
    // time goes).
    onProgress?: (fraction: number) => void,
  ): Promise<DiscoveryRunSummary> {
    const startedAt = new Date();
    this.logger.log(`Starting discovery for ${hostname}`);
    const observedAssetIds: string[] = [];
    const newAssets: Asset[] = [];
    const report = (fraction: number) => onProgress?.(Math.min(1, fraction));

    report(0.05);
    const [
      dnsResult,
      dmarcResult,
      sslResult,
      httpResult,
      discoveredSubdomains,
    ] = await Promise.all([
      this.dnsService.lookup(hostname),
      // DMARC lives at a fixed `_dmarc.` subdomain, not the domain's own
      // TXT records — a real, separate lookup, not derived from the one
      // above.
      this.dnsService.lookup(`_dmarc.${hostname}`),
      this.sslService.inspect(hostname),
      this.httpService.probe(hostname),
      this.subdomainService.enumerate(hostname),
    ]);
    report(0.15);

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

    // --- Persist a DNS security-hygiene asset (SPF/DMARC presence) ---
    // Real signal from real TXT lookups, not inferred — an email domain
    // with neither record is genuinely easier to spoof, the same real
    // finding a dedicated email-security scanner would flag.
    const hasSpf = dnsResult.txt.some((chunks) =>
      chunks.join('').toLowerCase().startsWith('v=spf1'),
    );
    const hasDmarc = dmarcResult.txt.some((chunks) =>
      chunks.join('').toLowerCase().startsWith('v=dmarc1'),
    );
    track(
      await this.assetService.upsertObservedAsset({
        domainId,
        type: AssetType.DNS,
        value: hostname,
        metadata: { hasSpf, hasDmarc },
      }),
    );

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
    let probesCompleted = 0;
    const probeResults = await Promise.all(
      toProbe.map(async (sub) => {
        const probe = await this.httpService.probe(sub.hostname);
        probesCompleted += 1;
        // 0.15-0.85 range: this loop is the dominant real cost of a scan
        // (see the comment on `onProgress` above), so it gets most of the
        // progress bar's range. Guards `toProbe.length === 0` (no
        // subdomains found — the whole range collapses to the 0.15 floor
        // instead of a division by zero).
        report(0.15 + 0.7 * (probesCompleted / Math.max(toProbe.length, 1)));
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
    report(0.95);

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
