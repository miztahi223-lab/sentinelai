import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { EmailService } from '../email/email.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TokenService } from './token.service';
import {
  MfaService,
  InvalidMfaCodeError,
  MfaNotSetUpError,
} from './mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from '../common/password.util';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
    private readonly mfaService: MfaService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      // Deliberately vague message: do not reveal whether the email exists
      // to an unauthenticated caller beyond what's unavoidable via timing.
      throw new ConflictException('Unable to register with these details');
    }

    const passwordHash = await hashPassword(dto.password);
    const emailVerifyToken = randomBytes(32).toString('hex');

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      emailVerifyToken,
    });

    const organization = await this.organizationsService.createWithOwner(
      user.id,
      dto.organizationName,
    );

    const tokens = await this.issueTokenPair(user.id, user.email, meta);
    await this.emailService.sendVerificationEmail(user.email, emailVerifyToken);
    await this.auditLogsService.record({
      organizationId: organization.id,
      userId: user.id,
      action: 'user.registered',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // The password alone is correct, but this account has MFA enabled — no
    // real session tokens are issued yet. A short-lived challenge token
    // (signed with a different secret than real access tokens, see
    // `TokenService.signMfaChallengeToken`) is all the caller gets until
    // `verifyMfaAndLogin` confirms the second factor too.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        challengeToken: this.tokenService.signMfaChallengeToken(user.id),
      };
    }

    const tokens = await this.issueTokenPair(user.id, user.email, meta);
    await this.auditLogsService.record({
      userId: user.id,
      action: 'user.login',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { mfaRequired: false, user: this.toPublicUser(user), ...tokens };
  }

  async verifyMfaAndLogin(
    challengeToken: string,
    code: string,
    meta: RequestMeta = {},
  ) {
    const userId = this.tokenService.verifyMfaChallengeToken(challengeToken);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    try {
      await this.mfaService.verifyLoginCode(userId, code);
    } catch (error) {
      if (
        error instanceof InvalidMfaCodeError ||
        error instanceof MfaNotSetUpError
      ) {
        throw new UnauthorizedException('Invalid or expired code');
      }
      throw error;
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, meta);
    await this.auditLogsService.record({
      userId: user.id,
      action: 'user.login',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { mfaRequired: false, user: this.toPublicUser(user), ...tokens };
  }

  async logout(refreshToken: string) {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    const rotated = await this.tokenService.rotateRefreshToken(
      refreshToken,
      meta,
    );
    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(rotated.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: rotated.newToken,
      user: this.toPublicUser(user),
    };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByEmailVerifyToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.usersService.markEmailVerified(user.id);
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always respond the same way whether or not the account exists, to
    // avoid leaking account existence via this endpoint.
    if (!user) {
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.usersService.setPasswordResetToken(user.id, token, expiresAt);
    await this.emailService.sendPasswordResetEmail(user.email, token);

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByPasswordResetToken(token);
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.usersService.resetPassword(user.id, passwordHash);
    // Resetting the password invalidates every existing session.
    await this.tokenService.revokeAllForUser(user.id);

    return { success: true };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    meta: RequestMeta,
  ) {
    const accessToken = this.tokenService.signAccessToken({
      sub: userId,
      email,
    });
    const refreshToken = await this.tokenService.issueRefreshToken(
      userId,
      meta,
    );
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
