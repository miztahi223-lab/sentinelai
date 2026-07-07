import {
  BadRequestException,
  Controller,
  Get,
  Body,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

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

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.findOneForUser(user.userId, id);
    if (!report) throw new NotFoundException('Report not found');
    if (!report.fileUrl || !existsSync(report.fileUrl)) {
      throw new NotFoundException(
        'This report has not finished generating yet (or generation failed) — no file is available.',
      );
    }
    res.download(report.fileUrl, `${report.title}.pdf`);
  }

  @Post(':id/email')
  async email(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const report = await this.reportsService.findOneForUser(user.userId, id);
    if (!report) throw new NotFoundException('Report not found');
    if (!report.fileUrl || !existsSync(report.fileUrl)) {
      throw new BadRequestException(
        'This report has not finished generating yet (or generation failed) — nothing to email.',
      );
    }

    const requester = await this.usersService.findById(user.userId);
    if (!requester) throw new NotFoundException('User not found');

    await this.emailService.sendReportEmail(
      requester.email,
      report.title,
      report.fileUrl,
    );
    return { success: true, sentTo: requester.email };
  }
}
