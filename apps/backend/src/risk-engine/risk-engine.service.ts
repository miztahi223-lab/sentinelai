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
import {
  evaluateDnsSignal,
  evaluateHeaderSignal,
  evaluateSslSignal,
  scoreToRiskLevel,
  RiskLevel,
} from './scoring.util';

export type { RiskLevel };

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
      ...this.evaluateDns(assets),
      ...(await this.evaluateAssetChurn(domainId)),
    ].map((d) => ({ ...d, points: Math.round(d.points) }));

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
          points: d.points,
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
      riskLevel: scoreToRiskLevel(score),
      categories,
      recommendations,
      findings,
    };
  }

  // --- SSL category --- (shared formula: see `evaluateSslSignal`)
  private evaluateSsl(assets: Asset[]): Deduction[] {
    const cert = assets.find((a) => a.type === AssetType.CERTIFICATE);
    const meta = (cert?.metadata as Record<string, unknown> | null) ?? null;

    const deductions = evaluateSslSignal({
      inspected: !!cert,
      valid: meta?.valid as boolean | undefined,
      selfSigned: meta?.selfSigned as boolean | undefined,
      daysUntilExpiry: meta?.daysUntilExpiry as number | undefined,
      reason: typeof meta?.reason === 'string' ? meta.reason : undefined,
    });

    return deductions.map((d) => ({
      ...d,
      evidence: meta?.reason ? { reason: meta.reason } : undefined,
    }));
  }

  // --- Headers / Configuration category --- (shared formula: see `evaluateHeaderSignal`)
  private evaluateHeadersAndConfig(assets: Asset[]): Deduction[] {
    const urlAsset = assets.find((a) => a.type === AssetType.URL);
    if (!urlAsset) return [];

    const meta = urlAsset.metadata as Record<string, unknown> | null;
    const missingHeaders =
      (meta?.missingSecurityHeaders as string[] | undefined) ?? [];
    const headers = (meta?.headers as Record<string, string> | undefined) ?? {};

    return evaluateHeaderSignal({
      reachable: true,
      missingSecurityHeaders: missingHeaders,
      headers,
    }).map((d) => ({
      ...d,
      evidence:
        d.category === FindingCategory.HEADERS
          ? { missingHeaders }
          : {
              leaked: ['x-powered-by', 'x-aspnet-version']
                .filter((h) => headers[h])
                .map((h) => ({ [h]: headers[h] })),
            },
    }));
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

  // --- DNS category --- (shared formula: see `evaluateDnsSignal`)
  private evaluateDns(assets: Asset[]): Deduction[] {
    const dnsAsset = assets.find((a) => a.type === AssetType.DNS);
    if (!dnsAsset) return [];

    const meta = dnsAsset.metadata as Record<string, unknown> | null;
    return evaluateDnsSignal({
      hasSpf: !!meta?.hasSpf,
      hasDmarc: !!meta?.hasDmarc,
    });
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
