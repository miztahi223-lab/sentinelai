import { Injectable, Logger } from '@nestjs/common';
import {
  Asset,
  AssetType,
  Finding,
  FindingCategory,
  FindingSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'STRONG';

export interface RiskAnalysisResult {
  score: number; // 0-100, higher is better (matches the dashboard's SecurityScoreCard)
  riskLevel: RiskLevel;
  categories: Record<FindingCategory, { deduction: number; findings: number }>;
  recommendations: string[];
  findings: Finding[];
}

interface Deduction {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  points: number;
  evidence?: Record<string, unknown>;
}

const SEVERITY_POINTS: Record<FindingSeverity, number> = {
  CRITICAL: 30,
  HIGH: 18,
  MEDIUM: 10,
  LOW: 4,
  INFO: 0,
};

/**
 * Turns a domain's current asset snapshot into a 0-100 security score plus
 * a set of persisted `Finding` rows explaining exactly why. Deliberately a
 * straightforward, auditable point-deduction model (start at 100, subtract
 * per issue, floor at 0) rather than a black-box ML score — every point
 * lost is traceable to a specific, real signal captured during discovery
 * (Step 7), not a heuristic guess.
 */
@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeDomain(
    scanId: string,
    domainId: string,
  ): Promise<RiskAnalysisResult> {
    const assets = await this.prisma.asset.findMany({
      where: { domainId, active: true },
    });

    const deductions: Deduction[] = [
      ...this.evaluateSsl(assets),
      ...this.evaluateHeadersAndConfig(assets),
      ...this.evaluateExposure(assets),
      ...(await this.evaluateAssetChurn(domainId)),
    ];

    const findings: Finding[] = [];
    for (const d of deductions) {
      const asset = assets.find(
        (a) => a.type === AssetType.CERTIFICATE || a.type === AssetType.URL,
      );
      const finding = await this.prisma.finding.create({
        data: {
          scanId,
          assetId: asset?.id,
          severity: d.severity,
          category: d.category,
          title: d.title,
          description: d.description,
          evidence: d.evidence
            ? (JSON.parse(JSON.stringify(d.evidence)) as Prisma.InputJsonValue)
            : undefined,
        },
      });
      findings.push(finding);
    }

    const totalDeduction = deductions.reduce((sum, d) => sum + d.points, 0);
    const score = Math.max(0, Math.min(100, 100 - totalDeduction));

    const categories = this.summarizeByCategory(deductions);
    const recommendations = deductions
      .sort((a, b) => b.points - a.points)
      .map((d) => d.description);

    this.logger.log(
      `Risk analysis for domain ${domainId}: score ${score}/100, ${findings.length} finding(s)`,
    );

    return {
      score,
      riskLevel: this.scoreToRiskLevel(score),
      categories,
      recommendations,
      findings,
    };
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 90) return 'STRONG';
    if (score >= 70) return 'LOW';
    if (score >= 50) return 'MEDIUM';
    if (score >= 30) return 'HIGH';
    return 'CRITICAL';
  }

  // --- SSL category ---
  private evaluateSsl(assets: Asset[]): Deduction[] {
    const cert = assets.find((a) => a.type === AssetType.CERTIFICATE);
    const deductions: Deduction[] = [];

    if (!cert) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.HIGH,
        title: 'No valid TLS certificate observed',
        description:
          'No TLS certificate could be retrieved on port 443 — the site may be HTTP-only or unreachable over HTTPS.',
        points: SEVERITY_POINTS.HIGH,
      });
      return deductions;
    }

    const meta = cert.metadata as Record<string, unknown> | null;
    const valid = meta?.valid as boolean | undefined;
    const selfSigned = meta?.selfSigned as boolean | undefined;
    const daysUntilExpiry = meta?.daysUntilExpiry as number | undefined;
    const reason = typeof meta?.reason === 'string' ? meta.reason : undefined;

    if (valid === false) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.CRITICAL,
        title: 'Invalid TLS certificate',
        description: `The presented TLS certificate failed validation${reason ? `: ${reason}` : ''}.`,
        points: SEVERITY_POINTS.CRITICAL,
        evidence: { reason },
      });
    }

    if (selfSigned) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.HIGH,
        title: 'Self-signed TLS certificate',
        description:
          'The TLS certificate is self-signed rather than issued by a trusted CA — browsers/clients will not trust this connection by default.',
        points: SEVERITY_POINTS.HIGH,
      });
    }

    if (typeof daysUntilExpiry === 'number') {
      if (daysUntilExpiry <= 0) {
        deductions.push({
          category: FindingCategory.SSL,
          severity: FindingSeverity.CRITICAL,
          title: 'TLS certificate has expired',
          description: 'The TLS certificate has already expired.',
          points: SEVERITY_POINTS.CRITICAL,
        });
      } else if (daysUntilExpiry <= 7) {
        deductions.push({
          category: FindingCategory.SSL,
          severity: FindingSeverity.HIGH,
          title: 'TLS certificate expires within 7 days',
          description: `TLS certificate expires in ${daysUntilExpiry} day(s) — renew it before it lapses.`,
          points: SEVERITY_POINTS.HIGH,
        });
      } else if (daysUntilExpiry <= 30) {
        deductions.push({
          category: FindingCategory.SSL,
          severity: FindingSeverity.MEDIUM,
          title: 'TLS certificate expires within 30 days',
          description: `TLS certificate expires in ${daysUntilExpiry} day(s) — schedule a renewal.`,
          points: SEVERITY_POINTS.MEDIUM,
        });
      }
    }

    return deductions;
  }

  // --- Headers / Configuration category ---
  private evaluateHeadersAndConfig(assets: Asset[]): Deduction[] {
    const urlAsset = assets.find((a) => a.type === AssetType.URL);
    if (!urlAsset) return [];

    const meta = urlAsset.metadata as Record<string, unknown> | null;
    const missingHeaders =
      (meta?.missingSecurityHeaders as string[] | undefined) ?? [];
    const headers = (meta?.headers as Record<string, string> | undefined) ?? {};
    const deductions: Deduction[] = [];

    if (missingHeaders.length > 0) {
      deductions.push({
        category: FindingCategory.HEADERS,
        severity:
          missingHeaders.length >= 4
            ? FindingSeverity.MEDIUM
            : FindingSeverity.LOW,
        title: `${missingHeaders.length} recommended security header(s) missing`,
        description: `Missing security headers: ${missingHeaders.join(', ')}. Adding these reduces exposure to clickjacking, MIME-sniffing, and downgrade attacks.`,
        points:
          (missingHeaders.length >= 4
            ? SEVERITY_POINTS.MEDIUM
            : SEVERITY_POINTS.LOW) * Math.min(1, missingHeaders.length / 6),
        evidence: { missingHeaders },
      });
    }

    // Server/X-Powered-By headers that reveal specific software versions
    // make it trivially easy to match the target against known CVEs for
    // that exact version — a configuration issue distinct from "missing
    // security header" above.
    const versionLeakHeaders = ['x-powered-by', 'x-aspnet-version'];
    const leaked = versionLeakHeaders.filter((h) => headers[h]);
    if (leaked.length > 0) {
      deductions.push({
        category: FindingCategory.CONFIGURATION,
        severity: FindingSeverity.LOW,
        title: 'Server technology version disclosed in response headers',
        description: `Response headers reveal specific server technology (${leaked.map((h) => `${h}: ${headers[h]}`).join(', ')}), making it easier to target known vulnerabilities for that exact version.`,
        points: SEVERITY_POINTS.LOW,
        evidence: { leaked: leaked.map((h) => ({ [h]: headers[h] })) },
      });
    }

    return deductions;
  }

  // --- Exposure category ---
  private evaluateExposure(assets: Asset[]): Deduction[] {
    const ipCount = assets.filter((a) => a.type === AssetType.IP).length;
    const deductions: Deduction[] = [];

    // A modest, capped deduction for a large exposed IP footprint — more
    // exposed endpoints is more attack surface, but this is intentionally
    // a small weight since a large IP count is often just normal
    // CDN/anycast behavior (as seen with Cloudflare in Step 7's real test),
    // not itself a misconfiguration.
    if (ipCount > 4) {
      const points = Math.min(8, (ipCount - 4) * 2);
      deductions.push({
        category: FindingCategory.EXPOSURE,
        severity: FindingSeverity.LOW,
        title: `Large number of exposed IP addresses (${ipCount})`,
        description: `${ipCount} distinct IP addresses are associated with this domain, increasing the attack surface to monitor.`,
        points,
        evidence: { ipCount },
      });
    }

    return deductions;
  }

  // --- Asset changes category ---
  private async evaluateAssetChurn(domainId: string): Promise<Deduction[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentChanges = await this.prisma.asset.count({
      where: {
        domainId,
        OR: [
          { firstSeenAt: { gte: sevenDaysAgo } },
          { active: false, lastSeenAt: { gte: sevenDaysAgo } },
        ],
      },
    });

    if (recentChanges === 0) return [];

    return [
      {
        category: FindingCategory.ASSET_CHANGE,
        severity: FindingSeverity.INFO,
        title: `${recentChanges} asset change(s) in the last 7 days`,
        description: `${recentChanges} asset(s) newly appeared or disappeared in the last 7 days — review recent changes to confirm they were expected.`,
        points: Math.min(5, recentChanges),
        evidence: { recentChanges },
      },
    ];
  }

  private summarizeByCategory(
    deductions: Deduction[],
  ): Record<FindingCategory, { deduction: number; findings: number }> {
    const base: Record<
      FindingCategory,
      { deduction: number; findings: number }
    > = {
      SSL: { deduction: 0, findings: 0 },
      HEADERS: { deduction: 0, findings: 0 },
      EXPOSURE: { deduction: 0, findings: 0 },
      CONFIGURATION: { deduction: 0, findings: 0 },
      ASSET_CHANGE: { deduction: 0, findings: 0 },
      DNS: { deduction: 0, findings: 0 },
      TECHNOLOGY: { deduction: 0, findings: 0 },
    };
    for (const d of deductions) {
      base[d.category].deduction += d.points;
      base[d.category].findings += 1;
    }
    return base;
  }
}
