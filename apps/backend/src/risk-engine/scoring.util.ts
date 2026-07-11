import { Finding, FindingCategory, FindingSeverity } from '@prisma/client';

const SEVERITY_POINTS: Record<FindingSeverity, number> = {
  CRITICAL: 30,
  HIGH: 18,
  MEDIUM: 10,
  LOW: 4,
  INFO: 0,
};

export interface ScoredDeduction {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  points: number;
}

export interface SslSignal {
  inspected: boolean;
  valid?: boolean;
  selfSigned?: boolean;
  daysUntilExpiry?: number;
  reason?: string;
}

export interface HeaderSignal {
  reachable: boolean;
  missingSecurityHeaders?: string[];
  headers?: Record<string, string>;
}

export interface DnsSignal {
  hasSpf: boolean;
  hasDmarc: boolean;
}

/**
 * Pure, DB-independent scoring logic shared by `RiskEngineService` (which
 * derives these signals from persisted `Asset` rows) and the public,
 * unauthenticated free-scan endpoint (`PublicScanService`, which derives the
 * exact same shape of signal directly from a live probe with nothing
 * persisted) — one real scoring formula, not two independently-maintained
 * approximations that could quietly drift apart (see the module-level
 * comment on `scoreFromFindings` for why that already happened once).
 */
export function evaluateSslSignal(ssl: SslSignal): ScoredDeduction[] {
  const deductions: ScoredDeduction[] = [];

  if (!ssl.inspected) {
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

  if (ssl.valid === false) {
    deductions.push({
      category: FindingCategory.SSL,
      severity: FindingSeverity.CRITICAL,
      title: 'Invalid TLS certificate',
      description: `The presented TLS certificate failed validation${ssl.reason ? `: ${ssl.reason}` : ''}.`,
      points: SEVERITY_POINTS.CRITICAL,
    });
  }

  if (ssl.selfSigned) {
    deductions.push({
      category: FindingCategory.SSL,
      severity: FindingSeverity.HIGH,
      title: 'Self-signed TLS certificate',
      description:
        'The TLS certificate is self-signed rather than issued by a trusted CA — browsers/clients will not trust this connection by default.',
      points: SEVERITY_POINTS.HIGH,
    });
  }

  if (typeof ssl.daysUntilExpiry === 'number') {
    if (ssl.daysUntilExpiry <= 0) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.CRITICAL,
        title: 'TLS certificate has expired',
        description: 'The TLS certificate has already expired.',
        points: SEVERITY_POINTS.CRITICAL,
      });
    } else if (ssl.daysUntilExpiry <= 7) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.HIGH,
        title: 'TLS certificate expires within 7 days',
        description: `TLS certificate expires in ${ssl.daysUntilExpiry} day(s) — renew it before it lapses.`,
        points: SEVERITY_POINTS.HIGH,
      });
    } else if (ssl.daysUntilExpiry <= 30) {
      deductions.push({
        category: FindingCategory.SSL,
        severity: FindingSeverity.MEDIUM,
        title: 'TLS certificate expires within 30 days',
        description: `TLS certificate expires in ${ssl.daysUntilExpiry} day(s) — schedule a renewal.`,
        points: SEVERITY_POINTS.MEDIUM,
      });
    }
  }

  return deductions;
}

export function evaluateHeaderSignal(http: HeaderSignal): ScoredDeduction[] {
  if (!http.reachable) return [];

  const missingHeaders = http.missingSecurityHeaders ?? [];
  const headers = http.headers ?? {};
  const deductions: ScoredDeduction[] = [];

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
    });
  }

  const versionLeakHeaders = ['x-powered-by', 'x-aspnet-version'];
  const leaked = versionLeakHeaders.filter((h) => headers[h]);
  if (leaked.length > 0) {
    deductions.push({
      category: FindingCategory.CONFIGURATION,
      severity: FindingSeverity.LOW,
      title: 'Server technology version disclosed in response headers',
      description: `Response headers reveal specific server technology (${leaked.map((h) => `${h}: ${headers[h]}`).join(', ')}), making it easier to target known vulnerabilities for that exact version.`,
      points: SEVERITY_POINTS.LOW,
    });
  }

  return deductions;
}

export function evaluateDnsSignal(dns: DnsSignal): ScoredDeduction[] {
  const deductions: ScoredDeduction[] = [];

  if (!dns.hasSpf) {
    deductions.push({
      category: FindingCategory.DNS,
      severity: FindingSeverity.MEDIUM,
      title: 'No SPF record found',
      description:
        'No SPF (Sender Policy Framework) TXT record was found for this domain — without one, it is easier for attackers to send email that appears to come from this domain.',
      points: SEVERITY_POINTS.MEDIUM,
    });
  }

  if (!dns.hasDmarc) {
    deductions.push({
      category: FindingCategory.DNS,
      severity: FindingSeverity.MEDIUM,
      title: 'No DMARC record found',
      description:
        'No DMARC TXT record was found at _dmarc for this domain — without one, mail providers have no policy to follow when they receive spoofed email claiming to be from this domain.',
      points: SEVERITY_POINTS.MEDIUM,
    });
  }

  return deductions;
}

export function scoreFromDeductions(
  deductions: Pick<ScoredDeduction, 'points'>[],
): number {
  const totalDeduction = deductions.reduce((sum, d) => sum + d.points, 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'STRONG';

/** Shared by `RiskEngineService` and `PublicScanService` — same score, same bands. */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 90) return 'STRONG';
  if (score >= 70) return 'LOW';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Single source of truth for "score from persisted findings" — every place
 * in the product that shows a security score (the dashboard, the AI
 * executive summary, PDF reports) must call this, not re-derive its own
 * approximation. Previously duplicated (and each time slightly different:
 * a flat per-severity table that ignored each finding's own real, capped/
 * weighted `points`) in `risk-engine.controller.ts`, `ai.controller.ts`,
 * and `report.processor.ts` — three independent copies that could each
 * show a different score for the exact same scan.
 */
export function scoreFromFindings(findings: Pick<Finding, 'points'>[]): number {
  const totalDeduction = findings.reduce((sum, f) => sum + f.points, 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

export const EMPTY_CATEGORY_BREAKDOWN: Record<
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

/** The real "why" behind the score — grouping the same persisted findings the score is summed from. */
export function categoryBreakdown(
  findings: Pick<Finding, 'category' | 'points'>[],
): typeof EMPTY_CATEGORY_BREAKDOWN {
  const breakdown = structuredClone(EMPTY_CATEGORY_BREAKDOWN);
  for (const f of findings) {
    breakdown[f.category].deduction += f.points;
    breakdown[f.category].findings += 1;
  }
  return breakdown;
}
