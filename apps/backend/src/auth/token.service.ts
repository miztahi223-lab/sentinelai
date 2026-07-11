import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import ms from 'ms';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `@nestjs/jwt`'s `expiresIn` option types `string` inputs against a large
 * template-literal union (`ms`'s `StringValue`) that a value loaded from an
 * env var can never statically satisfy. Converting to a plain number of
 * seconds up front sidesteps that without an unsafe `any` cast.
 */
function toSeconds(value: string): number {
  const millis = ms(value as Parameters<typeof ms>[0]);
  return Math.round(millis / 1000);
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface MfaChallengePayload {
  sub: string;
  purpose: 'mfa_challenge';
}

const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * Handles issuing/verifying short-lived JWT access tokens and long-lived
 * opaque refresh tokens.
 *
 * Refresh tokens are NOT JWTs: they're random opaque strings, only their
 * SHA-256 hash is stored in the DB (so a DB read alone never yields a valid
 * token), and each one is single-use — redeeming one immediately revokes it
 * and issues a replacement (rotation), so a stolen-but-already-used token is
 * detectable and the whole chain can be revoked.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload as unknown as Record<string, unknown>, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: toSeconds(
        this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      ),
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * A deliberately narrow, short-lived token proving "this caller just
   * presented the right password for this user" — issued by `login()` when
   * the account has MFA enabled, in place of real access/refresh tokens.
   * Signed with a *different* secret (`MFA_CHALLENGE_SECRET`, not
   * `JWT_ACCESS_SECRET`) and verified directly here rather than through
   * `JwtStrategy`/`JwtAuthGuard` — the strategy's `validate()` only ever
   * looks at `sub`/`email` and would happily accept any correctly-signed
   * token as a real session, so the one thing that actually prevents this
   * challenge token from being replayed as a full access token is that it
   * is signed with a key `JwtStrategy` never accepts.
   */
  signMfaChallengeToken(userId: string): string {
    const payload: MfaChallengePayload = {
      sub: userId,
      purpose: 'mfa_challenge',
    };
    return this.jwtService.sign(payload as unknown as Record<string, unknown>, {
      secret: this.configService.get<string>('MFA_CHALLENGE_SECRET'),
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    });
  }

  /** Returns the user ID if `token` is a valid, unexpired MFA challenge token — null otherwise (never throws). */
  verifyMfaChallengeToken(token: string): string | null {
    try {
      const payload = this.jwtService.verify<MfaChallengePayload>(token, {
        secret: this.configService.get<string>('MFA_CHALLENGE_SECRET'),
      });
      return payload.purpose === 'mfa_challenge' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTtlMs(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return value * unitMs;
  }

  async issueRefreshToken(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return token;
  }

  /**
   * Validates a presented refresh token and rotates it: the old one is
   * marked revoked (with a pointer to its replacement) and a brand-new
   * token is issued. Returns null if the token is invalid, expired, or
   * already revoked (which — since tokens are single-use — signals
   * possible theft; callers should treat this as a reason to force
   * re-authentication).
   */
  async rotateRefreshToken(
    presentedToken: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ userId: string; newToken: string } | null> {
    const tokenHash = this.hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing || existing.revoked || existing.expiresAt < new Date()) {
      return null;
    }

    const newToken = randomBytes(64).toString('hex');
    const newTokenHash = this.hashToken(newToken);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revoked: true, replacedBy: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newTokenHash,
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    ]);

    return { userId: existing.userId, newToken };
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
