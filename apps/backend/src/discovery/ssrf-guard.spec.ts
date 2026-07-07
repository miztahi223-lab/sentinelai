import {
  isBlockedAddress,
  resolveAndAssertSafe,
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
});
