import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { TokenService } from './token.service';

/**
 * In-memory fake standing in for the `refreshToken` table — real behavior
 * (unique-by-hash lookup, revocation, expiry), just not backed by Postgres,
 * so these tests exercise TokenService's actual rotation/security logic
 * (the part that matters) without needing a live database.
 */
function createFakePrisma() {
  const rows = new Map<string, any>();
  let nextId = 1;
  return {
    refreshToken: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const row = {
          id: `rt-${nextId++}`,
          revoked: false,
          replacedBy: null,
          ...data,
        };
        rows.set(row.tokenHash, row);
        return Promise.resolve(row);
      }),
      findUnique: jest
        .fn()
        .mockImplementation(({ where: { tokenHash } }: any) => {
          return Promise.resolve(rows.get(tokenHash) ?? null);
        }),
      update: jest.fn().mockImplementation(({ where: { id }, data }: any) => {
        for (const row of rows.values()) {
          if (row.id === id) Object.assign(row, data);
        }
        return Promise.resolve();
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
        let count = 0;
        for (const row of rows.values()) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.tokenHash && row.tokenHash !== where.tokenHash) continue;
          if (where.revoked === false && row.revoked !== false) continue;
          Object.assign(row, data);
          count++;
        }
        return Promise.resolve({ count });
      }),
    },
    // Real Prisma's $transaction accepts an array of promises created
    // eagerly (each `this.prisma.x.y(...)` call already started executing
    // by the time it's passed in) — mimic that rather than a callback form.
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    __rows: rows,
  };
}

function createConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('TokenService', () => {
  describe('access tokens', () => {
    it('signs and verifies a round-trip access token', () => {
      const jwtService = new JwtService();
      const config = createConfig();
      const service = new TokenService(jwtService, config, {} as any);

      const token = service.signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
      });
      const decoded = service.verifyAccessToken(token);

      expect(decoded.sub).toBe('user-1');
      expect(decoded.email).toBe('a@b.com');
    });

    it('rejects a token signed with a different secret', () => {
      const jwtService = new JwtService();
      const service = new TokenService(jwtService, createConfig(), {} as any);
      const token = service.signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
      });

      const otherService = new TokenService(
        jwtService,
        createConfig({ JWT_ACCESS_SECRET: 'a-different-secret' }),
        {} as any,
      );

      expect(() => otherService.verifyAccessToken(token)).toThrow();
    });
  });

  describe('refresh token rotation', () => {
    it('issues a refresh token whose hash (not the raw token) is what gets stored', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const token = await service.issueRefreshToken('user-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(32);
      const expectedHash = createHash('sha256').update(token).digest('hex');
      expect(fakePrisma.__rows.has(expectedHash)).toBe(true);
      // The raw token itself must never appear as a stored key.
      expect(fakePrisma.__rows.has(token)).toBe(false);
    });

    it('rotates a valid refresh token: old one is revoked, a new one is issued', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const original = await service.issueRefreshToken('user-1');
      const rotated = await service.rotateRefreshToken(original);

      expect(rotated).not.toBeNull();
      expect(rotated?.userId).toBe('user-1');
      expect(rotated?.newToken).not.toBe(original);

      const originalHash = createHash('sha256').update(original).digest('hex');
      expect(fakePrisma.__rows.get(originalHash)?.revoked).toBe(true);
    });

    it('rejects reusing an already-rotated (revoked) refresh token — this is the theft-detection property', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const original = await service.issueRefreshToken('user-1');
      await service.rotateRefreshToken(original); // first, legitimate use — rotates it

      const secondAttempt = await service.rotateRefreshToken(original); // reuse — must fail

      expect(secondAttempt).toBeNull();
    });

    it('rejects an unknown/never-issued refresh token', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const result = await service.rotateRefreshToken(
        'this-token-was-never-issued',
      );

      expect(result).toBeNull();
    });

    it('rejects an expired refresh token even if otherwise valid and unused', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const token = await service.issueRefreshToken('user-1');
      // Simulate time having passed by directly backdating the stored row's
      // expiry, rather than the more fragile approach of mocking the system
      // clock across an async multi-await test.
      const hash = createHash('sha256').update(token).digest('hex');
      fakePrisma.__rows.get(hash).expiresAt = new Date(Date.now() - 1000);

      const result = await service.rotateRefreshToken(token);

      expect(result).toBeNull();
    });

    it('revokeAllForUser invalidates every active refresh token for that user but not other users', async () => {
      const fakePrisma = createFakePrisma();
      const service = new TokenService(
        new JwtService(),
        createConfig(),
        fakePrisma as any,
      );

      const userToken1 = await service.issueRefreshToken('user-1');
      const userToken2 = await service.issueRefreshToken('user-1');
      const otherUserToken = await service.issueRefreshToken('user-2');

      await service.revokeAllForUser('user-1');

      expect(await service.rotateRefreshToken(userToken1)).toBeNull();
      expect(await service.rotateRefreshToken(userToken2)).toBeNull();
      // user-2's token must be unaffected by user-1's revocation.
      expect(await service.rotateRefreshToken(otherUserToken)).not.toBeNull();
    });
  });
});
