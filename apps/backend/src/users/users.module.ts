import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  // `forwardRef` is required here because `AuthModule` already imports
  // `UsersModule` (for `UsersService`) — this module now also needs
  // `AuthModule`'s exported `TokenService` (to revoke sessions on password
  // change), which would otherwise be a circular import Nest can't resolve
  // without the explicit forward reference on both sides (see
  // `auth.module.ts`'s matching `forwardRef(() => UsersModule)`).
  imports: [forwardRef(() => AuthModule), AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
