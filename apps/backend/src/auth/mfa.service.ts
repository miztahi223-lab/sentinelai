import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { verifyPassword } from '../common/password.util';
import { encryptSecret, decryptSecret } from '../common/crypto.util';
import {
  generateTotpSecret,
  totpAuthUrl,
  verifyTotpCode,
} from '../common/totp.util';

const BACKUP_CODE_COUNT = 10;
const ISSUER = 'SentinelAI';

export class MfaNotSetUpError extends Error {
  constructor() {
    super('MFA setup has not been started for this account.');
    this.name = 'MfaNotSetUpError';
  }
}

export class MfaAlreadyEnabledError extends Error {
  constructor() {
    super(
      'MFA is already enabled for this account — disable it first to re-enroll.',
    );
    this.name = 'MfaAlreadyEnabledError';
  }
}

export class InvalidMfaCodeError extends Error {
  constructor() {
    super('Invalid or expired code.');
    this.name = 'InvalidMfaCodeError';
  }
}

/**
 * TOTP-based two-factor authentication. The shared secret is encrypted at
 * rest (`crypto.util.ts`, AES-256-GCM) rather than hashed like a password,
 * because — unlike a password — it must be decrypted again on every login
 * to compute the expected code.
 *
 * Setup is a real two-step commitment: `beginSetup` stores the (encrypted)
 * secret but leaves `mfaEnabled` false, and only `enable` — which requires
 * the caller to prove they can actually generate a valid code from it —
 * flips that flag. A secret sitting in the database that nobody has ever
 * successfully used isn't "2FA protecting this account" yet.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private encryptionKey(): string {
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!key) {
      throw new Error(
        'MFA_ENCRYPTION_KEY is not configured — set a 32-byte hex key to enable MFA.',
      );
    }
    return key;
  }

  async beginSetup(userId: string, email: string) {
    const user = await this.usersService.findById(userId);
    if (user?.mfaEnabled) throw new MfaAlreadyEnabledError();

    const secret = generateTotpSecret();
    const encrypted = encryptSecret(secret, this.encryptionKey());
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encrypted },
    });

    const otpauthUrl = totpAuthUrl(secret, email, ISSUER);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrCodeDataUrl };
  }

  async enable(userId: string, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.mfaSecret) throw new MfaNotSetUpError();
    if (user.mfaEnabled) throw new MfaAlreadyEnabledError();

    const secret = decryptSecret(user.mfaSecret, this.encryptionKey());
    if (!verifyTotpCode(secret, code)) throw new InvalidMfaCodeError();

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(5).toString('hex'),
    );
    const backupCodeHashes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c, { type: argon2.argon2id })),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodeHashes: backupCodeHashes },
    });

    return { backupCodes };
  }

  async disable(userId: string, password: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodeHashes: [] },
    });
  }

  /**
   * Verifies a TOTP code — or, failing that, a backup code (which is
   * consumed the moment it's used, since each is single-use). Used only
   * from the login flow, after the challenge token already proved the
   * password was correct.
   */
  async verifyLoginCode(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.mfaEnabled || !user.mfaSecret) throw new MfaNotSetUpError();

    const secret = decryptSecret(user.mfaSecret, this.encryptionKey());
    if (verifyTotpCode(secret, code)) return;

    for (const hash of user.mfaBackupCodeHashes) {
      if (await argon2.verify(hash, code)) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            mfaBackupCodeHashes: user.mfaBackupCodeHashes.filter(
              (h) => h !== hash,
            ),
          },
        });
        return;
      }
    }

    throw new InvalidMfaCodeError();
  }
}
