import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.auditLogsService.findForOrganization(
      user.userId,
      organizationId,
    );
  }
}
