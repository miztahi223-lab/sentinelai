import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';

export interface DnsLookupResult {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: { exchange: string; priority: number }[];
  txt: string[][];
  ns: string[];
  resolvedAt: Date;
}

/**
 * Thin wrapper over Node's built-in `dns.promises` resolver. Each record
 * type is resolved independently and failures (e.g. no MX record) are
 * swallowed to an empty array rather than failing the whole lookup — a
 * domain missing one record type is normal, not an error condition.
 */
@Injectable()
export class DnsService {
  private readonly logger = new Logger(DnsService.name);

  async lookup(hostname: string): Promise<DnsLookupResult> {
    const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
      this.safeResolve(() => dns.resolve4(hostname)),
      this.safeResolve(() => dns.resolve6(hostname)),
      this.safeResolve(() => dns.resolveCname(hostname)),
      this.safeResolve(() => dns.resolveMx(hostname)),
      this.safeResolve(() => dns.resolveTxt(hostname)),
      this.safeResolve(() => dns.resolveNs(hostname)),
    ]);

    return {
      a,
      aaaa,
      cname,
      mx,
      txt,
      ns,
      resolvedAt: new Date(),
    };
  }

  private async safeResolve<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // ENODATA/ENOTFOUND are expected (record type just doesn't exist for
      // this domain) — only log anything unexpected, and always degrade to
      // an empty result rather than throwing.
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code && !['ENODATA', 'ENOTFOUND'].includes(code)) {
        this.logger.debug(`DNS lookup error (${code}) for a record type`);
      }
      return [] as unknown as T;
    }
  }
}
