import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  MfaService,
  MfaAlreadyEnabledError,
  MfaNotSetUpError,
  InvalidMfaCodeError,
} from './mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { MfaEnableDto } from './dto/mfa-enable.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly mfaService: MfaService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, requestMeta(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService
      .logout(refreshToken)
      .then(() => ({ success: true }));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.authService.refresh(refreshToken, requestMeta(req));
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const record = await this.usersService.findById(user.userId);
    if (!record) return null;
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      emailVerified: record.emailVerified,
      createdAt: record.createdAt,
      mfaEnabled: record.mfaEnabled,
    };
  }

  /**
   * Second step of login for an account with MFA enabled — exchanges the
   * short-lived challenge token `login()` returned, plus a real TOTP (or
   * backup) code, for real session tokens. Same throttle ceiling as
   * `login` itself: this is the endpoint an attacker who's already stolen a
   * password would be brute-forcing 6-digit codes against.
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.authService.verifyMfaAndLogin(
      dto.challengeToken,
      dto.code,
      requestMeta(req),
    );
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser() user: RequestUser) {
    const record = await this.usersService.findById(user.userId);
    if (!record) throw new ConflictException('Account not found');
    try {
      return await this.mfaService.beginSetup(user.userId, record.email);
    } catch (error) {
      if (error instanceof MfaAlreadyEnabledError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async enableMfa(@Body() dto: MfaEnableDto, @CurrentUser() user: RequestUser) {
    try {
      return await this.mfaService.enable(user.userId, dto.code);
    } catch (error) {
      if (error instanceof MfaAlreadyEnabledError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof MfaNotSetUpError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidMfaCodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableMfa(
    @Body() dto: MfaDisableDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.mfaService.disable(user.userId, dto.password);
    return { success: true };
  }
}
