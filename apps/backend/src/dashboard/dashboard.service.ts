import { ForbiddenException, Injectable } from '@nestjs/common';
import { AssetType, FindingSeverity, ScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

// Same point scale the risk engine and its findings already use — kept in
// sync deliberately rather than re-derived, since "top risks" is just a
// sort over the exact same real findings the score is computed from.
const SEVERITY_RANK: Record<FindingSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

// A cert inside this window is worth surfacing on the dashboard; anything
// further out isn't actionable yet and would just be noise.
const CERT_EXPIRY_WINDOW_DAYS = 60;
const TOP_RISKS_LIMIT = 5;
const CERT_EXPIRY_LIMIT = 5;
const RECENT_CHANGES_LIMIT = 8;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * One real, org-scoped snapshot for the dashboard's overview widgets —
   * assembled from tables that already exist and are already populated by
   * real scans (Domain/Asset/Finding/Scan/Alert), not a new data model.
   * Deliberately one endpoint instead of five so the dashboard issues one
   * request instead of a fan-out per widget.
   */
  async getSummary(userId: string, organizationId: string) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const domains = await this.prisma.domain.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const domainIds = domains.map((d) => d.id);

    const [
      totalAssets,
      activeAlertsCount,
      resolvedAlertsCount,
      latestScan,
      certificateAssets,
      recentAlerts,
    ] = await Promise.all([
      this.prisma.asset.count({
        where: { domainId: { in: domainIds }, active: true },
      }),
      this.prisma.alert.count({
        where: { organizationId, read: false },
      }),
      this.prisma.alert.count({
        where: { organizationId, read: true },
      }),
      this.prisma.scan.findFirst({
        where: { organizationId, status: ScanStatus.COMPLETED },
        orderBy: { finishedAt: 'desc' },
        include: { domain: { select: { name: true } } },
      }),
      this.prisma.asset.findMany({
        where: {
          domainId: { in: domainIds },
          type: AssetType.CERTIFICATE,
          active: true,
        },
        select: { id: true, value: true, metadata: true, domainId: true },
      }),
      this.prisma.alert.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_CHANGES_LIMIT,
        select: {
          id: true,
          type: true,
          severity: true,
          message: true,
          createdAt: true,
        },
      }),
    ]);

    // Top risks: the open findings from each domain's own latest completed
    // scan (not a global "latest N findings ever," which would just show
    // whichever domain happens to have scanned most recently, over and
    // over) — one real snapshot per domain, merged and ranked by severity.
    const latestScanPerDomain = await Promise.all(
      domainIds.map((domainId) =>
        this.prisma.scan.findFirst({
          where: { domainId, status: ScanStatus.COMPLETED },
          orderBy: { finishedAt: 'desc' },
          include: {
            findings: true,
            domain: { select: { name: true } },
          },
        }),
      ),
    );

    const topRisks = latestScanPerDomain
      .filter((scan): scan is NonNullable<typeof scan> => scan !== null)
      .flatMap((scan) =>
        scan.findings.map((f) => ({
          id: f.id,
          domainName: scan.domain?.name ?? '',
          severity: f.severity,
          title: f.title,
          description: f.description,
          createdAt: f.createdAt,
          aiExplanation: f.aiExplanation,
          aiBusinessImpact: f.aiBusinessImpact,
          aiRemediation: f.aiRemediation,
          aiDifficulty: f.aiDifficulty,
          aiPriority: f.aiPriority,
        })),
      )
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
      .slice(0, TOP_RISKS_LIMIT);

    const domainNameById = new Map(domains.map((d) => [d.id, d.name]));
    const upcomingCertExpirations = certificateAssets
      .map((asset) => {
        const meta = asset.metadata as Record<string, unknown> | null;
        const daysUntilExpiry = meta?.daysUntilExpiry as number | undefined;
        return {
          id: asset.id,
          domainName: domainNameById.get(asset.domainId) ?? '',
          value: asset.value,
          daysUntilExpiry: daysUntilExpiry ?? null,
        };
      })
      .filter(
        (c) =>
          c.daysUntilExpiry !== null &&
          c.daysUntilExpiry <= CERT_EXPIRY_WINDOW_DAYS,
      )
      .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0))
      .slice(0, CERT_EXPIRY_LIMIT);

    return {
      totalDomains: domains.length,
      totalAssets,
      activeAlertsCount,
      resolvedAlertsCount,
      latestScan: latestScan
        ? {
            scanId: latestScan.id,
            domainName: latestScan.domain?.name ?? '',
            finishedAt: latestScan.finishedAt,
          }
        : null,
      topRisks,
      upcomingCertExpirations,
      recentChanges: recentAlerts,
    };
  }
}
