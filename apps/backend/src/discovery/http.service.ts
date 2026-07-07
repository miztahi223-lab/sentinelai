import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { safeLookup } from './ssrf-guard';

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

const TIMEOUT_MS = 10_000;
const MAX_BODY_SNIPPET = 4096;

/**
 * Probes a hostname over HTTPS first, falling back to HTTP — this mirrors
 * how a real attacker/browser would approach an unknown host, and lets the
 * risk engine later flag "HTTPS unavailable, HTTP-only" as its own finding.
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  async probe(hostname: string): Promise<HttpProbeResult> {
    const httpsResult = await this.tryScheme(hostname, 'https');
    if (httpsResult.reachable) return httpsResult;

    const httpResult = await this.tryScheme(hostname, 'http');
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
      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
        // axios doesn't expose the redirect chain directly on the browser
        // adapter; the Node adapter follows redirects internally, so we
        // record the requested URL up front and the final one from the
        // response — good enough for "did it redirect" without needing a
        // custom transport.
        headers: { 'User-Agent': 'SentinelAI-DiscoveryBot/1.0' },
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
