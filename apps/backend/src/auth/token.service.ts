import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

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
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });
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
