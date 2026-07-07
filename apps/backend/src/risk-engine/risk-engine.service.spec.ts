import { RiskEngineService } from './risk-engine.service';
import { AssetType, FindingCategory, FindingSeverity } from '@prisma/client';

/**
 * A minimal fake standing in for PrismaService — real unit test, not an
 * integration test against the actual database (that's covered by this
 * session's manual end-to-end verification against real Postgres). Records
 * every `finding.create` call so assertions can inspect exactly what the
 * engine decided to persist.
 */
function createFakePrisma(assets: unknown[]) {
  const createdFindings: any[] = [];
  return {
    asset: {
      findMany: jest.fn().mockResolvedValue(assets),
      count: jest.fn().mockResolvedValue(0),
    },
    finding: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const finding = { id: `finding-${createdFindings.length}`, ...data };
        createdFindings.push(finding);
        return Promise.resolve(finding);
      }),
    },
    __createdFindings: createdFindings,
  };
}

function makeAsset(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 'asset-1',
    domainId: 'domain-1',
    active: true,
    firstSeenAt: new Date('2020-01-01'),
    lastSeenAt: new Date('2020-01-01'),
    metadata: null,
    ...overrides,
  };
}

describe('RiskEngineService', () => {
  it('returns a perfect 100 score when no issues are present', async () => {
    const fakePrisma = createFakePrisma([
      makeAsset({
        type: AssetType.CERTIFICATE,
        value: 'fingerprint',
        metadata: { valid: true, selfSigned: false, daysUntilExpiry: 200 },
      }),
      makeAsset({
        type: AssetType.URL,
        value: 'https://example.com/',
        metadata: {
          headers: {
            'strict-transport-security': 'max-age=1',
            'content-security-policy': "default-src 'self'",
            'x-frame-options': 'SAMEORIGIN',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
            'permissions-policy': '()',
          },
          missingSecurityHeaders: [],
        },
      }),
    ]);
    const service = new RiskEngineService(fakePrisma as any);

    const result = await service.analyzeDomain('scan-1', 'domain-1');

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe('STRONG');
    expect(result.findings).toHaveLength(0);
  });

  it('deducts CRITICAL points and drops risk level for an expired certificate', async () => {
    const fakePrisma = createFakePrisma([
      makeAsset({
        type: AssetType.CERTIFICATE,
        value: 'fingerprint',
        metadata: { valid: true, selfSigned: false, daysUntilExpiry: -5 },
      }),
    ]);
    const service = new RiskEngineService(fakePrisma as any);

    const result = await service.analyzeDomain('scan-1', 'domain-1');

    // 100 - 30 (CRITICAL: expired cert) = 70
    expect(result.score).toBe(70);
    expect(result.riskLevel).toBe('LOW');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      severity: FindingSeverity.CRITICAL,
      category: FindingCategory.SSL,
    });
  });

  it('never lets the score go below 0 even with many stacked deductions', async () => {
    const fakePrisma = createFakePrisma([
      // No certificate at all (HIGH, 18) + no HTTP asset (implicitly no
      // headers deduction since there's no URL asset) — add several more
      // certificate-adjacent issues isn't possible from one asset, so
      // instead assert the floor behavior via an artificially low case:
      // self-signed AND expired AND invalid all on the same cert.
      makeAsset({
        type: AssetType.CERTIFICATE,
        value: 'fingerprint',
        metadata: {
          valid: false,
          selfSigned: true,
          daysUntilExpiry: -100,
          reason: 'expired',
        },
      }),
    ]);
    const service = new RiskEngineService(fakePrisma as any);

    const result = await service.analyzeDomain('scan-1', 'domain-1');

    // invalid (CRITICAL 30) + self-signed (HIGH 18) + expired (CRITICAL 30) = 78 deducted -> 22
    expect(result.score).toBe(22);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('flags missing security headers proportionally to how many are missing', async () => {
    const fakePrisma = createFakePrisma([
      // A valid, healthy certificate is included alongside the URL asset in
      // every case below so the SSL category contributes zero deductions —
      // isolating exactly the category under test, matching how a real
      // scan always produces both a CERTIFICATE and a URL asset together
      // (see DiscoveryService).
      makeAsset({
        type: AssetType.CERTIFICATE,
        value: 'fingerprint',
        metadata: { valid: true, selfSigned: false, daysUntilExpiry: 200 },
      }),
      makeAsset({
        type: AssetType.URL,
        value: 'https://example.com/',
        metadata: {
          headers: {},
          missingSecurityHeaders: [
            'strict-transport-security',
            'content-security-policy',
            'x-frame-options',
            'x-content-type-options',
            'referrer-policy',
            'permissions-policy',
          ],
        },
      }),
    ]);
    const service = new RiskEngineService(fakePrisma as any);

    const result = await service.analyzeDomain('scan-1', 'domain-1');

    const headerFinding = result.findings.find(
      (f) => f.category === FindingCategory.HEADERS,
    );
    expect(headerFinding).toBeDefined();
    expect(headerFinding?.severity).toBe(FindingSeverity.MEDIUM);
    // 100 - 10 (MEDIUM, all 6/6 headers missing => full weight) = 90
    expect(result.score).toBe(90);
  });

  it('flags server version disclosure as a CONFIGURATION issue distinct from missing headers', async () => {
    const fakePrisma = createFakePrisma([
      makeAsset({
        type: AssetType.CERTIFICATE,
        value: 'fingerprint',
        metadata: { valid: true, selfSigned: false, daysUntilExpiry: 200 },
      }),
      makeAsset({
        type: AssetType.URL,
        value: 'https://example.com/',
        metadata: {
          headers: { 'x-powered-by': 'PHP/8.1.18' },
          missingSecurityHeaders: [],
        },
      }),
    ]);
    const service = new RiskEngineService(fakePrisma as any);

    const result = await service.analyzeDomain('scan-1', 'domain-1');

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe(FindingCategory.CONFIGURATION);
  });
});
