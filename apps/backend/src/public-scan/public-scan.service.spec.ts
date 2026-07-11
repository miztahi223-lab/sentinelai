import { PublicScanService } from './public-scan.service';
import type { DnsLookupResult } from '../discovery/dns.service';
import type { SslInspectionResult } from '../discovery/ssl.service';
import type { HttpProbeResult } from '../discovery/http.service';

function emptyDns(): DnsLookupResult {
  return {
    a: [],
    aaaa: [],
    cname: [],
    mx: [],
    txt: [],
    ns: [],
    resolvedAt: new Date('2020-01-01'),
  };
}

/**
 * Real unit test over `PublicScanService`'s scoring/aggregation logic —
 * `DnsService`/`SslService`/`HttpService`/`TechnologyService` are mocked
 * (they're each already covered by their own real-network tests elsewhere),
 * but the code under test here is the same shared `scoring.util.ts` formula
 * `RiskEngineService` uses, exercised through this service's own
 * aggregation/sorting/reachability logic.
 */
describe('PublicScanService', () => {
  function makeService(overrides: {
    dns?: Partial<DnsLookupResult>;
    dmarc?: Partial<DnsLookupResult>;
    ssl?: Partial<SslInspectionResult>;
    http?: Partial<HttpProbeResult>;
    missingHeaders?: string[];
  }) {
    const dnsService = {
      lookup: jest
        .fn()
        .mockResolvedValueOnce({ ...emptyDns(), ...overrides.dns })
        .mockResolvedValueOnce({ ...emptyDns(), ...overrides.dmarc }),
    };
    const sslService = {
      inspect: jest.fn().mockResolvedValue({ valid: true, ...overrides.ssl }),
    };
    const httpService = {
      probe: jest
        .fn()
        .mockResolvedValue({ reachable: true, ...overrides.http }),
    };
    const technologyService = {
      missingSecurityHeaders: jest
        .fn()
        .mockReturnValue(overrides.missingHeaders ?? []),
    };
    return new PublicScanService(
      dnsService as any,
      sslService as any,
      httpService as any,
      technologyService as any,
    );
  }

  it('returns a perfect 100 score with STRONG risk when nothing is wrong', async () => {
    const service = makeService({
      dns: { txt: [['v=spf1 -all']] },
      dmarc: { txt: [['v=DMARC1; p=reject']] },
      ssl: {
        valid: true,
        subject: 'example.com',
        fingerprint256: 'AA:BB',
        daysUntilExpiry: 200,
      },
      http: { reachable: true, headers: {} },
    });

    const result = await service.scan('example.com');

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe('STRONG');
    expect(result.topFinding).toBeNull();
    expect(result.additionalFindingsCount).toBe(0);
    expect(result.reachable).toBe(true);
  });

  it('deducts for a missing TLS certificate and surfaces it as the top finding', async () => {
    const service = makeService({
      dns: { txt: [['v=spf1 -all']] },
      dmarc: { txt: [['v=DMARC1; p=reject']] },
      ssl: { valid: false, reason: 'No certificate presented' },
      http: { reachable: true, headers: {} },
    });

    const result = await service.scan('insecure.example.com');

    expect(result.score).toBeLessThan(100);
    expect(result.topFinding?.title).toBe('No valid TLS certificate observed');
  });

  it('deducts for missing SPF/DMARC records independently of SSL/headers', async () => {
    const service = makeService({
      dns: { txt: [] },
      dmarc: { txt: [] },
      ssl: {
        valid: true,
        subject: 'example.com',
        fingerprint256: 'AA:BB',
        daysUntilExpiry: 200,
      },
      http: { reachable: true, headers: {} },
    });

    const result = await service.scan('example.com');

    expect(result.score).toBe(80); // 100 - 10 (no SPF) - 10 (no DMARC)
    expect(result.additionalFindingsCount).toBe(1); // one shown as top, one more
  });

  it('reports unreachable when there is no HTTP response and no A/AAAA records', async () => {
    const service = makeService({
      dns: { a: [], aaaa: [] },
      http: { reachable: false },
    });

    const result = await service.scan('nonexistent.invalid');

    expect(result.reachable).toBe(false);
  });

  it('considers a domain reachable when DNS resolves even if HTTP is unreachable', async () => {
    const service = makeService({
      dns: { a: ['93.184.216.34'] },
      http: { reachable: false },
    });

    const result = await service.scan('dns-only.example.com');

    expect(result.reachable).toBe(true);
  });

  it('floors the score at 0 when deductions exceed 100 points', async () => {
    const service = makeService({
      dns: { txt: [] },
      dmarc: { txt: [] },
      ssl: {
        valid: false,
        selfSigned: true,
        daysUntilExpiry: -5,
        subject: 'broken.example.com',
        fingerprint256: 'AA:BB',
      },
      http: { reachable: true, headers: {} },
      missingHeaders: [
        'strict-transport-security',
        'content-security-policy',
        'x-frame-options',
        'x-content-type-options',
        'referrer-policy',
        'permissions-policy',
      ],
    });

    const result = await service.scan('very-broken.example.com');

    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.additionalFindingsCount).toBeGreaterThan(0);
  });
});
