import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { DomainsService } from '../domains/domains.service';
import { DiscoveryService } from './discovery.service';
import { AssetService } from './asset.service';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly domainsService: DomainsService,
    private readonly assetService: AssetService,
  ) {}

  @Post('domains/:domainId/run')
  async run(
    @Param('domainId') domainId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const domain = await this.domainsService.findOne(user.userId, domainId);
    if (!domain) throw new NotFoundException('Domain not found');
    return this.discoveryService.runForDomain(domain.id, domain.name);
  }

  @Get('domains/:domainId/assets')
  async assets(
    @Param('domainId') domainId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const domain = await this.domainsService.findOne(user.userId, domainId);
    if (!domain) throw new NotFoundException('Domain not found');
    return this.assetService.findAllForDomain(domainId);
  }
}
