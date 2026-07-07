import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    OrganizationsModule,
    EmailModule,
    // Registered with no default sign options: TokenService always passes
    // an explicit secret + expiresIn per call (derived from config), so
    // there's no meaningful shared default to set here — this registration
    // only exists to make JwtService available for injection.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
