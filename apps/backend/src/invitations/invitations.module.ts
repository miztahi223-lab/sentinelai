import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [OrganizationsModule, UsersModule, EmailModule, AuditLogsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
