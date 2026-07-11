import { Injectable, Logger } from '@nestjs/common';
import { FindingSeverity } from '@prisma/client';
import { DnsService } from '../discovery/dns.service';
import { SslService } from '../discovery/ssl.service';
import { HttpService } from '../discovery/http.service';
import { TechnologyService } from '../discovery/technology.service';
import {
  evaluateDnsSignal,
  evaluateHeaderSignal,
  evaluateSslSignal,
  scoreFromDeductions,
  scoreToRiskLevel,
  RiskLevel,
  ScoredDeduction,
} from '../risk-engine/scoring.util';

export interface PublicScanResult {
  domain: string;
  reachable: boolean;
  score: number;
  riskLevel: RiskLevel;
  topFinding: {
    severity: FindingSeverity;
    title: string;
    description: string;
  } | null;
  additionalFindingsCount: number;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

/**
 * The public, unauthenticated "free instant scan" behind the landing page's
 * lead-gen widget. Deliberately a *lighter* real check than the full
 * authenticated pipeline (`DiscoveryService.runForDomain` + `ScansService`) —
 * no subdomain enumeration (the actual paid-tier value proposition), and
 * nothing is persisted (no `Domain`/`Scan`/`Asset`/`Finding` rows) since
 * there's no organization to own the data and no reason to keep a database
 * record of every hostname a random visitor ever typed in. Every signal is
 * still a real, live probe through the same SSRF-guarded discovery services
 * (`DnsService`/`SslService`/`HttpService`) the authenticated product uses,
 * and scored with the exact same formula (`scoring.util.ts`) — this teaser
 * can never show a rosier or harsher number than the real scan would.
 */
@Injectable()
export class PublicScanService {
  private readonly logger = new Logger(PublicScanService.name);

  constructor(
    private readonly dnsService: DnsService,
    private readonly sslService: SslService,
    private readonly httpService: HttpService,
    private readonly technologyService: TechnologyService,
  ) {}

  async scan(hostname: string): Promise<PublicScanResult> {
    const [dnsResult, dmarcResult, sslResult, httpResult] = await Promise.all([
      this.dnsService.lookup(hostname),
      this.dnsService.lookup(`_dmarc.${hostname}`),
      this.sslService.inspect(hostname),
      this.httpService.probe(hostname),
    ]);

    const hasSpf = dnsResult.txt.some((chunks) =>
      chunks.join('').toLowerCase().startsWith('v=spf1'),
    );
    const hasDmarc = dmarcResult.txt.some((chunks) =>
      chunks.join('').toLowerCase().startsWith('v=dmarc1'),
    );
    const missingHeaders = httpResult.reachable
      ? this.technologyService.missingSecurityHeaders(httpResult.headers ?? {})
      : [];

    const deductions: ScoredDeduction[] = [
      ...evaluateSslSignal({
        inspected: !!(sslResult.subject || sslResult.fingerprint256),
        valid: sslResult.valid,
        selfSigned: sslResult.selfSigned,
        daysUntilExpiry: sslResult.daysUntilExpiry,
        reason: sslResult.reason,
      }),
      ...evaluateHeaderSignal({
        reachable: httpResult.reachable,
        missingSecurityHeaders: missingHeaders,
        headers: httpResult.headers,
      }),
      ...evaluateDnsSignal({ hasSpf, hasDmarc }),
    ].map((d) => ({ ...d, points: Math.round(d.points) }));

    const score = scoreFromDeductions(deductions);
    const riskLevel = scoreToRiskLevel(score);

    const sorted = [...deductions].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        b.points - a.points,
    );
    const [topFinding, ...rest] = sorted;
    const reachable =
      httpResult.reachable ||
      dnsResult.a.length > 0 ||
      dnsResult.aaaa.length > 0;

    this.logger.log(
      `Public scan for ${hostname}: score ${score}/100, ${deductions.length} finding(s)`,
    );

    return {
      domain: hostname,
      reachable,
      score,
      riskLevel,
      topFinding: topFinding
        ? {
            severity: topFinding.severity,
            title: topFinding.title,
            description: topFinding.description,
          }
        : null,
      additionalFindingsCount: rest.length,
    };
  }
}
