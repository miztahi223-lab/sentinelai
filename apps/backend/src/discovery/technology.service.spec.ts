import { TechnologyService } from './technology.service';

describe('TechnologyService', () => {
  let service: TechnologyService;

  beforeEach(() => {
    service = new TechnologyService();
  });

  describe('detect', () => {
    it('detects a technology from a response header', () => {
      const matches = service.detect({ server: 'nginx/1.22.0' });
      expect(matches).toContainEqual(
        expect.objectContaining({ name: 'Nginx', confidence: 'high' }),
      );
    });

    it('detects Cloudflare from the server header (real-world case from Step 7 testing)', () => {
      const matches = service.detect({ server: 'cloudflare' });
      expect(matches.map((m) => m.name)).toContain('Cloudflare');
    });

    it('detects a CMS from body content', () => {
      const matches = service.detect(
        {},
        '<html><head><link href="/wp-content/themes/x/style.css"></head></html>',
      );
      expect(matches.map((m) => m.name)).toContain('WordPress');
    });

    it('is case-insensitive on header names', () => {
      const matches = service.detect({ 'X-Powered-By': 'PHP/8.1.18' });
      expect(matches.map((m) => m.name)).toContain('PHP');
    });

    it('de-duplicates matches with the same technology name', () => {
      // ASP.NET has two signatures (x-powered-by and x-aspnet-version) —
      // triggering both should still only report ASP.NET once.
      const matches = service.detect({
        'x-powered-by': 'ASP.NET',
        'x-aspnet-version': '4.0.30319',
      });
      const aspnetMatches = matches.filter((m) => m.name === 'ASP.NET');
      expect(aspnetMatches).toHaveLength(1);
    });

    it('returns no matches for a response with no recognizable signatures', () => {
      const matches = service.detect(
        { 'content-type': 'text/plain' },
        'hello world',
      );
      expect(matches).toHaveLength(0);
    });
  });

  describe('missingSecurityHeaders', () => {
    it('flags all standard security headers as missing when none are present', () => {
      const missing = service.missingSecurityHeaders({});
      expect(missing).toEqual(
        expect.arrayContaining([
          'strict-transport-security',
          'content-security-policy',
          'x-frame-options',
          'x-content-type-options',
          'referrer-policy',
          'permissions-policy',
        ]),
      );
      expect(missing).toHaveLength(6);
    });

    it('does not flag headers that are present (case-insensitively)', () => {
      const missing = service.missingSecurityHeaders({
        'Strict-Transport-Security': 'max-age=31536000',
        'x-frame-options': 'SAMEORIGIN',
      });
      expect(missing).not.toContain('strict-transport-security');
      expect(missing).not.toContain('x-frame-options');
      expect(missing).toHaveLength(4);
    });

    it('returns an empty array when every security header is present', () => {
      const missing = service.missingSecurityHeaders({
        'strict-transport-security': 'x',
        'content-security-policy': 'x',
        'x-frame-options': 'x',
        'x-content-type-options': 'x',
        'referrer-policy': 'x',
        'permissions-policy': 'x',
      });
      expect(missing).toHaveLength(0);
    });
  });
});
