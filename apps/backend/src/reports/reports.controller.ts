import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() user: RequestUser) {
    return this.reportsService.createAndEnqueue(
      user.userId,
      dto.organizationId,
      dto.scanId,
      dto.title,
    );
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reportsService.findAllForOrganization(
      user.userId,
      organizationId,
    );
  }
}
