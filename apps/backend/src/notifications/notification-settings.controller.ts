import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Controller('notification-settings')
@UseGuards(JwtAuthGuard)
export class NotificationSettingsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  @Get()
  get(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationSettingsService.get(user.userId, organizationId);
  }

  @Patch()
  update(
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateNotificationSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationSettingsService.update(
      user.userId,
      organizationId,
      dto,
    );
  }
}
