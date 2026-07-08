import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CryptoBillingService } from './crypto-billing.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [OrganizationsModule, UsersModule, AuditLogsModule],
  controllers: [BillingController],
  providers: [BillingService, CryptoBillingService],
  exports: [BillingService, CryptoBillingService],
})
export class BillingModule {}
