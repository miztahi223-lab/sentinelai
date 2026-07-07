import { Injectable } from '@nestjs/common';

export interface TechnologyMatch {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

interface HeaderSignature {
  name: string;
  category: string;
  header: string;
  pattern: RegExp;
}

interface BodySignature {
  name: string;
  category: string;
  pattern: RegExp;
}

// A deliberately small, real signature set (not an exhaustive Wappalyzer-style
// database) covering common, easily-verifiable cases. Each signature is a
// genuine, testable pattern — nothing here is a placeholder.
const HEADER_SIGNATURES: HeaderSignature[] = [
  {
    name: 'Nginx',
    category: 'Web Server',
    header: 'server',
    pattern: /nginx/i,
  },
  {
    name: 'Apache',
    category: 'Web Server',
    header: 'server',
    pattern: /apache/i,
  },
  {
    name: 'Microsoft IIS',
    category: 'Web Server',
    header: 'server',
    pattern: /microsoft-iis/i,
  },
  {
    name: 'Cloudflare',
    category: 'CDN / WAF',
    header: 'server',
    pattern: /cloudflare/i,
  },
  { name: 'Vercel', category: 'Hosting', header: 'server', pattern: /vercel/i },
  {
    name: 'PHP',
    category: 'Language',
    header: 'x-powered-by',
    pattern: /php/i,
  },
  {
    name: 'Express',
    category: 'Web Framework',
    header: 'x-powered-by',
    pattern: /express/i,
  },
  {
    name: 'ASP.NET',
    category: 'Web Framework',
    header: 'x-powered-by',
    pattern: /asp\.net/i,
  },
  {
    name: 'ASP.NET',
    category: 'Web Framework',
    header: 'x-aspnet-version',
    pattern: /.+/,
  },
  {
    name: 'Next.js',
    category: 'Web Framework',
    header: 'x-powered-by',
    pattern: /next\.js/i,
  },
  { name: 'Varnish', category: 'Cache', header: 'x-varnish', pattern: /.+/ },
];

const BODY_SIGNATURES: BodySignature[] = [
  { name: 'WordPress', category: 'CMS', pattern: /wp-content|wp-includes/i },
  {
    name: 'Drupal',
    category: 'CMS',
    pattern: /sites\/(all|default)\/(themes|modules)|drupal\.js/i,
  },
  {
    name: 'Joomla',
    category: 'CMS',
    pattern: /\/media\/(system|jui)\/|joomla/i,
  },
  {
    name: 'React',
    category: 'JS Framework',
    pattern: /data-reactroot|__next|react-dom/i,
  },
  {
    name: 'Vue.js',
    category: 'JS Framework',
    pattern: /data-v-app|__vue__|vue\.js/i,
  },
  {
    name: 'Angular',
    category: 'JS Framework',
    pattern: /ng-version|angular\.js/i,
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    pattern: /bootstrap(\.min)?\.css/i,
  },
  { name: 'Tailwind CSS', category: 'CSS Framework', pattern: /tailwind/i },
  {
    name: 'Google Analytics',
    category: 'Analytics',
    pattern: /google-analytics\.com|gtag\(/i,
  },
  { name: 'jQuery', category: 'JS Library', pattern: /jquery(\.min)?\.js/i },
];

// Security-relevant headers the risk engine (Step 10) will care about;
// detected here so the raw signal is captured once at scan time rather than
// re-parsed later from a stored HTML blob.
const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

@Injectable()
export class TechnologyService {
  detect(headers: Record<string, string>, body?: string): TechnologyMatch[] {
    const matches: TechnologyMatch[] = [];
    const lowerHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );

    for (const sig of HEADER_SIGNATURES) {
      const value = lowerHeaders[sig.header];
      if (value && sig.pattern.test(value)) {
        matches.push({
          name: sig.name,
          category: sig.category,
          confidence: 'high',
          evidence: `${sig.header}: ${value}`,
        });
      }
    }

    if (body) {
      for (const sig of BODY_SIGNATURES) {
        if (sig.pattern.test(body)) {
          matches.push({
            name: sig.name,
            category: sig.category,
            confidence: 'medium',
            evidence: `matched pattern ${sig.pattern} in response body`,
          });
        }
      }
    }

    // De-duplicate by name (e.g. ASP.NET could match twice above).
    const seen = new Set<string>();
    return matches.filter((m) => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  }

  missingSecurityHeaders(headers: Record<string, string>): string[] {
    const lowerHeaders = new Set(
      Object.keys(headers).map((h) => h.toLowerCase()),
    );
    return SECURITY_HEADERS.filter((h) => !lowerHeaders.has(h));
  }
}
