import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { ScansService } from './scans.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Controller('scans')
@UseGuards(JwtAuthGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  create(@Body() dto: CreateScanDto, @CurrentUser() user: RequestUser) {
    return this.scansService.createAndEnqueue(user.userId, dto.domainId);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scansService.findAllForOrganization(
      user.userId,
      organizationId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const scan = await this.scansService.findOne(user.userId, id);
    if (!scan) throw new NotFoundException('Scan not found');
    return scan;
  }
}
