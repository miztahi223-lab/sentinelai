import { connect as tlsConnect } from 'tls';
import {
  assertHostnameNotLiteralBlockedIp,
  isBlockedAddress,
  resolveAndAssertSafe,
  safeLookup,
  SsrfBlockedError,
} from './ssrf-guard';

describe('ssrf-guard', () => {
  describe('isBlockedAddress', () => {
    it('blocks loopback addresses (IPv4 and IPv6)', () => {
      expect(isBlockedAddress('127.0.0.1')).toBe(true);
      expect(isBlockedAddress('127.255.255.255')).toBe(true);
      expect(isBlockedAddress('::1')).toBe(true);
    });

    it('blocks the AWS/GCP/Azure cloud-metadata link-local address', () => {
      expect(isBlockedAddress('169.254.169.254')).toBe(true);
    });

    it('blocks RFC1918 private ranges', () => {
      expect(isBlockedAddress('10.0.0.1')).toBe(true);
      expect(isBlockedAddress('172.16.0.1')).toBe(true);
      expect(isBlockedAddress('172.31.255.255')).toBe(true);
      expect(isBlockedAddress('192.168.1.1')).toBe(true);
    });

    it('blocks IPv6 unique-local and link-local addresses', () => {
      expect(isBlockedAddress('fc00::1')).toBe(true);
      expect(isBlockedAddress('fe80::1')).toBe(true);
    });

    it('blocks an IPv4-mapped IPv6 address whose embedded address is private — the DNS-rebinding-shaped bypass this guard exists to close', () => {
      expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
      expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
      expect(isBlockedAddress('::ffff:10.0.0.5')).toBe(true);
    });

    it('does not block ordinary public IP addresses', () => {
      expect(isBlockedAddress('93.184.216.34')).toBe(false); // example.com's long-standing real address
      expect(isBlockedAddress('8.8.8.8')).toBe(false);
      expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false); // Cloudflare public DNS
    });

    it('treats an unparseable value as blocked (fail closed, not open)', () => {
      expect(isBlockedAddress('not-an-ip')).toBe(true);
      expect(isBlockedAddress('')).toBe(true);
    });
  });

  describe('resolveAndAssertSafe', () => {
    it('throws SsrfBlockedError when a hostname resolves to a loopback address', async () => {
      await expect(resolveAndAssertSafe('localhost')).rejects.toThrow(
        SsrfBlockedError,
      );
    });

    it('resolves a real public hostname without throwing', async () => {
      const result = await resolveAndAssertSafe('example.com');
      expect(typeof result.address).toBe('string');
      expect(isBlockedAddress(result.address)).toBe(false);
    });
  });

  describe('safeLookup', () => {
    // Real bug, caught live in production, not hypothetical: Node's
    // net/tls connect logic has requested dual-stack candidates via
    // `dns.lookup(hostname, { all: true }, cb)` by default since
    // `autoSelectFamily` became the Node default (20+) — confirmed this is
    // exactly how `tls.connect()` invokes a custom `lookup` on this app's
    // Node 22 runtime. The single-address `(err, address, family)` callback
    // shape `safeLookup` always used doesn't match, and the failure surfaces
    // confusingly far from the real cause (`Invalid IP address: undefined`
    // deep in Node's connection-establishment code), not as a clean
    // TypeError at the call site — so this drives a real `tls.connect()`
    // exactly like `SslService.inspect()` does, rather than calling
    // `safeLookup` directly with a hand-built `options` object, to make
    // sure the fix actually works against Node's real calling convention
    // and not just an assumption about it.
    it('lets a real tls.connect() succeed against a real public host (reproduces the autoSelectFamily/{all:true} bug)', async () => {
      await new Promise<void>((resolve, reject) => {
        const socket = tlsConnect(
          {
            host: 'cloudflare.com',
            port: 443,
            servername: 'cloudflare.com',
            rejectUnauthorized: false,
            timeout: 8000,
            lookup: safeLookup,
          },
          () => {
            try {
              const cert = socket.getPeerCertificate();
              expect(cert).toBeDefined();
              expect(Object.keys(cert).length).toBeGreaterThan(0);
              socket.destroy();
              resolve();
            } catch (error) {
              socket.destroy();
              reject(error as Error);
            }
          },
        );
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('tls.connect timed out'));
        });
        socket.on('error', (error) => reject(error));
      });
    }, 15000);

    it('still refuses a hostname that resolves to a blocked address when Node requests all candidates', async () => {
      const results: unknown[] = [];
      await new Promise<void>((resolve) => {
        safeLookup(
          'localhost',
          { all: true },
          ((err: NodeJS.ErrnoException | null, addresses: unknown) => {
            results.push(err, addresses);
            resolve();
          }) as never,
        );
      });
      expect(results[0]).toBeInstanceOf(SsrfBlockedError);
      expect(results[1]).toEqual([]);
    });
  });

  describe('assertHostnameNotLiteralBlockedIp', () => {
    // This function exists to close a real gap: Node's `net`/`http`/`tls`
    // modules never invoke a custom `lookup` callback (what `safeLookup`
    // is) when the connection target is already a literal IP address —
    // reproduced directly against Node's real `http` module in
    // `webhook.service.spec.ts` (a literal-loopback webhook URL is refused
    // by this function even though `safeLookup`'s callback never fires for
    // it). The tests here cover this function's own logic in isolation.
    it('throws for a literal IP that resolves to a blocked range', () => {
      expect(() => assertHostnameNotLiteralBlockedIp('127.0.0.1')).toThrow(
        SsrfBlockedError,
      );
      expect(() =>
        assertHostnameNotLiteralBlockedIp('169.254.169.254'),
      ).toThrow(SsrfBlockedError);
      expect(() => assertHostnameNotLiteralBlockedIp('::1')).toThrow(
        SsrfBlockedError,
      );
    });

    it('does not throw for a literal public IP', () => {
      expect(() =>
        assertHostnameNotLiteralBlockedIp('93.184.216.34'),
      ).not.toThrow();
    });

    it('does not throw for an ordinary hostname (defers to the async lookup path)', () => {
      expect(() =>
        assertHostnameNotLiteralBlockedIp('example.com'),
      ).not.toThrow();
    });
  });
});
