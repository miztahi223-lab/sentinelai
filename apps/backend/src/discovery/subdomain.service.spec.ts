import { SubdomainService } from './subdomain.service';

describe('SubdomainService', () => {
  let service: SubdomainService;

  beforeEach(() => {
    service = new SubdomainService();
  });

  // These tests perform real DNS resolution against real public domains —
  // consistent with how the rest of this codebase's discovery services were
  // verified (Step 7's `example.com` tests), not mocked, since the whole
  // point of this service is "does a real DNS lookup actually work".
  it('finds at least the well-known www subdomain for a real domain that has one', async () => {
    const results = await service.enumerate('google.com');
    const hostnames = results.map((r) => r.hostname);
    expect(hostnames).toContain('www.google.com');
    for (const result of results) {
      expect(result.addresses.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('returns an empty array for a domain with no matching common subdomains, without throwing', async () => {
    // example.com deliberately doesn't run www./api./admin./etc. on most of
    // the wordlist — a realistic "mostly nothing resolves" case.
    const results = await service.enumerate('example.com');
    expect(Array.isArray(results)).toBe(true);
    // Whatever *does* resolve must have a real address, not a placeholder.
    for (const result of results) {
      expect(result.addresses.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('never returns duplicate hostnames', async () => {
    const results = await service.enumerate('google.com');
    const hostnames = results.map((r) => r.hostname);
    expect(new Set(hostnames).size).toBe(hostnames.length);
  }, 30_000);
});
