import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { assertHostnameNotLiteralBlockedIp, safeLookup } from './ssrf-guard';

export interface HttpProbeResult {
  reachable: boolean;
  scheme?: 'http' | 'https';
  statusCode?: number;
  headers?: Record<string, string>;
  redirectChain?: string[];
  finalUrl?: string;
  bodySnippet?: string;
  responseTimeMs?: number;
  error?: string;
}

// Was 10s, tried sequentially (HTTPS, then HTTP only after HTTPS fully
// failed) — a real, measured problem for any subdomain that doesn't run a
// web server at all, not just a hypothetical slow case: `autodiscover.`
// (the CNAME every real Microsoft 365 mailbox setup creates — see
// `docs/DEPLOY.md`) resolves to real Microsoft IPs that never answer a
// plain HTTP GET, so the old code spent the full 10s timeout on HTTPS and
// then another full 10s on the HTTP fallback — 20+ of every scan's ~21
// seconds was one non-web subdomain, confirmed by timing an actual
// production scan of this app's own domain end-to-end (discovery phase:
// 20900ms) down to this exact call. Both schemes now race concurrently
// instead of running one after the other, and the per-scheme timeout is
// tighter — halving the old worst case twice over (20s -> ~6s).
const TIMEOUT_MS = 6_000;
const MAX_BODY_SNIPPET = 4096;

/**
 * Probes a hostname over HTTPS and HTTP concurrently (not sequentially —
 * see the `TIMEOUT_MS` comment above) and prefers the HTTPS result when
 * both succeed. This mirrors how a real attacker/browser would approach an
 * unknown host, and lets the risk engine later flag "HTTPS unavailable,
 * HTTP-only" as its own finding.
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  async probe(hostname: string): Promise<HttpProbeResult> {
    const [httpsResult, httpResult] = await Promise.all([
      this.tryScheme(hostname, 'https'),
      this.tryScheme(hostname, 'http'),
    ]);
    if (httpsResult.reachable) return httpsResult;
    return httpResult.reachable ? httpResult : httpsResult;
  }

  private async tryScheme(
    hostname: string,
    scheme: 'http' | 'https',
  ): Promise<HttpProbeResult> {
    const url = `${scheme}://${hostname}/`;
    const redirectChain: string[] = [];
    const start = Date.now();

    try {
      // `lookup: safeLookup` below is never actually invoked by Node when
      // `hostname` is already a literal IP address (Node skips DNS
      // resolution entirely and connects directly) — this synchronous
      // check is what actually covers that case (see
      // `assertHostnameNotLiteralBlockedIp`'s own comment for why).
      assertHostnameNotLiteralBlockedIp(hostname);

      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
        // axios doesn't expose the redirect chain directly on the browser
        // adapter; the Node adapter follows redirects internally, so we
        // record the requested URL up front and the final one from the
        // response — good enough for "did it redirect" without needing a
        // custom transport.
        headers: { 'User-Agent': 'DomeCortexAI-DiscoveryBot/1.0' },
        // SSRF guard (see ssrf-guard.ts): resolves + validates the address
        // ourselves and hands the *exact* validated address back to
        // Node's own connection logic, rather than letting axios/Node
        // re-resolve the hostname independently (which would reopen a DNS
        // rebinding gap between "the address we checked" and "the address
        // we connect to"). Applies to every hop of a redirect chain too,
        // since Node's http agent calls `lookup` again for each new host.
        lookup: safeLookup,
      });

      redirectChain.push(url);
      // Node's http ClientRequest exposes the post-redirect URL as
      // `res.responseUrl`, but that's not part of axios's public/typed
      // response shape — narrow it explicitly rather than reaching into
      // `request` with an untyped/`any` chain.
      const nodeRequest = response.request as
        { res?: { responseUrl?: string } } | undefined;
      const finalUrl: string = nodeRequest?.res?.responseUrl ?? url;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }

      return {
        reachable: true,
        scheme,
        statusCode: response.status,
        headers,
        redirectChain,
        finalUrl,
        bodySnippet:
          typeof response.data === 'string'
            ? response.data.slice(0, MAX_BODY_SNIPPET)
            : undefined,
        responseTimeMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.debug(
        `HTTP probe (${scheme}) failed for ${hostname}: ${(error as Error).message}`,
      );
      return {
        reachable: false,
        scheme,
        error: (error as Error).message,
        responseTimeMs: Date.now() - start,
      };
    }
  }
}
