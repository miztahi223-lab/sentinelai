import { lookup as dnsLookup, LookupAddress } from 'dns';
import { isIP } from 'net';
import { promisify } from 'util';
import ipaddr from 'ipaddr.js';

const dnsLookupAsync = promisify(dnsLookup);

/**
 * This module exists because DomeCortex AI's entire purpose is "the user
 * tells us a hostname, we make outbound HTTP/TLS connections to it" — which
 * is exactly the shape of a Server-Side Request Forgery vector if left
 * unguarded. A user could register a domain (one they legitimately control
 * the DNS for, e.g. `internal.attacker.example`) that resolves to
 * `169.254.169.254` (the AWS/GCP/Azure cloud-metadata endpoint — a classic
 * SSRF-to-credential-theft target), `127.0.0.1`, or an internal
 * `10.x`/`172.16-31.x`/`192.168.x` address, and have this backend's own
 * discovery scanner connect to it on its behalf.
 *
 * `ipRangeIsBlocked` classifies an already-resolved IP; `assertSafeToConnect`
 * does the DNS lookup and validation together and is deliberately shaped to
 * double as a `lookup`-option-compatible function for both `axios`
 * (`http.service.ts`) and `tls.connect` (`ssl.service.ts`) — Node validates
 * and connects to the *exact same* resolved address this function returns,
 * so there is no gap between "the address we checked" and "the address we
 * connect to" (a naive "resolve once to check, let the HTTP client resolve
 * again to connect" implementation would be vulnerable to DNS rebinding:
 * an attacker's DNS server could return a public IP for the validation
 * lookup and a private one moments later for the real connection).
 */

const BLOCKED_RANGES = [
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'private',
  'reserved',
  'carrierGradeNat',
  'uniqueLocal',
  'deprecatedSiteLocal',
] as const;

export class SsrfBlockedError extends Error {
  constructor(hostname: string, address: string) {
    super(
      `Refusing to connect to ${hostname} (resolves to ${address}, a private/reserved address) — scanning internal infrastructure is not permitted.`,
    );
    this.name = 'SsrfBlockedError';
  }
}

export function isBlockedAddress(address: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.process(address);
  } catch {
    // Not a parseable IP at all — treat as blocked rather than risk letting
    // something unrecognized through.
    return true;
  }

  // `ipaddr.process()` already unwraps some IPv4-mapped IPv6 forms, but not
  // reliably for every input shape — checking explicitly here closes what
  // would otherwise be a real bypass: `::ffff:169.254.169.254` (or the
  // equivalent hex form) is a completely valid way to write an IPv4 address
  // as IPv6, and a naive range check on the *outer* IPv6 address alone
  // would classify it as the harmless-sounding "ipv4Mapped" range instead
  // of correctly seeing the embedded address is link-local/private.
  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return isBlockedAddress(v6.toIPv4Address().toString());
    }
  }

  const range =
    addr.kind() === 'ipv6'
      ? (addr as ipaddr.IPv6).range()
      : (addr as ipaddr.IPv4).range();

  return (BLOCKED_RANGES as readonly string[]).includes(range);
}

/**
 * Resolves `hostname` and throws `SsrfBlockedError` if it resolves to a
 * private/reserved address. Returns the resolved address + family so the
 * caller can connect to that literal address (never re-resolving).
 */
export async function resolveAndAssertSafe(
  hostname: string,
): Promise<{ address: string; family: number }> {
  let result: LookupAddress;
  try {
    result = await dnsLookupAsync(hostname);
  } catch (error) {
    throw new Error(
      `DNS resolution failed for ${hostname}: ${(error as Error).message}`,
    );
  }

  if (isBlockedAddress(result.address)) {
    throw new SsrfBlockedError(hostname, result.address);
  }

  return result;
}

/**
 * A real gap the `lookup`-option guard alone cannot close: Node's own
 * `net`/`http`/`tls` modules only invoke a custom `lookup` callback when the
 * target host actually needs DNS resolution. When the host is *already* a
 * literal IP address (e.g. a webhook URL of `https://169.254.169.254/` —
 * this app's domain-name validation happens to accept all-numeric labels
 * too, so `127.0.0.1` is a valid "domain name" as far as that regex is
 * concerned), Node skips the `lookup` step entirely and connects directly,
 * meaning `safeLookup` below silently never runs at all. Every real caller
 * (`http.service.ts`, `ssl.service.ts`, `webhook.service.ts`) must call this
 * synchronous, pre-connection check first — it's the only thing that
 * actually covers the literal-IP case.
 */
export function assertHostnameNotLiteralBlockedIp(hostname: string): void {
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    throw new SsrfBlockedError(hostname, hostname);
  }
}

/**
 * A `dns.lookup`-signature-compatible function (works directly as axios's
 * `lookup` config option and as `tls.connect`'s/`net.connect`'s `lookup`
 * option) that resolves + validates in one step. Node then connects to
 * exactly the address this callback supplies. Only ever invoked by Node for
 * *hostnames* that need resolution — see `assertHostnameNotLiteralBlockedIp`
 * above for the literal-IP case this can never cover.
 */
export function safeLookup(
  hostname: string,
  options: unknown,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: 4 | 6 | undefined,
  ) => void,
): void {
  resolveAndAssertSafe(hostname).then(
    ({ address, family }) => callback(null, address, family === 6 ? 6 : 4),
    (error: Error) => callback(error as NodeJS.ErrnoException, '', undefined),
  );
}
