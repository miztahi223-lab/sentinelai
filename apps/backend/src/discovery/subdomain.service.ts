import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';

/**
 * A curated, deliberately bounded wordlist of subdomain prefixes that show
 * up disproportionately often as genuine attack-surface findings in real
 * external recon: forgotten staging/dev environments, exposed admin
 * panels/internal tooling (Jenkins/Grafana/Kibana), legacy infrastructure,
 * and default mail/DNS service names. This is the actual point of an
 * attack-surface-monitoring product — most organizations know about their
 * main site; they don't reliably know about every subdomain they've ever
 * stood up. Kept intentionally modest (not a 100k-line brute-force list)
 * so a scan stays fast and bounded rather than hammering the target's/the
 * public resolver's DNS with thousands of queries per run.
 */
const COMMON_SUBDOMAIN_PREFIXES = [
  'www',
  'mail',
  'webmail',
  'smtp',
  'pop',
  'imap',
  'ftp',
  'sftp',
  'api',
  'staging',
  'stage',
  'dev',
  'develop',
  'test',
  'testing',
  'qa',
  'uat',
  'admin',
  'administrator',
  'portal',
  'panel',
  'cpanel',
  'whm',
  'plesk',
  'app',
  'apps',
  'mobile',
  'beta',
  'demo',
  'sandbox',
  'vpn',
  'remote',
  'ssh',
  'rdp',
  'blog',
  'shop',
  'store',
  'cart',
  'checkout',
  'pay',
  'payments',
  'cdn',
  'static',
  'assets',
  'media',
  'images',
  'files',
  'download',
  'downloads',
  'docs',
  'help',
  'support',
  'status',
  'monitor',
  'monitoring',
  'git',
  'gitlab',
  'jenkins',
  'ci',
  'jira',
  'confluence',
  'grafana',
  'kibana',
  'elastic',
  'prometheus',
  'metrics',
  'ns1',
  'ns2',
  'autodiscover',
  'autoconfig',
  'secure',
  'login',
  'auth',
  'sso',
  'account',
  'accounts',
  'my',
  'dashboard',
  'internal',
  'intranet',
  'corp',
  'crm',
  'erp',
  'db',
  'database',
  'redis',
  'cache',
  'search',
  'old',
  'legacy',
  'backup',
  'archive',
  'v1',
  'v2',
  'graphql',
  'ws',
];

export interface DiscoveredSubdomain {
  hostname: string;
  addresses: string[];
}

const CONCURRENCY = 10;

@Injectable()
export class SubdomainService {
  private readonly logger = new Logger(SubdomainService.name);

  /**
   * Resolves every candidate `<prefix>.<rootDomain>` in parallel (bounded
   * by CONCURRENCY, since firing 100 simultaneous DNS queries at once is
   * both unnecessary and a bit antisocial towards the resolver) and returns
   * only the ones that actually resolve to at least one address — a
   * candidate that doesn't resolve simply doesn't exist, which is the
   * overwhelmingly common case for any given prefix against any given
   * domain, not an error.
   */
  async enumerate(rootDomain: string): Promise<DiscoveredSubdomain[]> {
    const candidates = COMMON_SUBDOMAIN_PREFIXES.map(
      (prefix) => `${prefix}.${rootDomain}`,
    );
    const found: DiscoveredSubdomain[] = [];
    let cursor = 0;

    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= candidates.length) return;
        const hostname = candidates[i];
        const addresses = await this.resolveAddresses(hostname);
        if (addresses.length > 0) {
          found.push({ hostname, addresses });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () =>
        worker(),
      ),
    );

    this.logger.log(
      `Subdomain enumeration for ${rootDomain}: ${found.length}/${candidates.length} candidates resolved`,
    );
    return found;
  }

  private async resolveAddresses(hostname: string): Promise<string[]> {
    const [a, aaaa] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ]);
    return [...a, ...aaaa];
  }
}
