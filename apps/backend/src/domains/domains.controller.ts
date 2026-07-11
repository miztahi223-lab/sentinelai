import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@Controller('domains')
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  create(@Body() dto: CreateDomainDto, @CurrentUser() user: RequestUser) {
    return this.domainsService.create(
      user.userId,
      dto.organizationId,
      dto.name,
    );
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.domainsService.findAllForOrganization(
      user.userId,
      organizationId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const domain = await this.domainsService.findOne(user.userId, id);
    if (!domain) throw new NotFoundException('Domain not found');
    return domain;
  }

  @Patch(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.domainsService.verify(user.userId, id);
  }
}
