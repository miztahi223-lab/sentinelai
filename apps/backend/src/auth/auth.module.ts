import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EmailModule } from '../email/email.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    PassportModule,
    // `forwardRef` because `UsersModule` now also imports `AuthModule` (for
    // `TokenService`, used by the change-password endpoint) — see the
    // matching comment in `users.module.ts`.
    forwardRef(() => UsersModule),
    OrganizationsModule,
    EmailModule,
    AuditLogsModule,
    // Registered with no default sign options: TokenService always passes
    // an explicit secret + expiresIn per call (derived from config), so
    // there's no meaningful shared default to set here — this registration
    // only exists to make JwtService available for injection.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, MfaService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
