import {
  Body,
  Controller,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { TokenService } from '../auth/token.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { hashPassword, verifyPassword } from '../common/password.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Patch('me')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    const updated = await this.usersService.updateName(user.userId, dto.name);
    await this.auditLogsService.record({
      userId: user.userId,
      action: 'user.profile_updated',
      metadata: { name: dto.name },
    });
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      emailVerified: updated.emailVerified,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Changing your password from an authenticated session, distinct from
   * the unauthenticated forgot-password/reset-password email flow — this
   * one requires knowing the *current* password (not just having access to
   * the account's inbox), which is the standard extra check for a logged-in
   * user deliberately changing their own credential.
   *
   * Like the reset-password flow, this revokes every other active session
   * (all refresh tokens for this user) once the password actually changes —
   * a password change is exactly the moment a stale/possibly-compromised
   * session elsewhere should stop working.
   */
  @Post('me/change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    const fullUser = await this.usersService.findById(user.userId);
    if (!fullUser) {
      throw new UnauthorizedException();
    }

    const valid = await verifyPassword(
      fullUser.passwordHash,
      dto.currentPassword,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(user.userId, newHash);
    await this.tokenService.revokeAllForUser(user.userId);
    await this.auditLogsService.record({
      userId: user.userId,
      action: 'user.password_changed',
    });

    return { success: true };
  }
}
